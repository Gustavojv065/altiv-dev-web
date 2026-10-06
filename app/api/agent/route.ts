import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { classifyTask, PIPELINE } from '@/lib/agent/pipeline'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

const websiteSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  html: z.string().min(100),
})

const GATEWAY_MODELS = [
  'nvidia/nemotron-3-super-120b-a12b',
  'alibaba/qwen3-coder-next',
] as const

function systemPrompt(currentHtml?: string | null) {
  return `Você é o motor de criação do ALTIV DEV, um construtor profissional de sites.
Gere uma página web REAL, completa e executável, em um único arquivo HTML.
Regras:
- Entregue HTML5 completo, com <!doctype html>, <html>, <head> e <body>.
- CSS deve ficar dentro de <style>.
- JavaScript deve ficar dentro de <script>.
- O resultado deve ser responsivo para celular e desktop.
- Use design profissional, tipografia forte, bom espaçamento, contraste e acessibilidade.
- Não use frameworks externos nem dependências obrigatórias.
- Pode usar imagens remotas HTTPS quando fizer sentido.
- Não escreva explicações dentro do HTML.
- Quando existir HTML atual, EDITE e preserve o que estiver bom; não recomece sem necessidade.
- Atenda exatamente ao pedido do usuário.
- Retorne JSON válido com as chaves title, summary e html.
${currentHtml ? '\nHTML ATUAL DO PROJETO:\n' + currentHtml.slice(0, 60000) : ''}`
}

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^\`\`\`json/i, '').replace(/^\`\`\`/, '').replace(/\`\`\`$/, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('A IA não retornou JSON válido.')
  return websiteSchema.parse(JSON.parse(cleaned.slice(start, end + 1)))
}

async function generateWithNvidia(
  prompt: string,
  currentHtml: string | null | undefined,
  model: string,
  timeoutMs: number
) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY não configurada.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: `Você é o motor de criação do ALTIV DEV.
Crie ou edite um site profissional e responsivo.
Retorne SOMENTE o HTML completo, começando com <!doctype html>.
Inclua todo CSS dentro de <style> e JavaScript dentro de <script>.
Não use markdown, não use blocos de código e não explique nada fora do HTML.
Priorize qualidade visual, acessibilidade, responsividade e conteúdo solicitado.
${currentHtml ? '\nSITE ATUAL PARA EDITAR:\n' + currentHtml.slice(0, 40000) : ''}`,
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        top_p: 0.95,
        max_tokens: 10000,
        chat_template_kwargs: {
          enable_thinking: false,
          force_nonempty_content: true,
        },
        stream: false,
      }),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`NVIDIA ${model} falhou: ${response.status} ${detail.slice(0, 400)}`)
    }

    const data = await response.json()
    let html = String(data?.choices?.[0]?.message?.content ?? '').trim()
    html = html.replace(/^\`\`\`html\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/i, '').trim()

    const doctypeIndex = html.toLowerCase().indexOf('<!doctype html>')
    const htmlIndex = html.toLowerCase().indexOf('<html')
    const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlIndex
    if (startIndex > 0) html = html.slice(startIndex)

    if (!html.toLowerCase().includes('<html') || html.length < 500) {
      throw new Error(`NVIDIA ${model} retornou conteúdo insuficiente.`)
    }

    // Models can occasionally omit only the final closing tags after producing
    // an otherwise usable page. Preserve the generated work instead of
    // discarding it, and make the document renderable in the preview.
    if (!html.toLowerCase().includes('</body>')) html += '\n</body>'
    if (!html.toLowerCase().includes('</html>')) html += '\n</html>'

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = titleMatch?.[1]?.trim() || 'Projeto ALTIV'
    const summary = `Site atualizado com ${model.split('/').pop()} pela NVIDIA NIM.`

    return {
      model,
      provider: 'nvidia-direct',
      output: { title, summary, html },
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`NVIDIA ${model} excedeu ${Math.round(timeoutMs / 1000)}s.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function generateWebsite(prompt: string, currentHtml?: string | null) {
  const errors: string[] = []

  if (process.env.NVIDIA_API_KEY) {
    const directModels = [
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeout: 90000 },
      { id: 'nvidia/nemotron-3-super-120b-a12b', timeout: 150000 },
    ]

    for (const candidate of directModels) {
      try {
        return await generateWithNvidia(prompt, currentHtml, candidate.id, candidate.timeout)
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

    // Do not waste more time on AI Gateway when NVIDIA direct is configured.
    throw new Error('NVIDIA não concluiu a geração. ' + errors.join(' | '))
  }

  for (const model of GATEWAY_MODELS) {
    try {
      const result = await generateText({
        model,
        system: systemPrompt(currentHtml),
        prompt,
        output: Output.object({ schema: websiteSchema }),
        abortSignal: AbortSignal.timeout(45000),
      })
      return { model, provider: 'vercel-ai-gateway', output: result.output }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }

  throw new Error('Nenhum provedor conseguiu gerar o site. ' + errors.join(' | '))
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const prompt = String(body?.prompt ?? '').trim()
  const projectId = String(body?.projectId ?? '').trim()

  if (!prompt || !projectId) {
    return NextResponse.json({ ok: false, error: 'Prompt e projeto são obrigatórios.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const ownerId = String(claimsData.claims.sub)
  const { data: project } = await supabase
    .from('projects')
    .select('id,name')
    .eq('id', projectId)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const task = classifyTask(prompt)

  let { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) {
    const created = await supabase
      .from('conversations')
      .insert({ owner_id: ownerId, project_id: projectId, title: prompt.slice(0, 80) })
      .select('id')
      .single()
    if (created.error || !created.data) {
      return NextResponse.json({ ok: false, error: created.error?.message ?? 'Falha ao criar conversa.' }, { status: 500 })
    }
    conversation = created.data
  }

  await supabase.from('messages').insert({
    owner_id: ownerId,
    conversation_id: conversation.id,
    role: 'user',
    content: prompt,
  })

  const runInsert = await supabase
    .from('agent_runs')
    .insert({
      owner_id: ownerId,
      project_id: projectId,
      conversation_id: conversation.id,
      prompt,
      task_type: task,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (runInsert.error || !runInsert.data) {
    return NextResponse.json({ ok: false, error: runInsert.error?.message ?? 'Falha ao registrar execução.' }, { status: 500 })
  }

  const runId = runInsert.data.id
  const steps = PIPELINE.map((step, index) => ({
    owner_id: ownerId,
    run_id: runId,
    step_name: step,
    status: index === 0 ? 'running' : 'queued',
  }))
  await supabase.from('agent_run_steps').insert(steps)

  try {
    const { data: currentFile } = await supabase
      .from('project_files')
      .select('content,revision')
      .eq('project_id', projectId)
      .eq('owner_id', ownerId)
      .eq('path', 'index.html')
      .maybeSingle()

    const generated = await generateWebsite(prompt, currentFile?.content)

    await supabase
      .from('agent_runs')
      .update({ selected_model: generated.model, status: 'testing' })
      .eq('id', runId)
      .eq('owner_id', ownerId)

    const revision = (currentFile?.revision ?? 0) + 1
    const fileWrite = await supabase
      .from('project_files')
      .upsert({
        owner_id: ownerId,
        project_id: projectId,
        path: 'index.html',
        language: 'html',
        content: generated.output.html,
        revision,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,path' })

    if (fileWrite.error) throw fileWrite.error

    const { data: lastVersion } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .eq('owner_id', ownerId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    await supabase.from('project_versions').insert({
      owner_id: ownerId,
      project_id: projectId,
      version_number: (lastVersion?.version_number ?? 0) + 1,
      source_type: 'snapshot',
      summary: generated.output.summary,
      metadata: { file: 'index.html', revision, model: generated.model, provider: generated.provider, run_id: runId },
    })

    await supabase.from('messages').insert({
      owner_id: ownerId,
      conversation_id: conversation.id,
      role: 'assistant',
      content: generated.output.summary,
      model: generated.model,
      parts: [{ type: 'generated-file', path: 'index.html', revision, provider: generated.provider }],
    })

    await supabase.from('project_memories').insert({
      owner_id: ownerId,
      project_id: projectId,
      scope: 'project',
      kind: 'decision',
      content: generated.output.summary,
      importance: 70,
      metadata: { source: 'generation', run_id: runId, revision, provider: generated.provider },
    })

    await supabase
      .from('agent_run_steps')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('run_id', runId)
      .eq('owner_id', ownerId)

    await supabase
      .from('agent_runs')
      .update({ status: 'completed', finished_at: new Date().toISOString() })
      .eq('id', runId)
      .eq('owner_id', ownerId)

    await supabase
      .from('projects')
      .update({
        name: project.name === 'Novo projeto' ? generated.output.title : project.name,
        status: 'ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .eq('owner_id', ownerId)

    return NextResponse.json({
      ok: true,
      projectId,
      conversationId: conversation.id,
      runId,
      task,
      model: generated.model,
      provider: generated.provider,
      summary: generated.output.summary,
      html: generated.output.html,
      revision,
      persisted: true,
      realGeneration: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na geração.'

    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error_message: message, finished_at: new Date().toISOString() })
      .eq('id', runId)
      .eq('owner_id', ownerId)

    return NextResponse.json({ ok: false, error: message, runId }, { status: 500 })
  }
}
