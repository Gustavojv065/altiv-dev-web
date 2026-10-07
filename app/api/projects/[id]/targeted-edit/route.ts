import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeHtmlQuality } from '@/lib/agent/quality'
import { planFileTargets, type ProjectFileInfo } from '@/lib/agent/file-intelligence'
import { selectAltivSkills, buildSkillInstructions } from '@/lib/agent/skills'
import { renderStaticSite } from '@/lib/project/render'

const allowedPaths = new Set(['index.html', 'styles.css', 'script.js'])

function extractJson(text: string) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Resposta JSON inválida.')
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function callModel(prompt: string) {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new Error('NVIDIA_API_KEY não configurada.')

  const models = [
    { id: 'nvidia/nemotron-3-super-120b-a12b', timeout: 140000 },
    { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeout: 65000 },
  ]
  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), model.timeout)
    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: model.id,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.25,
          top_p: 0.9,
          max_tokens: 9500,
          stream: false,
          chat_template_kwargs: { enable_thinking: false, force_nonempty_content: true },
        }),
      })
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const data = await response.json()
      const text = String(data?.choices?.[0]?.message?.content ?? '')
      const parsed = extractJson(text)
      return { model: model.id, parsed }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Nenhum modelo concluiu a edição: ' + errors.join(' | '))
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const userPrompt = String(body?.prompt ?? '').trim()
  if (!userPrompt) return NextResponse.json({ ok: false, error: 'Pedido vazio.' }, { status: 400 })

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const ownerId = auth?.claims?.sub
  if (!ownerId) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })

  const [{ data: project }, { data: files }, { data: specRow }, { data: memories }] = await Promise.all([
    supabase.from('projects').select('id,name').eq('id', id).eq('owner_id', ownerId).maybeSingle(),
    supabase.from('project_files').select('path,content,revision,language')
      .eq('project_id', id).eq('owner_id', ownerId).order('path'),
    supabase.from('project_specs').select('spec').eq('project_id', id).eq('owner_id', ownerId).maybeSingle(),
    supabase.from('project_memories').select('kind,content,importance')
      .eq('project_id', id).eq('owner_id', ownerId).order('importance', { ascending: false }).limit(6),
  ])

  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })

  const projectFiles = (files ?? []) as ProjectFileInfo[]
  const plan = planFileTargets(userPrompt, projectFiles)
  if (plan.mode !== 'targeted') {
    return NextResponse.json({ ok: false, fallback: true, plan }, { status: 409 })
  }

  const { data: lockToken } = await supabase.rpc('acquire_project_agent_lock', {
    p_project_id: id, p_owner_id: ownerId, p_ttl_seconds: 300,
  })
  if (!lockToken) {
    return NextResponse.json({ ok: false, error: 'Já existe uma edição ativa neste projeto.' }, { status: 409 })
  }

  try {
    const targetContext = projectFiles
      .filter((file) => plan.targets.includes(file.path as 'index.html' | 'styles.css' | 'script.js'))
      .map((file) => 'ARQUIVO ' + file.path + '\n' + file.content.slice(0, 50000))
      .join('\n\n')

    const memory = (memories ?? []).map((item) => '[' + item.kind + '] ' + item.content).join('\n')
    const skillText = buildSkillInstructions(userPrompt)
    const prompt = `Você é o editor cirúrgico do ALTIV DEV.
Edite apenas os arquivos autorizados abaixo e preserve tudo que não fizer parte do pedido.

ARQUIVOS AUTORIZADOS: ${plan.targets.join(', ')}
MOTIVO DO PLANO: ${plan.reason}

Retorne SOMENTE JSON válido:
{"summary":"resumo curto","files":[{"path":"styles.css","content":"conteúdo completo atualizado"}]}

Regras:
- Cada content deve ser o arquivo completo atualizado, nunca um patch parcial.
- Não retorne arquivos fora da lista autorizada.
- Não invente telefone, endereço, avaliações, clientes ou depoimentos.
- Preserve marca, conteúdo e funcionalidades não relacionadas.
- Mantenha responsividade, acessibilidade e SEO.
- JavaScript deve funcionar dentro de um iframe sandbox.
- Não use eval ou document.write.
- Se um arquivo autorizado não precisa mudar, não o retorne.

SKILLS:
${skillText || 'Edição segura'}

SITE SPEC:
${JSON.stringify(specRow?.spec ?? {})}

MEMÓRIA:
${memory || 'Sem memória adicional.'}

PEDIDO:
${userPrompt}

ARQUIVOS:
${targetContext}`

    const generated = await callModel(prompt)
    const rawFiles = Array.isArray(generated.parsed?.files) ? generated.parsed.files : []
    const edits = rawFiles
      .filter((file: any) => allowedPaths.has(file?.path) && plan.targets.includes(file.path) && typeof file?.content === 'string')
      .slice(0, 3)

    if (!edits.length) throw new Error('A IA não retornou uma edição válida.')

    const now = new Date().toISOString()
    const currentMap = new Map(projectFiles.map((file) => [file.path, file]))
    const rows = edits.map((edit: { path: string; content: string }) => ({
      owner_id: ownerId,
      project_id: id,
      path: edit.path,
      content: edit.content,
      language: edit.path.endsWith('.css') ? 'css' : edit.path.endsWith('.js') ? 'javascript' : 'html',
      revision: (currentMap.get(edit.path)?.revision ?? 0) + 1,
      updated_at: now,
    }))

    const { error: saveError } = await supabase.from('project_files').upsert(rows, { onConflict: 'project_id,path' })
    if (saveError) throw saveError

    const { data: savedFiles, error: readError } = await supabase.from('project_files')
      .select('path,content,revision,language').eq('project_id', id).eq('owner_id', ownerId).order('path')
    if (readError) throw readError

    const rendered = renderStaticSite((savedFiles ?? []).map((file) => ({ path: file.path, content: file.content })))
    const quality = analyzeHtmlQuality(rendered)

    const { data: last } = await supabase.from('project_versions').select('version_number')
      .eq('project_id', id).eq('owner_id', ownerId).order('version_number', { ascending: false }).limit(1).maybeSingle()
    const versionNumber = (last?.version_number ?? 0) + 1
    const changedFiles = rows.map((row) => row.path)
    const summary = String(generated.parsed?.summary ?? 'Edição cirúrgica concluída.') +
      ' Arquivos: ' + changedFiles.join(', ') + '. Qualidade ALTIV: ' + quality.score + '/100.'

    const { error: versionError } = await supabase.from('project_versions').insert({
      owner_id: ownerId, project_id: id, version_number: versionNumber,
      source_type: 'snapshot', summary,
      metadata: { source: 'surgical-agent', model: generated.model, files: changedFiles, file_plan: plan, quality_score: quality.score },
    })
    if (versionError) throw versionError

    const { error: snapshotError } = await supabase.from('project_version_files').insert(
      (savedFiles ?? []).map((file) => ({
        owner_id: ownerId, project_id: id, version_number: versionNumber,
        path: file.path, content: file.content,
      }))
    )
    if (snapshotError) throw snapshotError

    let { data: conversation } = await supabase.from('conversations').select('id')
      .eq('owner_id', ownerId).eq('project_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle()

    if (!conversation) {
      const created = await supabase.from('conversations')
        .insert({ owner_id: ownerId, project_id: id, title: userPrompt.slice(0, 80) }).select('id').single()
      conversation = created.data
    }

    if (conversation?.id) {
      await supabase.from('messages').insert([
        { owner_id: ownerId, conversation_id: conversation.id, role: 'user', content: userPrompt },
        { owner_id: ownerId, conversation_id: conversation.id, role: 'assistant', content: summary, model: generated.model },
      ])
    }

    await supabase.from('projects').update({ status: 'ready', updated_at: now }).eq('id', id).eq('owner_id', ownerId)

    const htmlFile = (savedFiles ?? []).find((file) => file.path === 'index.html')
    return NextResponse.json({
      ok: true,
      model: generated.model,
      summary,
      html: rendered,
      revision: htmlFile?.revision ?? 0,
      versionNumber,
      qualityScore: quality.score,
      qualityIssues: quality.issues,
      activeSkills: selectAltivSkills(userPrompt).map((skill) => ({ id: skill.id, label: skill.label })),
      changedFiles,
      filePlan: plan,
      files: savedFiles ?? [],
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha na edição cirúrgica.',
    }, { status: 500 })
  } finally {
    await supabase.rpc('release_project_agent_lock', {
      p_project_id: id, p_owner_id: ownerId, p_token: lockToken,
    })
  }
}
