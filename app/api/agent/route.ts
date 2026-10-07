import { NextRequest, NextResponse } from 'next/server'
import { generateText, Output } from 'ai'
import { z } from 'zod'
import { classifyTask, PIPELINE } from '@/lib/agent/pipeline'
import { analyzeHtmlQuality } from '@/lib/agent/quality'
import { buildSkillInstructions, selectAltivSkills } from '@/lib/agent/skills'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

const websiteSchema = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  html: z.string().min(100),
})

const siteSpecSchema = z.object({
  brand: z.string().default(''),
  audience: z.string().default(''),
  goals: z.array(z.string()).default([]),
  visualDirection: z.string().default(''),
  tone: z.string().default(''),
  palette: z.array(z.string()).default([]),
  sections: z.array(z.object({
    type: z.string(),
    title: z.string().optional(),
    purpose: z.string().optional(),
  })).default([]),
  requirements: z.array(z.string()).default([]),
})

type SiteSpec = z.infer<typeof siteSpecSchema>

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

function stripCodeFences(text: string) {
  return text
    .trim()
    .replace(/^```(?:json|html)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractJsonObject(text: string) {
  const cleaned = stripCodeFences(text)
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('A IA não retornou JSON válido.')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function callNvidia(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  model: string,
  timeoutMs: number,
  maxTokens: number,
  temperature: number
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
        messages,
        temperature,
        top_p: 0.95,
        max_tokens: maxTokens,
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
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) throw new Error(`NVIDIA ${model} não retornou conteúdo.`)
    return text
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`NVIDIA ${model} excedeu ${Math.round(timeoutMs / 1000)}s.`)
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

function fallbackSpec(prompt: string, previous?: unknown): SiteSpec {
  const parsedPrevious = siteSpecSchema.safeParse(previous)
  const base = parsedPrevious.success ? parsedPrevious.data : siteSpecSchema.parse({})
  const isDark = /dark|escuro|preto|black/i.test(prompt)

  return {
    ...base,
    goals: base.goals.length ? base.goals : ['clareza comercial', 'conversão', 'credibilidade'],
    visualDirection: base.visualDirection || (isDark
      ? 'premium com contraste tonal e seções visualmente distintas'
      : 'premium editorial, limpo, contemporâneo e com boa variedade tonal'),
    sections: base.sections.length ? base.sections : [
      { type: 'header', title: 'Navegação' },
      { type: 'hero', title: 'Proposta de valor' },
      { type: 'social-proof', title: 'Diferenciais' },
      { type: 'services', title: 'Serviços' },
      { type: 'process', title: 'Como funciona' },
      { type: 'testimonials', title: 'Depoimentos' },
      { type: 'cta', title: 'Chamada final' },
      { type: 'contact', title: 'Contato' },
      { type: 'footer', title: 'Rodapé' },
    ],
    requirements: Array.from(new Set([
      ...base.requirements,
      'responsivo em 1440, 1024, 768 e 390px',
      'acessível por teclado',
      'SEO básico',
      'CTAs funcionais',
    ])),
  }
}

async function generateSiteSpec(
  prompt: string,
  currentSpec: unknown,
  memoryText: string
): Promise<SiteSpec> {
  if (!process.env.NVIDIA_API_KEY) return fallbackSpec(prompt, currentSpec)

  try {
    const text = await callNvidia(
      [
        {
          role: 'system',
          content: `Você é um Product Designer sênior. Transforme o pedido em um Site Spec curto e estruturado.
Retorne SOMENTE JSON válido com:
{
  "brand": "nome/marca",
  "audience": "público principal",
  "goals": ["objetivos"],
  "visualDirection": "direção visual específica",
  "tone": "tom da comunicação",
  "palette": ["cores/direção de cores"],
  "sections": [{"type":"hero","title":"...","purpose":"..."}],
  "requirements": ["requisitos"]
}
Não gere HTML. Evite generalidades. Planeje uma página profissional, comercial, responsiva e distinta.`,
        },
        {
          role: 'user',
          content: `PEDIDO ATUAL:
${prompt}

SPEC ANTERIOR:
${JSON.stringify(currentSpec ?? {})}

MEMÓRIAS RELEVANTES:
${memoryText || 'Nenhuma memória anterior relevante.'}`,
        },
      ],
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      30000,
      1800,
      0.3
    )

    return siteSpecSchema.parse(extractJsonObject(text))
  } catch {
    return fallbackSpec(prompt, currentSpec)
  }
}

function designSystemPrompt(spec: SiteSpec, memoryText: string, currentHtml?: string | null) {
  return `Você é o ALTIV Design Engineer: diretor de produto, designer de interfaces premium e engenheiro frontend sênior.
Sua missão não é apenas "fazer funcionar": entregue uma página com qualidade visual comparável a um estúdio profissional.

SITE SPEC — FONTE DE VERDADE
${JSON.stringify(spec, null, 2)}

MEMÓRIA DO PROJETO
${memoryText || 'Nenhuma memória anterior relevante.'}

REGRAS DE SAÍDA
- Retorne SOMENTE o HTML completo, começando com <!doctype html>.
- Todo CSS deve ficar em <style> e JavaScript em <script>.
- Não use markdown, cercas de código ou explicações fora do HTML.
- O resultado deve funcionar sozinho no navegador, sem build.
- Não use emoji como ícone principal. Prefira SVG inline, formas CSS e tipografia.
- Evite dependências externas obrigatórias.

PADRÃO VISUAL OBRIGATÓRIO
- Crie identidade visual coerente com o setor e a marca, sem parecer template genérico.
- Use grid de 8px, espaçamento generoso, hierarquia tipográfica clara e largura de conteúdo controlada.
- Header profissional, hero editorial forte, CTAs claros e navegação funcional.
- Não deixe grandes áreas vazias sem intenção visual.
- Use composição variada: cards, grids, números, destaques, divisores, fundos alternados e microinterações discretas.
- Crie estados hover/focus e transições suaves.
- Garanta contraste, foco visível, labels e HTML semântico.
- Responsividade real em 1440px, 1024px, 768px e 390px.
- Em mobile, reorganize conteúdo; não apenas reduza tudo.
- Evite excesso de bordas, gradientes aleatórios, sombras pesadas e aparência "IA genérica".
- NÃO associe automaticamente "premium" a uma página inteira escura. Se o usuário não pedir explicitamente predominância dark, use variedade tonal com seções claras/off-white.
- Em marcas preto+dourado, prefira hero/header escuros, conteúdo principal claro e dourado como acento.
- Use CSS custom properties para cores, raios, spacing e tipografia.
- Se não houver imagens confiáveis, produza composição premium com SVG inline, shapes e textura CSS em vez de URLs inventadas.

QUALIDADE TÉCNICA
- Inclua meta description.
- Use exatamente um H1.
- Use header, main, section e footer semânticos.
- Tenha pelo menos quatro seções úteis em páginas comerciais.
- Inclua :focus-visible e breakpoints móveis.
- Links e CTAs devem ter href/ação coerente.
- Não use lorem ipsum.

EDIÇÃO
- Se existir site atual, preserve funcionalidades e conteúdo corretos, mas aplique apenas as mudanças necessárias quando o pedido for pontual.
- Quando o usuário pedir "melhorar" ou "redesign", faça uma revisão ampla de hierarquia, composição, cores, tipografia e responsividade.
- Nunca remova seções úteis sem motivo.

Antes de responder, revise internamente: hierarquia, spacing, contraste, responsividade, clareza comercial, SEO, acessibilidade e acabamento.
${currentHtml ? '\nSITE ATUAL PARA EDITAR:\n' + currentHtml.slice(0, 50000) : ''}`
}

async function generateWithNvidia(
  prompt: string,
  currentHtml: string | null | undefined,
  model: string,
  timeoutMs: number,
  spec: SiteSpec,
  memoryText: string
) {
  let html = stripCodeFences(await callNvidia(
    [
      { role: 'system', content: designSystemPrompt(spec, memoryText, currentHtml) },
      { role: 'user', content: prompt },
    ],
    model,
    timeoutMs,
    10000,
    0.5
  ))

  const doctypeIndex = html.toLowerCase().indexOf('<!doctype html>')
  const htmlIndex = html.toLowerCase().indexOf('<html')
  const startIndex = doctypeIndex >= 0 ? doctypeIndex : htmlIndex
  if (startIndex > 0) html = html.slice(startIndex)

  if (!html.toLowerCase().includes('<html') || html.length < 500) {
    throw new Error(`NVIDIA ${model} retornou conteúdo insuficiente.`)
  }

  if (!html.toLowerCase().includes('</body>')) html += '\n</body>'
  if (!html.toLowerCase().includes('</html>')) html += '\n</html>'

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  const title = titleMatch?.[1]?.trim() || spec.brand || 'Projeto ALTIV'

  return {
    model,
    provider: 'nvidia-direct',
    output: {
      title,
      summary: `Site atualizado com ${model.split('/').pop()} e revisão automática de qualidade.`,
      html,
    },
  }
}

async function repairHtml(
  prompt: string,
  html: string,
  issues: string[],
  spec: SiteSpec
) {
  if (!process.env.NVIDIA_API_KEY || issues.length === 0) return html

  try {
    let repaired = stripCodeFences(await callNvidia(
      [
        {
          role: 'system',
          content: `Você é o revisor técnico e visual do ALTIV DEV.
Corrija SOMENTE os problemas listados, preservando tudo que já está bom.
Retorne SOMENTE o HTML completo corrigido.
Não simplifique a página. Não remova conteúdo útil.
SITE SPEC:
${JSON.stringify(spec, null, 2)}

PROBLEMAS A CORRIGIR:
${issues.join('\n')}`,
        },
        {
          role: 'user',
          content: `PEDIDO ORIGINAL:
${prompt}

HTML A CORRIGIR:
${html.slice(0, 60000)}`,
        },
      ],
      'nvidia/nemotron-3.5-lightning-30b-a3b',
      55000,
      8500,
      0.25
    ))

    const start = repaired.toLowerCase().indexOf('<!doctype html>')
    const htmlStart = repaired.toLowerCase().indexOf('<html')
    const startIndex = start >= 0 ? start : htmlStart
    if (startIndex > 0) repaired = repaired.slice(startIndex)

    if (!repaired.toLowerCase().includes('<html') || repaired.length < 500) return html
    if (!repaired.toLowerCase().includes('</body>')) repaired += '\n</body>'
    if (!repaired.toLowerCase().includes('</html>')) repaired += '\n</html>'
    return repaired
  } catch {
    return html
  }
}

async function generateWebsite(
  prompt: string,
  currentHtml: string | null | undefined,
  spec: SiteSpec,
  memoryText: string
) {
  const errors: string[] = []

  if (process.env.NVIDIA_API_KEY) {
    const directModels = [
      { id: 'nvidia/nemotron-3-super-120b-a12b', timeout: 150000 },
      { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeout: 70000 },
    ]

    for (const candidate of directModels) {
      try {
        return await generateWithNvidia(
          prompt,
          currentHtml,
          candidate.id,
          candidate.timeout,
          spec,
          memoryText
        )
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error))
      }
    }

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

  const { data: lockToken, error: lockError } = await supabase.rpc('acquire_project_agent_lock', {
    p_project_id: projectId,
    p_owner_id: ownerId,
    p_ttl_seconds: 360,
  })

  if (lockError || !lockToken) {
    return NextResponse.json({
      ok: false,
      error: 'Já existe uma execução ativa neste projeto. Aguarde ela terminar antes de enviar outro pedido.',
      locked: true,
    }, { status: 409 })
  }

  const runInsert = await supabase
    .from('agent_runs')
    .insert({
      owner_id: ownerId,
      project_id: projectId,
      conversation_id: conversation.id,
      prompt,
      task_type: task,
      status: 'planning',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (runInsert.error || !runInsert.data) {
    await supabase.rpc('release_project_agent_lock', {
      p_project_id: projectId,
      p_owner_id: ownerId,
      p_token: lockToken,
    })
    return NextResponse.json({ ok: false, error: runInsert.error?.message ?? 'Falha ao registrar execução.' }, { status: 500 })
  }

  const runId = runInsert.data.id
  await supabase.from('agent_run_steps').insert(
    PIPELINE.map((step, index) => ({
      owner_id: ownerId,
      run_id: runId,
      step_name: step,
      status: index === 0 ? 'running' : 'queued',
    }))
  )

  async function markStep(step: string, status: 'running' | 'completed' | 'failed' | 'skipped') {
    await supabase
      .from('agent_run_steps')
      .update({
        status,
        ...(status === 'completed' || status === 'failed' || status === 'skipped'
          ? { finished_at: new Date().toISOString() }
          : { started_at: new Date().toISOString() }),
      })
      .eq('run_id', runId)
      .eq('owner_id', ownerId)
      .eq('step_name', step)
  }

  try {
    await markStep('understand', 'completed')
    await markStep('plan', 'running')

    const [{ data: currentFile }, { data: currentSpecRow }, { data: memories }] = await Promise.all([
      supabase
        .from('project_files')
        .select('content,revision')
        .eq('project_id', projectId)
        .eq('owner_id', ownerId)
        .eq('path', 'index.html')
        .maybeSingle(),
      supabase
        .from('project_specs')
        .select('spec')
        .eq('project_id', projectId)
        .eq('owner_id', ownerId)
        .maybeSingle(),
      supabase
        .from('project_memories')
        .select('kind,content,importance,created_at')
        .eq('project_id', projectId)
        .eq('owner_id', ownerId)
        .order('importance', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    await markStep('retrieve-memory', 'completed')

    const memoryText = (memories ?? [])
      .map((m) => `[${m.kind}] ${m.content}`)
      .join('\n')
      .slice(0, 5000)

    const activeSkills = selectAltivSkills(prompt)
    const skillInstructions = buildSkillInstructions(prompt)
    const enrichedPrompt = prompt + (skillInstructions ? '\n\nSKILLS ATIVAS:\n' + skillInstructions : '')
    const spec = await generateSiteSpec(enrichedPrompt, currentSpecRow?.spec, memoryText)

    await supabase
      .from('project_specs')
      .upsert({
        owner_id: ownerId,
        project_id: projectId,
        spec,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id' })

    await markStep('plan', 'completed')
    await markStep('generate', 'running')

    const generated = await generateWebsite(enrichedPrompt, currentFile?.content, spec, memoryText)

    await markStep('generate', 'completed')
    await markStep('validate', 'running')

    let finalHtml = generated.output.html
    let quality = analyzeHtmlQuality(finalHtml)

    await markStep('validate', 'completed')
    await markStep('review', 'running')

    if (quality.score < 84 && quality.issues.length) {
      await markStep('review', 'completed')
      await markStep('repair', 'running')
      finalHtml = await repairHtml(enrichedPrompt, finalHtml, quality.issues, spec)
      quality = analyzeHtmlQuality(finalHtml)
      await markStep('repair', 'completed')
    } else {
      await markStep('review', 'completed')
      await markStep('repair', 'skipped')
    }

    await supabase
      .from('agent_runs')
      .update({
        selected_model: generated.model,
        status: 'testing',
      })
      .eq('id', runId)
      .eq('owner_id', ownerId)

    await markStep('preview', 'running')

    const revision = (currentFile?.revision ?? 0) + 1
    const fileWrite = await supabase
      .from('project_files')
      .upsert({
        owner_id: ownerId,
        project_id: projectId,
        path: 'index.html',
        language: 'html',
        content: finalHtml,
        revision,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'project_id,path' })

    if (fileWrite.error) throw fileWrite.error

    await markStep('preview', 'completed')
    await markStep('snapshot', 'running')

    const { data: lastVersion } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id', projectId)
      .eq('owner_id', ownerId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle()

    const versionNumber = (lastVersion?.version_number ?? 0) + 1
    const summary = `${generated.output.summary} Qualidade ALTIV: ${quality.score}/100.`

    await supabase.from('project_versions').insert({
      owner_id: ownerId,
      project_id: projectId,
      version_number: versionNumber,
      source_type: 'snapshot',
      summary,
      metadata: {
        file: 'index.html',
        revision,
        model: generated.model,
        provider: generated.provider,
        run_id: runId,
        quality_score: quality.score,
        quality_issues: quality.issues,
        skills: activeSkills.map((skill) => skill.id),
        site_spec: spec,
      },
    })

    await supabase.from('project_version_files').insert({
      owner_id: ownerId,
      project_id: projectId,
      version_number: versionNumber,
      path: 'index.html',
      content: finalHtml,
    })

    await markStep('snapshot', 'completed')

    await supabase.from('messages').insert({
      owner_id: ownerId,
      conversation_id: conversation.id,
      role: 'assistant',
      content: summary,
      model: generated.model,
      parts: [{
        type: 'generated-file',
        path: 'index.html',
        revision,
        provider: generated.provider,
        qualityScore: quality.score,
      }],
    })

    await supabase.from('project_memories').insert({
      owner_id: ownerId,
      project_id: projectId,
      scope: 'project',
      kind: 'decision',
      content: `${summary} Direção visual: ${spec.visualDirection}`,
      importance: 80,
      metadata: {
        source: 'generation',
        run_id: runId,
        revision,
        provider: generated.provider,
        quality_score: quality.score,
      },
    })

    await markStep('finish', 'completed')

    await supabase
      .from('agent_runs')
      .update({
        status: 'completed',
        finished_at: new Date().toISOString(),
      })
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

    await supabase.rpc('release_project_agent_lock', {
      p_project_id: projectId,
      p_owner_id: ownerId,
      p_token: lockToken,
    })

    return NextResponse.json({
      ok: true,
      projectId,
      conversationId: conversation.id,
      runId,
      task,
      model: generated.model,
      provider: generated.provider,
      summary,
      html: finalHtml,
      revision,
      versionNumber,
      qualityScore: quality.score,
      qualityIssues: quality.issues,
      activeSkills: activeSkills.map((skill) => ({ id: skill.id, label: skill.label })),
      siteSpec: spec,
      persisted: true,
      realGeneration: true,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha desconhecida na geração.'

    await supabase
      .from('agent_runs')
      .update({
        status: 'failed',
        error_message: message,
        finished_at: new Date().toISOString(),
      })
      .eq('id', runId)
      .eq('owner_id', ownerId)

    await supabase.rpc('release_project_agent_lock', {
      p_project_id: projectId,
      p_owner_id: ownerId,
      p_token: lockToken,
    })

    return NextResponse.json({ ok: false, error: message, runId }, { status: 500 })
  }
}
