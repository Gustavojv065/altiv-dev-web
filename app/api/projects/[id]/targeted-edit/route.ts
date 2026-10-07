import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeHtmlQuality } from '@/lib/agent/quality'
import { planFileTargets, type ProjectFileInfo } from '@/lib/agent/file-intelligence'
import { selectAltivSkills, buildSkillInstructions } from '@/lib/agent/skills'
import { renderStaticSite } from '@/lib/project/render'

type EditablePath = 'index.html' | 'styles.css' | 'script.js'
type EditFile = { path: EditablePath; content: string }
type EditResult = { summary: string; files: EditFile[] }

function parseEditResult(text: string, targets: EditablePath[]): EditResult {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('Resposta JSON inválida.')

  const raw: unknown = JSON.parse(cleaned.slice(start, end + 1))
  if (!raw || typeof raw !== 'object') throw new Error('Resposta inválida.')
  const object = raw as Record<string, unknown>
  const summary = typeof object.summary === 'string' ? object.summary : 'Edição concluída.'
  const rawFiles = Array.isArray(object.files) ? object.files : []

  const files: EditFile[] = []
  for (const item of rawFiles) {
    if (!item || typeof item !== 'object') continue
    const file = item as Record<string, unknown>
    const path = file.path
    const fileContent = file.content
    if (
      (path === 'index.html' || path === 'styles.css' || path === 'script.js') &&
      targets.includes(path) &&
      typeof fileContent === 'string'
    ) {
      files.push({ path, content: fileContent })
    }
  }

  if (!files.length) throw new Error('A IA não retornou arquivos válidos.')
  return { summary, files: files.slice(0, 3) }
}

async function runNvidia(prompt: string, targets: EditablePath[]) {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY não configurada.')

  const models = [
    { id: 'nvidia/nemotron-3-super-120b-a12b', timeoutMs: 140000 },
    { id: 'nvidia/nemotron-3.5-lightning-30b-a3b', timeoutMs: 65000 },
  ]
  const errors: string[] = []

  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), model.timeoutMs)

    try {
      const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: 'Bearer ' + apiKey,
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

      if (!response.ok) throw new Error('NVIDIA HTTP ' + response.status)
      const payload: unknown = await response.json()
      const data = payload as { choices?: Array<{ message?: { content?: string } }> }
      const text = data.choices?.[0]?.message?.content ?? ''
      return { model: model.id, result: parseEditResult(text, targets) }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    } finally {
      clearTimeout(timer)
    }
  }

  throw new Error('Falha na edição: ' + errors.join(' | '))
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
  if (!auth?.claims?.sub) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }
  const ownerId = String(auth.claims.sub)

  const { data: project } = await supabase.from('projects')
    .select('id').eq('id', id).eq('owner_id', ownerId).maybeSingle()
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })

  const { data: fileRows, error: filesError } = await supabase.from('project_files')
    .select('path,content,revision,language').eq('project_id', id).eq('owner_id', ownerId).order('path')
  if (filesError) return NextResponse.json({ ok: false, error: filesError.message }, { status: 500 })

  const files: ProjectFileInfo[] = (fileRows ?? []).map((file) => ({
    path: String(file.path),
    content: String(file.content ?? ''),
    revision: Number(file.revision ?? 0),
    language: String(file.language ?? 'text'),
  }))

  const plan = planFileTargets(userPrompt, files)
  if (plan.mode === 'full') {
    return NextResponse.json({ ok: false, fallback: true, plan }, { status: 409 })
  }

  const targets = plan.targets
  const { data: lockToken } = await supabase.rpc('acquire_project_agent_lock', {
    p_project_id: id,
    p_owner_id: ownerId,
    p_ttl_seconds: 300,
  })
  if (!lockToken) {
    return NextResponse.json({ ok: false, error: 'Já existe uma edição ativa neste projeto.' }, { status: 409 })
  }

  try {
    const context = files
      .filter((file) => targets.includes(file.path as EditablePath))
      .map((file) => 'ARQUIVO ' + file.path + '\n' + file.content.slice(0, 50000))
      .join('\n\n')

    const skills = buildSkillInstructions(userPrompt)
    const aiPrompt = `Você é o editor cirúrgico do ALTIV DEV.

Edite somente: ${targets.join(', ')}.
Retorne somente JSON válido no formato:
{"summary":"resumo","files":[{"path":"styles.css","content":"arquivo completo"}]}

Regras:
- Preserve tudo fora do pedido.
- Retorne o conteúdo COMPLETO de cada arquivo alterado.
- Não invente dados comerciais.
- Mantenha responsividade, acessibilidade e SEO.
- JavaScript deve funcionar em iframe sandbox.
- Não use eval nem document.write.

SKILLS:
${skills || 'Edição segura'}

PEDIDO:
${userPrompt}

ARQUIVOS:
${context}`

    const generated = await runNvidia(aiPrompt, targets)
    const now = new Date().toISOString()
    const currentByPath = new Map(files.map((file) => [file.path, file]))

    const rows = generated.result.files.map((file) => ({
      owner_id: ownerId,
      project_id: id,
      path: file.path,
      content: file.content,
      language: file.path.endsWith('.css') ? 'css' : file.path.endsWith('.js') ? 'javascript' : 'html',
      revision: (currentByPath.get(file.path)?.revision ?? 0) + 1,
      updated_at: now,
    }))

    const { error: saveError } = await supabase.from('project_files')
      .upsert(rows, { onConflict: 'project_id,path' })
    if (saveError) throw saveError

    const { data: savedRows, error: savedError } = await supabase.from('project_files')
      .select('path,content,revision,language').eq('project_id', id).eq('owner_id', ownerId).order('path')
    if (savedError) throw savedError

    const savedFiles: ProjectFileInfo[] = (savedRows ?? []).map((file) => ({
      path: String(file.path),
      content: String(file.content ?? ''),
      revision: Number(file.revision ?? 0),
      language: String(file.language ?? 'text'),
    }))

    const rendered = renderStaticSite(savedFiles)
    const quality = analyzeHtmlQuality(rendered)

    const { data: lastVersion } = await supabase.from('project_versions')
      .select('version_number').eq('project_id', id).eq('owner_id', ownerId)
      .order('version_number', { ascending: false }).limit(1).maybeSingle()

    const versionNumber = Number(lastVersion?.version_number ?? 0) + 1
    const changedFiles = rows.map((row) => row.path)
    const summary = generated.result.summary + ' Arquivos: ' + changedFiles.join(', ') +
      '. Qualidade ALTIV: ' + quality.score + '/100.'

    const { error: versionError } = await supabase.from('project_versions').insert({
      owner_id: ownerId,
      project_id: id,
      version_number: versionNumber,
      source_type: 'snapshot',
      summary,
      metadata: {
        source: 'surgical-agent',
        model: generated.model,
        files: changedFiles,
        file_plan: plan,
        quality_score: quality.score,
      },
    })
    if (versionError) throw versionError

    const { error: snapshotError } = await supabase.from('project_version_files').insert(
      savedFiles.map((file) => ({
        owner_id: ownerId,
        project_id: id,
        version_number: versionNumber,
        path: file.path,
        content: file.content,
      }))
    )
    if (snapshotError) throw snapshotError

    await supabase.from('projects').update({ status: 'ready', updated_at: now })
      .eq('id', id).eq('owner_id', ownerId)

    const htmlFile = savedFiles.find((file) => file.path === 'index.html')
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
      files: savedFiles,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha na edição cirúrgica.',
    }, { status: 500 })
  } finally {
    await supabase.rpc('release_project_agent_lock', {
      p_project_id: id,
      p_owner_id: ownerId,
      p_token: lockToken,
    })
  }
}
