import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { classifyTask, PIPELINE } from '@/lib/agent/pipeline'
import { createClient } from '@/lib/supabase/server'

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

async function generateWithNvidia(prompt: string, currentHtml?: string | null) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY não configurada.')

  const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(55000),
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + apiKey,
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-super-120b-a12b',
      messages: [
        { role: 'system', content: systemPrompt(currentHtml) },
        { role: 'user', content: prompt + '\nResponda somente com JSON válido no formato: {"title":"...","summary":"...","html":"<!doctype html>..."}' },
      ],
      temperature: 1,
      top_p: 0.95,
      max_tokens: 7000,
      chat_template_kwargs: {
        enable_thinking: false,
        force_nonempty_content: true,
      },
      stream: false,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error('NVIDIA NIM falhou: ' + response.status + ' ' + detail.slice(0, 500))
  }

  const data = await response.json()
  const text = data?.choices?.[0]?.message?.content
  if (!text) throw new Error('NVIDIA NIM não retornou conteúdo.')
  return { model: 'nvidia/nemotron-3-super-120b-a12b', provider: 'nvidia-direct', output: extractJson(text) }
}

async function generateWebsite(prompt: string, currentHtml?: string | null) {
  const errors: string[] = []

  // Prefer direct NVIDIA when configured. This avoids wasting function time
  // on a Gateway account that may not have credits enabled yet.
  if (process.env.NVIDIA_API_KEY) {
    try {
      return await generateWithNvidia(prompt, currentHtml)
    } catch (error) {
      errors.push('NVIDIA: ' + (error instanceof Error ? error.message : String(error)))
    }
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
      errors.push('Gateway ' + model + ': ' + (error instanceof Error ? error.message : String(error)))
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
