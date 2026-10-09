'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { previewEntries, renderStaticSite } from '@/lib/project/render'
import { detectProjectRuntime } from '@/lib/project/runtime'
import StudioConnectionsPanel from '@/components/StudioConnectionsPanel'

type AgentResponse = {
  ok: boolean
  runId?: string
  model?: string
  summary?: string
  html?: string
  revision?: number
  versionNumber?: number
  qualityScore?: number
  qualityIssues?: string[]
  nicheAlignmentScore?: number
  niche?: { id:string; label:string }
  mediaJobs?: Array<{kind:string;status?:string;outputUrl?:string}>
  activeSkills?: Array<{ id: string; label: string }>
  changedFiles?: string[]
  filePlan?: { mode: 'targeted' | 'full'; targets: string[]; reason: string }
  orchestration?: { intent:string; roles:string[]; needsMedia:boolean; mediaKinds:string[]; requestedPalette:string[] }
  files?: ProjectFile[]
  error?: string
}

type ChatMessage = {
  id: string
  role: string
  content: string
  model: string | null
  created_at: string
}

type Version = {
  id: string
  version_number: number
  summary: string | null
  created_at: string
  metadata?: Record<string, unknown> | null
}

type Panel = 'chat' | 'files' | 'code' | 'versions' | 'github' | 'ai'
type Device = 'desktop' | 'tablet' | 'mobile'
type ProjectFile = { path: string; content: string; revision: number; language: string }
type ServerRunState = {
  active:boolean
  run?: { id:string; status:string; prompt?:string; model?:string|null; error?:string|null; currentStep?:string|null } | null
}

function timeLabel(value: string) {
  try {
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  } catch {
    return ''
  }
}

export default function StudioClient({
  projectId,
  projectName,
  projectStatus,
  initialHtml,
  initialRevision,
  initialMessages,
  initialVersions,
}: {
  projectId: string
  projectName: string
  projectStatus: string
  initialHtml: string
  initialRevision: number
  initialMessages: ChatMessage[]
  initialVersions: Version[]
}) {
  const [prompt, setPrompt] = useState('')
  const [menuExpanded, setMenuExpanded] = useState(true)
  const [mobileView, setMobileView] = useState<'chat' | 'preview'>('chat')
  const [running, setRunning] = useState(false)
  const [device, setDevice] = useState<Device>('desktop')
  const [panel, setPanel] = useState<Panel>('chat')
  const [previewHtml, setPreviewHtml] = useState(initialHtml)
  const [revision, setRevision] = useState(initialRevision)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [versions, setVersions] = useState<Version[]>(initialVersions)
  const [result, setResult] = useState<AgentResponse | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [restoring, setRestoring] = useState<number | null>(null)
  const [codeDraft, setCodeDraft] = useState(initialHtml)
  const [files, setFiles] = useState<ProjectFile[]>([{ path: 'index.html', content: initialHtml, revision: initialRevision, language: 'html' }])
  const [selectedPath, setSelectedPath] = useState('index.html')
  const [savingCode, setSavingCode] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [pushingGitHub, setPushingGitHub] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const [healthScore, setHealthScore] = useState<number | null>(null)
  const [checkingHealth, setCheckingHealth] = useState(false)
  const [previewEntry, setPreviewEntry] = useState('index.html')
  const previewPages = useMemo(() => previewEntries(files), [files])
  const runtime = useMemo(() => detectProjectRuntime(files), [files])
  const renderedHtml = useMemo(() => renderStaticSite(files, previewEntry), [files, previewEntry])
  const feedRef = useRef<HTMLDivElement>(null)
  const serverRunWasActive = useRef(false)
  const [serverRun,setServerRun] = useState<ServerRunState>({active:false})

  const status = useMemo(() => {
    if (running) return 'Gerando alteração…'
    if (previewHtml) return 'Pronto'
    return projectStatus === 'draft' ? 'Aguardando primeiro pedido' : projectStatus
  }, [running, previewHtml, projectStatus])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [messages, running, result])

  useEffect(() => {
    if (selectedPath === 'index.html') {
      setCodeDraft(previewHtml)
      setFiles((old) => old.map((file) => file.path === 'index.html'
        ? { ...file, content: previewHtml, revision } : file))
    }
  }, [previewHtml, revision, selectedPath])

  useEffect(() => {
    let active = true
    fetch('/api/projects/' + projectId + '/files', { cache: 'no-store' })
      .then((response) => response.json())
      .then((data) => {
        if (active && data.ok && Array.isArray(data.files)) setFiles(data.files)
      })
      .catch(() => {})
    return () => { active = false }
  }, [projectId])

  function selectFile(path: string) {
    const file = files.find((item) => item.path === path)
    if (!file) return
    setSelectedPath(path)
    setCodeDraft(file.content)
    setPanel('code')
  }

  useEffect(() => {
    let stopped = false

    const syncPreview = async () => {
      try {
        const response = await fetch('/api/projects/' + projectId + '/preview', { cache:'no-store' })
        const data = await response.json()
        if (stopped || !data?.ok) return
        const nextRevision = Number(data.revision ?? 0)
        if (data.html && (nextRevision > revision || !previewHtml)) {
          setPreviewHtml(data.html)
          setRevision(nextRevision)
          setRefreshKey((v)=>v+1)
        }
      } catch {}
    }

    const pollRun = async () => {
      try {
        const response = await fetch('/api/projects/' + projectId + '/run-status', { cache:'no-store' })
        const data = await response.json()
        if (stopped || !data?.ok) return

        const active = Boolean(data.active)
        setServerRun({ active, run:data.run ?? null })

        if (active) {
          serverRunWasActive.current = true
          setRunning(true)
          await syncPreview()
          return
        }

        if (serverRunWasActive.current) {
          serverRunWasActive.current = false
          setRunning(false)
          await syncPreview()
          const filesResponse = await fetch('/api/projects/' + projectId + '/files', { cache:'no-store' })
          const filesData = await filesResponse.json()
          if (!stopped && filesData?.ok && Array.isArray(filesData.files)) setFiles(filesData.files)
          window.setTimeout(()=>window.location.reload(),350)
        } else if (!running) {
          await syncPreview()
        }
      } catch {}
    }

    pollRun()
    const timer = window.setInterval(pollRun,3000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [projectId, revision, previewHtml, running])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = prompt.trim()
    if (!value || running || serverRun.active) return

    const optimistic: ChatMessage = {
      id: 'local-' + Date.now(),
      role: 'user',
      content: value,
      model: null,
      created_at: new Date().toISOString(),
    }

    setMessages((current) => [...current, optimistic])
    setPrompt('')
    setRunning(true)
    setResult(null)
    setPanel('chat')

    let followExistingRun = false
    try {
      let response = await fetch('/api/projects/' + projectId + '/targeted-edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value }),
      })
      let data: AgentResponse & { fallback?: boolean } = await response.json()

      if (response.status === 409 && data.fallback) {
        response = await fetch('/api/agent', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: value, projectId }),
        })
        data = await response.json()
      }

      if (response.status === 409 && (data as AgentResponse & {locked?:boolean}).locked) {
        followExistingRun = true
        serverRunWasActive.current = true
        setServerRun({active:true})
        setResult({
          ok:true,
          summary:'Já existe uma execução em andamento. O ALTIV está acompanhando o processo atual e atualizará o preview automaticamente quando terminar.',
        })
        return
      }

      setResult(data)

      if (data.ok) {
        if (data.html) {
          setPreviewHtml(data.html)
          setRevision(data.revision ?? revision + 1)
          if (Array.isArray(data.files)) {
            setFiles(data.files)
            const selected = data.files.find((file) => file.path === selectedPath)
            if (selected) setCodeDraft(selected.content)
          }
          setRefreshKey((v) => v + 1)
        }

        if (data.summary) {
          setMessages((current) => [
            ...current,
            {
              id: 'assistant-' + Date.now(),
              role: 'assistant',
              content: data.summary!,
              model: data.model ?? null,
              created_at: new Date().toISOString(),
            },
          ])
        }

        if (data.versionNumber) {
          setVersions((current) => [
            {
              id: 'version-' + Date.now(),
              version_number: data.versionNumber!,
              summary: data.summary ?? 'Alteração gerada pela IA',
              created_at: new Date().toISOString(),
              metadata: { model: data.model },
            },
            ...current.filter((v) => v.version_number !== data.versionNumber),
          ])
        }
      }
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha de rede.' })
    } finally {
      setRunning(followExistingRun)
    }
  }

  async function restoreVersion(versionNumber: number) {
    if (running || restoring) return
    setRestoring(versionNumber)
    setResult(null)

    try {
      const response = await fetch('/api/projects/' + projectId + '/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ versionNumber }),
      })
      const data = await response.json()

      if (!response.ok || !data?.ok) {
        setResult({ ok: false, error: data?.error ?? 'Não foi possível restaurar a versão.' })
        return
      }

      setPreviewHtml(data.html)
      setRevision(Number(data.revision))
      if (Array.isArray(data.files)) setFiles(data.files)
      setRefreshKey((v) => v + 1)
      setPanel('chat')
      setMessages((current) => [
        ...current,
        {
          id: 'restore-' + Date.now(),
          role: 'assistant',
          content: 'Versão r' + versionNumber + ' restaurada no preview.',
          model: null,
          created_at: new Date().toISOString(),
        },
      ])
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha ao restaurar versão.' })
    } finally {
      setRestoring(null)
    }
  }

  async function saveCode() {
    if (savingCode || (selectedPath === 'index.html' && !codeDraft.trim())) return
    setSavingCode(true)
    setResult(null)
    try {
      const isHtml = selectedPath === 'index.html'
      const response = await fetch('/api/projects/' + projectId + (isHtml ? '/code' : '/file-save'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(isHtml ? { html: codeDraft } : { path: selectedPath, content: codeDraft }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setResult({ ok: false, error: data?.error ?? 'Não foi possível salvar.' })
        return
      }
      setFiles((old) => old.map((file) => file.path === selectedPath
        ? { ...file, content: codeDraft, revision: Number(data.revision) } : file))
      if (!isHtml && data.versionNumber) {
        setVersions((old) => [{
          id: 'asset-' + Date.now(), version_number: Number(data.versionNumber),
          summary: 'Edição manual de ' + selectedPath, created_at: new Date().toISOString(),
        }, ...old])
      }
      if (isHtml) {
        setPreviewHtml(data.html)
        setRevision(Number(data.revision))
        setVersions((old) => [{
          id: 'manual-' + Date.now(), version_number: Number(data.versionNumber),
          summary: 'Edição manual do código', created_at: new Date().toISOString(),
        }, ...old])
      }
      setRefreshKey((value) => value + 1)
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha ao salvar.' })
    } finally {
      setSavingCode(false)
    }
  }

  function openPreview() {
    if (!previewHtml) return
    const blob = new Blob([renderedHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }

  async function checkHealth() {
    if (checkingHealth) return
    setCheckingHealth(true)
    try {
      const response = await fetch('/api/projects/' + projectId + '/health', { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setResult({ ok: false, error: data?.error ?? 'Não foi possível analisar o projeto.' })
        return
      }

      setHealthScore(Number(data.quality?.score ?? 0))
      const securityFindings = Array.isArray(data.security?.findings) ? data.security.findings : []
      setResult({
        ok: true,
        summary: 'QA do projeto: ' + Number(data.quality?.score ?? 0) + '/100. ' +
          ((data.quality?.issues ?? []).slice(0, 3).join(' · ') || 'Nenhum problema importante encontrado.') +
          (securityFindings.length ? ' · Segurança: ' + securityFindings.length + ' alerta(s): ' + securityFindings.slice(0, 2).map((item: {rule:string;file:string}) => item.rule + ' em ' + item.file).join(', ') : ' · Segurança estática: sem alertas nas regras básicas.'),
        qualityScore: Number(data.quality?.score ?? 0),
        qualityIssues: data.quality?.issues ?? [],
      })
      setPanel('chat')
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha no QA.' })
    } finally {
      setCheckingHealth(false)
    }
  }

  async function pushToGitHub() {
    if (pushingGitHub) return
    const confirmed = window.confirm('Confirmar envio? O ALTIV vai criar uma branch, commit e Pull Request no GitHub. A main não será alterada diretamente.')
    if (!confirmed) return
    setPushingGitHub(true)
    setResult(null)
    try {
      const response = await fetch('/api/projects/' + projectId + '/github/push', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ message:'Atualização do projeto ' + projectName }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setResult({ok:false,error:data?.error ?? 'Não foi possível criar o PR no GitHub.'})
        return
      }

      const prUrl = data.pullRequest?.html_url as string | undefined
      setMessages((current) => [...current,{
        id:'github-' + Date.now(),
        role:'assistant',
        content:'Alterações enviadas para a branch ' + data.branch + (prUrl ? ' e PR criado no GitHub.' : '.'),
        model:null,
        created_at:new Date().toISOString(),
      }])
      if (prUrl) window.open(prUrl,'_blank','noopener,noreferrer')
    } catch (error) {
      setResult({ok:false,error:error instanceof Error ? error.message : 'Falha ao enviar para GitHub.'})
    } finally {
      setPushingGitHub(false)
    }
  }

  async function publishProject() {
    if (publishing || !previewHtml) return
    setPublishing(true)
    setResult(null)
    try {
      const response = await fetch('/api/projects/' + projectId + '/publish', { method: 'POST' })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setResult({ ok: false, error: data?.error ?? 'Não foi possível publicar.' })
        return
      }

      const url = data.url as string
      setPublishedUrl(url)
      setMessages((current) => [
        ...current,
        {
          id: 'publish-' + Date.now(),
          role: 'assistant',
          content: 'Projeto publicado com sucesso.',
          model: null,
          created_at: new Date().toISOString(),
        },
      ])
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha ao publicar.' })
    } finally {
      setPublishing(false)
    }
  }

  const deviceClass = 'previewViewport ' + device

  return (
    <main className={`studioShell altivGoogleStudio ${menuExpanded ? "altivMenuExpanded" : ""} altivMobileView-${mobileView}`}>
      <aside className="studioRail" aria-label="Menu principal do ALTIV DEV">
        <button type="button" className="altivMenuToggle" onClick={() => setMenuExpanded(value => !value)} aria-expanded={menuExpanded} title="Expandir ou recolher menus">☰ <span>Menus</span></button>
        <a className="railLogo" href="/workspace" title="ALTIV DEV">A</a>
        <div className="railNav">
          <button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')} title="Chat"><span>✦</span><small>Chat</small></button>
          <button className={panel === 'files' ? 'active' : ''} onClick={() => setPanel('files')} title="Arquivos"><span>▤</span><small>Arquivos</small></button>
          <button className={panel === 'code' ? 'active' : ''} onClick={() => setPanel('code')} title="Código"><span>&lt;/&gt;</span><small>Código</small></button>
          <button className={panel === 'versions' ? 'active' : ''} onClick={() => setPanel('versions')} title="Versões"><span>▱</span><small>Versões</small></button>
          <button className={panel === 'github' ? 'active' : ''} onClick={() => setPanel('github')} title="GitHub"><span>Git</span><small>GitHub</small></button>
          <button className={panel === 'ai' ? 'active' : ''} onClick={() => setPanel('ai')} title="APIs e modelos"><span>AI</span><small>APIs</small></button>
          <a href={'/studio/' + projectId + '/media'} title="AI Mídia"><span>◈</span><small>Mídia</small></a>
        </div>
        <a className="railBack" href="/workspace" title="Projetos">←</a>
      </aside>

      <section className="studioPanel" id="altiv-chat-panel">
        <div className="studioProjectHead">
          <div className="projectIdentity">
            <span className="projectDot" />
            <div>
              <strong>{projectName}</strong>
              <small>{status}{revision ? ' · revisão ' + revision : ''}</small>
            </div>
          </div>
          <div className="panelTabs">
            <button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')}>Construir</button>
            <button className={panel === 'versions' ? 'active' : ''} onClick={() => setPanel('versions')}>Histórico</button>
          </div>
        </div>

        {panel === 'chat' && (
          <>
            <div className="chatFeed" ref={feedRef}>
              {messages.length === 0 ? (
                <div className="chatWelcome">
                  <span className="welcomeMark">✦</span>
                  <h1>O que vamos construir?</h1>
                  <p>Descreva o site ou a alteração. O ALTIV gera o código, salva uma versão e atualiza o preview.</p>
                  <div className="promptSuggestions">
                    <button onClick={() => setPrompt('Crie uma landing page premium e responsiva com hero forte, serviços, depoimentos, FAQ e contato.')}>Landing page premium</button>
                    <button onClick={() => setPrompt('Melhore o design do site atual sem remover conteúdo. Deixe mais moderno, elegante e responsivo.')}>Melhorar design</button>
                    <button onClick={() => setPrompt('Revise o site atual e corrija responsividade, acessibilidade, hierarquia visual e usabilidade.')}>Revisar projeto</button>
                  </div>
                </div>
              ) : (
                <div className="messageStack">
                  {messages.map((message) => (
                    <article className={'messageBubble ' + message.role} key={message.id}>
                      <div className="messageMeta">
                        <span>{message.role === 'user' ? 'Você' : 'ALTIV'}</span>
                        <time>{timeLabel(message.created_at)}</time>
                      </div>
                      <p>{message.content}</p>
                      {message.model && <small>{message.model}</small>}
                    </article>
                  ))}
                  {running && (
                    <article className="messageBubble assistant working">
                      <div className="messageMeta"><span>ALTIV</span><span className="liveDot">gerando</span></div>
                      <div className="workingLine"><i/><i/><i/> {serverRun.run?.currentStep ? 'Etapa: ' + serverRun.run.currentStep + '…' : 'Gerando e salvando a próxima versão…'}</div>
                    </article>
                  )}
                  {result?.orchestration?.roles?.length ? (
                    <article className="messageBubble assistant">
                      <div className="messageMeta"><span>Orquestrador</span><span>{result.orchestration.intent}</span></div>
                      <p>{result.orchestration.roles.join(' → ')}{result.orchestration.needsMedia ? ' · mídia: ' + result.orchestration.mediaKinds.join(', ') : ''}</p>
                    </article>
                  ) : null}
                  {result?.activeSkills?.length ? (
                    <article className="messageBubble assistant">
                      <div className="messageMeta"><span>Skills utilizadas</span></div>
                      <p>{result.activeSkills.map((skill) => skill.label).join(' · ')}</p>
                    </article>
                  ) : null}
                  {result?.changedFiles?.length ? (
                    <article className="messageBubble assistant">
                      <div className="messageMeta"><span>Edição inteligente</span><span>{result.filePlan?.mode === 'targeted' ? 'cirúrgica' : 'completa'}</span></div>
                      <p>Arquivos alterados: {result.changedFiles.join(' · ')}</p>
                    </article>
                  ) : null}
                  {result?.qualityScore !== undefined && result.ok && (
                    <article className="messageBubble quality">
                      <div className="messageMeta"><span>Quality Gate</span><span>{result.qualityScore}/100</span></div>
                      <p>
                        {result.qualityScore >= 88 ? 'Aprovado pelo QA automático do ALTIV.' : 'Resultado salvo com pontos de melhoria identificados.'}
                        {result.nicheAlignmentScore !== undefined ? ' Aderência ao nicho: ' + result.nicheAlignmentScore + '/100.' : ''}
                        {result.niche?.label ? ' Nicho: ' + result.niche.label + '.' : ''}
                      </p>
                    </article>
                  )}
                  {result?.mediaJobs?.length ? (
                    <article className="messageBubble assistant">
                      <div className="messageMeta"><span>Media Agent</span></div>
                      <p>{result.mediaJobs.map((job)=>job.kind + ': ' + (job.outputUrl ? 'pronto' : job.status || 'pendente')).join(' · ')}</p>
                    </article>
                  ) : null}
                  {result?.error && (
                    <article className="messageBubble error">
                      <div className="messageMeta"><span>Erro</span></div>
                      <p>{result.error}</p>
                    </article>
                  )}
                </div>
              )}
            </div>

            <form className="lovableComposer" onSubmit={submit}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={previewHtml ? 'Peça uma alteração no site…' : 'Descreva o site que você quer criar…'}
              />
              <div className="composerBar">
                <div className="composerTools">
                  <button type="button" title="Anexos">＋</button>
                  <span>ALTIV Agent</span>
                  {revision > 0 && <span>r{revision}</span>}
                </div>
                <button className="buildButton" disabled={running || !prompt.trim()}>
                  {running ? 'Orquestrando…' : 'Construir ↑'}
                </button>
              </div>
            </form>
          </>
        )}

        {panel === 'github' && <StudioConnectionsPanel mode="github" />}

        {panel === 'ai' && <StudioConnectionsPanel mode="ai" />}

        {panel === 'files' && (
          <div className="sideContent">
            <div className="sideIntro"><h2>Arquivos</h2><p>Arquivos reais do projeto. Selecione um para editar.</p></div>
            {files.map((file) => (
              <button className="fileRow" key={file.path} onClick={() => selectFile(file.path)}>
                <span>◇</span>
                <div><strong>{file.path}</strong><small>{file.language} · revisão {file.revision}</small></div>
                <em>{Math.round(file.content.length / 1024)} KB</em>
              </button>
            ))}
          </div>
        )}

        {panel === 'code' && (
          <div className="sideContent codeEditorPanel">
            <div className="sideIntro">
              <h2>Código</h2>
              <p>Escolha o arquivo e salve alterações diretamente no projeto.</p>
            </div>
            <div className="codeEditorHead">
              <select value={selectedPath} onChange={(event) => selectFile(event.target.value)}>
                {files.map((file) => <option value={file.path} key={file.path}>{file.path}</option>)}
              </select>
              <button onClick={saveCode} disabled={savingCode}>
                {savingCode ? 'Salvando…' : 'Salvar arquivo'}
              </button>
            </div>
            <textarea className="fullCodeEditor" value={codeDraft}
              onChange={(event) => setCodeDraft(event.target.value)} spellCheck={false} />
          </div>
        )}

        {panel === 'versions' && (
          <div className="sideContent">
            <div className="sideIntro"><h2>Versões</h2><p>Cada geração salva uma revisão no Supabase.</p></div>
            <div className="versionList">
              {versions.length === 0 ? <div className="emptyMini">Nenhuma versão criada ainda.</div> : versions.map((version) => (
                <article className="versionCard" key={version.id}>
                  <div><span className="versionBadge">r{version.version_number}</span><time>{new Date(version.created_at).toLocaleString('pt-BR')}</time></div>
                  <p>{version.summary || 'Alteração salva'}</p>
                  <button className="restoreBtn" onClick={() => restoreVersion(version.version_number)} disabled={restoring !== null}>
                    {restoring === version.version_number ? 'Restaurando…' : 'Restaurar esta versão'}
                  </button>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="studioPreview" id="altiv-preview-panel">
        <header className="previewToolbar lovableTopbar">
          <div className="topbarLeft">
            <div className="altivMobileSwitch"><button type="button" onClick={() => setMobileView("chat")}>Chat</button><button type="button" onClick={() => setMobileView("preview")}>Preview</button></div>
            <button className="topIcon" onClick={() => setPanel('chat')} title="Construir">☰</button>
            <span className="topProject">{projectName}</span><span className="runtimeBadge" title={runtime.reason}>{runtime.label}</span>
          </div>

          <div className="topbarCenter">
            <button className="topIcon" onClick={() => setPanel("chat")} title="Chat">Chat</button>
            <button className="topIcon" onClick={() => setPanel("versions")} title="Versões">Versões</button>
            <button className="topIcon" onClick={() => setPanel("github")} title="GitHub">GitHub</button>
            <a className="topIcon altivTopLink" href="/integrations" title="Integrações">Integrações</a>
            <button className="topIcon" onClick={() => setPanel("ai")} title="Configurações de IA">⚙</button>
            <button className="viewTab active" title="Site/Preview">◎ <span>Site</span></button>
            <button className={panel === 'files' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('files')} title="Arquivos">▤</button>
            <button className={panel === 'code' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('code')} title="Código">&lt;/&gt;</button>
            <button className={panel === 'versions' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('versions')} title="Versões">▱</button>
            <button className={device === 'desktop' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('desktop')} title="Desktop">▱</button>
            <button className={device === 'tablet' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('tablet')} title="Tablet">▯</button>
            <button className={device === 'mobile' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('mobile')} title="Mobile">▯</button>
            <button className="topIcon" onClick={() => setRefreshKey((v) => v + 1)} title="Recarregar preview">↻</button>
            <button className="topIcon qaButton" onClick={checkHealth} disabled={checkingHealth} title="QA do projeto">
              {checkingHealth ? '…' : healthScore !== null ? 'QA ' + healthScore : 'QA'}
            </button>
            {previewPages.length > 0 ? (
              <select className="pageSelectBtn" value={previewEntry} onChange={(event) => { setPreviewEntry(event.target.value); setRefreshKey((v)=>v+1) }} title="Página do preview">
                {previewPages.map((page)=><option key={page} value={page}>{page === 'index.html' ? 'Página inicial' : page}</option>)}
              </select>
            ) : <button className="pageSelectBtn" type="button" disabled>Página inicial</button>}
          </div>

          <div className="topbarRight">
            <button className="topIcon" onClick={openPreview} disabled={!previewHtml} title="Abrir preview em nova aba">↗</button>
            {publishedUrl && <a className="topIcon publishedLink" href={publishedUrl} target="_blank" rel="noreferrer" title="Abrir site publicado">●</a>}
            <button className="topIcon qaButton" onClick={pushToGitHub} disabled={pushingGitHub} title="Revisar e criar branch/commit/PR no GitHub">
              {pushingGitHub ? '…' : 'Git'}
            </button>
            <button className="publishBtn" onClick={publishProject} disabled={publishing || !previewHtml}>
              {publishing ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </header>

        <div className={'previewStage fill-' + device}>
          <div className={deviceClass}>
            {previewHtml || renderedHtml ? (
              <iframe
                key={refreshKey}
                title="ALTIV Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                srcDoc={renderedHtml || previewHtml}
              />
            ) : (
              <div className="previewEmpty">
                <div className="emptyBrowser">
                  <div className="emptyDots"><i/><i/><i/></div>
                  <span>altiv-preview</span>
                </div>
                <div className="emptyBody">
                  <span>✦</span>
                  <h2>{running || serverRun.active ? 'ALTIV está construindo seu site' : 'Seu site vai aparecer aqui'}</h2>
                  <p>{running || serverRun.active
                    ? 'A geração continua no servidor mesmo se você atualizar ou minimizar a tela. O preview será sincronizado automaticamente quando a versão ficar pronta.'
                    : runtime.previewMode === 'runtime'
                      ? runtime.reason + ' O ALTIV detectou a stack e precisa de runtime isolado para um preview fiel.'
                      : 'Use o chat à esquerda para criar a primeira versão.'}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
