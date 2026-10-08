import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeHtmlQuality } from '@/lib/agent/quality'
import { planFileTargets, type ProjectFileInfo } from '@/lib/agent/file-intelligence'
import { selectAltivSkills, buildSkillInstructions } from '@/lib/agent/skills'
import { orchestrateRequest, orchestrationInstructions } from '@/lib/agent/orchestrator'
import { renderStaticSite } from '@/lib/project/render'

type EditFile = { path: string; content: string }
type EditResult = { summary: string; files: EditFile[] }

function parseEditResult(text: string, targets: string[]): EditResult {
  const cleaned = text.trim().replace(/^\`\`\`(?:json)?\s*/i, '').replace(/\s*\`\`\`$/i, '')
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
    const path = typeof file.path === 'string' ? file.path : ''
    const fileContent = file.content
    if (targets.includes(path) && typeof fileContent === 'string') {
      files.push({ path, content: fileContent })
    }
  }

  if (!files.length) throw new Error('A IA não retornou arquivos válidos do plano de edição.')
  return { summary, files: files.slice(0, 8) }
}

async function runNvidia(prompt: string, targets: string[]) {
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
          temperature: 0.2,
          top_p: 0.9,
          max_tokens: 12000,
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

function languageFor(path:string) {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') return ext
  if (ext === 'js' || ext === 'jsx') return 'javascript'
  if (ext === 'ts' || ext === 'tsx') return 'typescript'
  if (ext === 'vue') return 'vue'
  if (ext === 'svelte') return 'svelte'
  if (ext === 'astro') return 'astro'
  return ext || 'text'
}

function meaningfulChange(before:string, after:string) {
  if (before === after) return false
  const longest = Math.max(before.length, after.length, 1)
  const lengthDelta = Math.abs(after.length - before.length) / longest
  if (lengthDelta > 0.01) return true
  let changed = 0
  const sample = Math.min(longest, 20000)
  for (let i=0;i<sample;i+=1) if (before[i] !== after[i]) changed += 1
  return changed / Math.max(sample,1) > 0.01
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
  const orchestration = orchestrateRequest(userPrompt, files)
  if (plan.mode === 'full' || !plan.targets.length) {
    return NextResponse.json({ ok: false, fallback: true, plan, orchestration }, { status: 409 })
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
    const targetFiles = files.filter((file) => targets.includes(file.path))
    const context = targetFiles
      .map((file) => 'ARQUIVO ' + file.path + '\n' + file.content.slice(0, 50000))
      .join('\n\n')

    const skills = buildSkillInstructions(userPrompt)
    const aiPrompt = `Você é o editor inteligente do ALTIV DEV. Trabalhe como um time coordenado, não como um gerador de texto solto.

${orchestrationInstructions(orchestration)}

Edite SOMENTE estes arquivos reais do repositório:
${targets.map((item)=>'- ' + item).join('\n')}

Retorne somente JSON válido no formato:
{"summary":"resumo objetivo","files":[{"path":"caminho/exato/do/arquivo","content":"arquivo completo"}]}

REGRAS OBRIGATÓRIAS:
- Preserve tudo fora do pedido.
- Retorne o conteúdo COMPLETO de cada arquivo alterado.
- Use exatamente os caminhos fornecidos.
- Não invente dados comerciais, rotas ou APIs.
- Para mudança de tema/paleta, procure também estilos inline e tokens dentro de componentes, não apenas CSS externo.
- Se o usuário pediu cores específicas, aplique-as de forma visível e coerente em fundo, texto, bordas e CTAs.
- Mantenha responsividade, acessibilidade, SEO e funcionalidades.
- Não declare conclusão sem produzir uma alteração verificável.
- Não use eval nem document.write.
- Se o pedido exigir mídia nova, não invente URL de imagem/vídeo. Preserve espaço semântico para asset e deixe o Media Agent como dependência explícita no resumo.

SKILLS ATIVADAS:
${skills || 'Edição segura'}

PEDIDO:
${userPrompt}

ARQUIVOS:
${context}`

    const generated = await runNvidia(aiPrompt, targets)
    const currentByPath = new Map(files.map((file) => [file.path, file]))
    const changed = generated.result.files.filter((file) => {
      const before = currentByPath.get(file.path)?.content ?? ''
      return meaningfulChange(before, file.content)
    })

    if (!changed.length) {
      throw new Error('A IA respondeu, mas não produziu uma alteração verificável. O ALTIV cancelou a falsa conclusão.')
    }

    if (orchestration.requiresVisualVerification) {
      const visualChanged = changed.some((file)=>/\.(css|scss|sass|less|html|jsx|tsx|vue|svelte|astro)$/i.test(file.path))
      if (!visualChanged) {
        throw new Error('O pedido era visual, mas nenhum arquivo visual foi alterado. Tente novamente com o agente completo.')
      }
    }

    const now = new Date().toISOString()
    const rows = changed.map((file) => ({
      owner_id: ownerId,
      project_id: id,
      path: file.path,
      content: file.content,
      language: languageFor(file.path),
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
        source: 'orchestrated-surgical-agent',
        model: generated.model,
        files: changedFiles,
        file_plan: plan,
        orchestration,
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

    const previewRevision = Math.max(0, ...savedFiles.map((file)=>file.revision))
    return NextResponse.json({
      ok: true,
      model: generated.model,
      summary,
      html: rendered,
      revision: previewRevision,
      versionNumber,
      qualityScore: quality.score,
      qualityIssues: quality.issues,
      activeSkills: selectAltivSkills(userPrompt, 10).map((skill) => ({ id: skill.id, label: skill.label })),
      orchestration,
      changedFiles,
      filePlan: plan,
      files: savedFiles,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : 'Falha na edição inteligente.',
    }, { status: 500 })
  } finally {
    await supabase.rpc('release_project_agent_lock', {
      p_project_id: id,
      p_owner_id: ownerId,
      p_token: lockToken,
    })
  }
}
