'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

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

type Panel = 'chat' | 'files' | 'code' | 'versions'
type Device = 'desktop' | 'tablet' | 'mobile'

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
  const [savingCode, setSavingCode] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)

  const status = useMemo(() => {
    if (running) return 'Gerando alteração…'
    if (previewHtml) return 'Pronto'
    return projectStatus === 'draft' ? 'Aguardando primeiro pedido' : projectStatus
  }, [running, previewHtml, projectStatus])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  }, [messages, running, result])

  useEffect(() => {
    setCodeDraft(previewHtml)
  }, [previewHtml])

  useEffect(() => {
    if (!running) return

    let stopped = false
    const poll = async () => {
      try {
        const response = await fetch('/api/projects/' + projectId + '/preview', { cache: 'no-store' })
        const data = await response.json()
        if (!stopped && data?.ok && Number(data.revision ?? 0) > revision && data.html) {
          setPreviewHtml(data.html)
          setRevision(Number(data.revision))
          setRefreshKey((v) => v + 1)
        }
      } catch {}
    }

    poll()
    const timer = window.setInterval(poll, 4000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [running, projectId, revision])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = prompt.trim()
    if (!value || running) return

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

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value, projectId }),
      })
      const data: AgentResponse = await response.json()
      setResult(data)

      if (data.ok) {
        if (data.html) {
          setPreviewHtml(data.html)
          setRevision(data.revision ?? revision + 1)
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
      setRunning(false)
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
    if (savingCode || !codeDraft.trim()) return
    setSavingCode(true)
    setResult(null)
    try {
      const response = await fetch('/api/projects/' + projectId + '/code', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ html: codeDraft }),
      })
      const data = await response.json()
      if (!response.ok || !data?.ok) {
        setResult({ ok: false, error: data?.error ?? 'Não foi possível salvar o código.' })
        return
      }

      setPreviewHtml(data.html)
      setRevision(Number(data.revision))
      setRefreshKey((v) => v + 1)
      setVersions((current) => [
        {
          id: 'manual-' + Date.now(),
          version_number: Number(data.versionNumber),
          summary: 'Edição manual do código',
          created_at: new Date().toISOString(),
          metadata: { source: 'code-editor' },
        },
        ...current,
      ])
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha ao salvar código.' })
    } finally {
      setSavingCode(false)
    }
  }

  function openPreview() {
    if (!previewHtml) return
    const blob = new Blob([previewHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank', 'noopener,noreferrer')
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
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
    <main className="studioShell">
      <aside className="studioRail">
        <a className="railLogo" href="/workspace" title="ALTIV DEV">A</a>
        <div className="railNav">
          <button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')} title="Chat"><span>✦</span><small>Chat</small></button>
          <button className={panel === 'files' ? 'active' : ''} onClick={() => setPanel('files')} title="Arquivos"><span>▤</span><small>Arquivos</small></button>
          <button className={panel === 'code' ? 'active' : ''} onClick={() => setPanel('code')} title="Código"><span>&lt;/&gt;</span><small>Código</small></button>
          <button className={panel === 'versions' ? 'active' : ''} onClick={() => setPanel('versions')} title="Versões"><span>▱</span><small>Versões</small></button>
        </div>
        <a className="railBack" href="/workspace" title="Projetos">←</a>
      </aside>

      <section className="studioPanel">
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
                      <div className="workingLine"><i/><i/><i/> Gerando e salvando a próxima versão…</div>
                    </article>
                  )}
                  {result?.qualityScore !== undefined && result.ok && (
                    <article className="messageBubble quality">
                      <div className="messageMeta"><span>Quality Gate</span><span>{result.qualityScore}/100</span></div>
                      <p>{result.qualityScore >= 84 ? 'Aprovado pelo QA automático do ALTIV.' : 'Resultado salvo com pontos de melhoria identificados.'}</p>
                    </article>
                  )}
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
                  {running ? 'Gerando…' : 'Construir ↑'}
                </button>
              </div>
            </form>
          </>
        )}

        {panel === 'files' && (
          <div className="sideContent">
            <div className="sideIntro"><h2>Arquivos</h2><p>Arquivos reais salvos neste projeto.</p></div>
            <button className="fileRow active">
              <span>◇</span>
              <div><strong>index.html</strong><small>HTML · revisão {revision || 0}</small></div>
              <em>{previewHtml ? Math.round(previewHtml.length / 1024) + ' KB' : '0 KB'}</em>
            </button>
            <div className="codePreview">
              <div className="codePreviewHead">index.html</div>
              <pre>{previewHtml ? previewHtml.slice(0, 4500) : 'O arquivo será criado no primeiro pedido.'}</pre>
            </div>
          </div>
        )}

        {panel === 'code' && (
          <div className="sideContent codeEditorPanel">
            <div className="sideIntro">
              <h2>Código</h2>
              <p>Edite o HTML real do projeto. Salvar cria uma nova versão automaticamente.</p>
            </div>
            <div className="codeEditorHead">
              <span>index.html</span>
              <button onClick={saveCode} disabled={savingCode || !codeDraft.trim()}>
                {savingCode ? 'Salvando…' : 'Salvar código'}
              </button>
            </div>
            <textarea
              className="fullCodeEditor"
              value={codeDraft}
              onChange={(e) => setCodeDraft(e.target.value)}
              spellCheck={false}
            />
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

      <section className="studioPreview">
        <header className="previewToolbar lovableTopbar">
          <div className="topbarLeft">
            <button className="topIcon" onClick={() => setPanel('chat')} title="Construir">☰</button>
            <span className="topProject">{projectName}</span>
          </div>

          <div className="topbarCenter">
            <button className="viewTab active" title="Visualização">◎ <span>Visualização</span></button>
            <button className={panel === 'files' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('files')} title="Arquivos">▤</button>
            <button className={panel === 'code' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('code')} title="Código">&lt;/&gt;</button>
            <button className={panel === 'versions' ? 'topIcon active' : 'topIcon'} onClick={() => setPanel('versions')} title="Versões">▱</button>
            <button className={device === 'desktop' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('desktop')} title="Desktop">▱</button>
            <button className={device === 'tablet' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('tablet')} title="Tablet">▯</button>
            <button className={device === 'mobile' ? 'topIcon active' : 'topIcon'} onClick={() => setDevice('mobile')} title="Mobile">▯</button>
            <button className="topIcon" onClick={() => setRefreshKey((v) => v + 1)} title="Atualizar">↻</button>
            <button className="pageSelectBtn" type="button">Página inicial <span>⌄</span></button>
          </div>

          <div className="topbarRight">
            <button className="topIcon" onClick={openPreview} disabled={!previewHtml} title="Abrir preview em nova aba">↗</button>
            {publishedUrl && <a className="topIcon publishedLink" href={publishedUrl} target="_blank" rel="noreferrer" title="Abrir site publicado">●</a>}
            <button className="publishBtn" onClick={publishProject} disabled={publishing || !previewHtml}>
              {publishing ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </header>

        <div className={'previewStage fill-' + device}>
          <div className={deviceClass}>
            {previewHtml ? (
              <iframe
                key={refreshKey}
                title="ALTIV Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="previewEmpty">
                <div className="emptyBrowser">
                  <div className="emptyDots"><i/><i/><i/></div>
                  <span>altiv-preview</span>
                </div>
                <div className="emptyBody">
                  <span>✦</span>
                  <h2>Seu site vai aparecer aqui</h2>
                  <p>Use o chat à esquerda para criar a primeira versão.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}
