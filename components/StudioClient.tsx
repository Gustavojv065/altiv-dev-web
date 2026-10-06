'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'

type AgentResponse = {
  ok: boolean
  runId?: string
  model?: string
  summary?: string
  html?: string
  revision?: number
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

type Panel = 'chat' | 'files' | 'versions'
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

        if (data.revision) {
          setVersions((current) => [
            {
              id: 'version-' + Date.now(),
              version_number: data.revision!,
              summary: data.summary ?? 'Alteração gerada pela IA',
              created_at: new Date().toISOString(),
              metadata: { model: data.model },
            },
            ...current.filter((v) => v.version_number !== data.revision),
          ])
        }
      }
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha de rede.' })
    } finally {
      setRunning(false)
    }
  }

  const deviceClass = 'previewViewport ' + device

  return (
    <main className="studioShell">
      <aside className="studioRail">
        <a className="railLogo" href="/workspace" title="ALTIV DEV">A</a>
        <div className="railNav">
          <button className={panel === 'chat' ? 'active' : ''} onClick={() => setPanel('chat')} title="Chat"><span>✦</span><small>Chat</small></button>
          <button className={panel === 'files' ? 'active' : ''} onClick={() => setPanel('files')} title="Arquivos"><span>⌘</span><small>Arquivos</small></button>
          <button className={panel === 'versions' ? 'active' : ''} onClick={() => setPanel('versions')} title="Versões"><span>↺</span><small>Versões</small></button>
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
          <span className="panelLabel">{panel === 'chat' ? 'Construir' : panel === 'files' ? 'Arquivos' : 'Histórico'}</span>
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

        {panel === 'versions' && (
          <div className="sideContent">
            <div className="sideIntro"><h2>Versões</h2><p>Cada geração salva uma revisão no Supabase.</p></div>
            <div className="versionList">
              {versions.length === 0 ? <div className="emptyMini">Nenhuma versão criada ainda.</div> : versions.map((version) => (
                <article className="versionCard" key={version.id}>
                  <div><span className="versionBadge">r{version.version_number}</span><time>{new Date(version.created_at).toLocaleString('pt-BR')}</time></div>
                  <p>{version.summary || 'Alteração salva'}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="studioPreview">
        <header className="previewToolbar">
          <div className="previewLeft">
            <span className="previewTitle">Visualização</span>
            <span className="previewStatus"><i/> {previewHtml ? 'Atualizada' : 'Aguardando geração'}</span>
          </div>

          <div className="deviceSwitch">
            <button className={device === 'desktop' ? 'active' : ''} onClick={() => setDevice('desktop')} title="Desktop">▱</button>
            <button className={device === 'tablet' ? 'active' : ''} onClick={() => setDevice('tablet')} title="Tablet">▯</button>
            <button className={device === 'mobile' ? 'active' : ''} onClick={() => setDevice('mobile')} title="Mobile">▯</button>
          </div>

          <div className="previewActions">
            <button onClick={() => setRefreshKey((v) => v + 1)} title="Atualizar">↻</button>
            <button disabled title="GitHub será conectado por projeto">GitHub</button>
            <button className="publishBtn" disabled title="Deploy por projeto entra na próxima etapa">Publicar</button>
          </div>
        </header>

        <div className="previewStage">
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

        <footer className="previewFooter">
          <span><i className="online"/> Preview real</span>
          <span>index.html</span>
          <span>Supabase · r{revision || 0}</span>
        </footer>
      </section>
    </main>
  )
}
