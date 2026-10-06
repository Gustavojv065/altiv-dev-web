'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type AgentResponse = {
  ok: boolean
  runId?: string
  conversationId?: string
  task?: string
  model?: string
  summary?: string
  html?: string
  revision?: number
  error?: string
}

const initialSteps = [
  'Entender pedido',
  'Planejar arquitetura',
  'Buscar memória do projeto',
  'Gerar/editar arquivos',
  'Validar resultado',
  'Atualizar preview',
  'Salvar versão',
  'Finalizar execução',
]

export default function StudioClient({
  projectId,
  projectName,
  initialHtml,
  initialRevision,
}: {
  projectId: string
  projectName: string
  initialHtml: string
  initialRevision: number
}) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [lastPrompt, setLastPrompt] = useState('')
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  const [result, setResult] = useState<AgentResponse | null>(null)
  const [previewHtml, setPreviewHtml] = useState(initialHtml)
  const [revision, setRevision] = useState(initialRevision)

  const status = useMemo(
    () => running ? 'IA gerando o site real' : previewHtml ? 'Projeto pronto para editar' : 'Pronto para construir',
    [running, previewHtml]
  )

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
          setResult((current) => current ?? {
            ok: true,
            summary: 'Preview atualizado assim que a geração foi salva.',
            revision: Number(data.revision),
          })
        }
      } catch {
        // Keep the main generation request in control; polling is only a live UX fallback.
      }
    }

    poll()
    const timer = window.setInterval(poll, 5000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [running, projectId, revision])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = prompt.trim()
    if (!value || running) return

    setLastPrompt(value)
    setRunning(true)
    setResult(null)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value, projectId }),
      })
      const data: AgentResponse = await response.json()
      setResult(data)

      if (data.ok && data.html) {
        setPreviewHtml(data.html)
        setRevision(data.revision ?? revision + 1)
        setPrompt('')
      }
    } catch (error) {
      setResult({ ok: false, error: error instanceof Error ? error.message : 'Falha de rede.' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">A</span><div><strong>ALTIV DEV</strong><small>AI Website Studio</small></div></div>
        <a href="/workspace" className="newProject" style={{textDecoration:'none', textAlign:'center'}}>← Projetos</a>
        <nav>
          <a className="active">Estúdio</a>
          <a>Arquivos</a>
          <a>GitHub</a>
          <a>Deploys</a>
          <a>Memória</a>
          <a>Agentes</a>
          <a>Configurações</a>
        </nav>
        <div className="provider">
          <span className="dot"/>AI Gateway
          <small>{result?.model ?? 'Nemotron → fallback automático'}</small>
        </div>
      </aside>

      <section className="workspace">
        <header>
          <div>
            <b>{projectName}</b>
            <small>{status}{revision ? ` · revisão ${revision}` : ''}</small>
          </div>
          <div className="actions">
            <button onClick={() => setMode('mobile')} className={mode === 'mobile' ? 'selected' : ''}>Mobile</button>
            <button onClick={() => setMode('desktop')} className={mode === 'desktop' ? 'selected' : ''}>Desktop</button>
            <button>GitHub</button>
            <button className="primary">Publicar</button>
          </div>
        </header>

        <div className="grid">
          <section className="chat">
            <div className="hero">
              <span>✦</span>
              <h1>{previewHtml ? 'Edite seu site conversando' : 'O que vamos construir?'}</h1>
              <p>Agora é geração real: a IA cria ou modifica o HTML, salva no Supabase, cria uma nova versão e atualiza o preview imediatamente.</p>
            </div>

            <div className="chips">
              <button onClick={() => setPrompt('Crie uma landing page premium e responsiva para uma barbearia, com hero impactante, serviços, preços, depoimentos e botão de WhatsApp.')}>Criar site completo</button>
              <button onClick={() => setPrompt('Melhore o design deste site: deixe mais premium, moderno, responsivo e com melhor hierarquia visual.')}>Melhorar design</button>
              <button onClick={() => setPrompt('Revise o site atual e corrija problemas de responsividade, acessibilidade e usabilidade sem remover conteúdo importante.')}>Corrigir projeto</button>
            </div>

            {lastPrompt && (
              <div className="conversation">
                <small>ÚLTIMO PEDIDO</small>
                <p>{lastPrompt}</p>
                {running && <small>Gerando código real com IA… o preview atualiza automaticamente assim que o arquivo for salvo.</small>}
                {result?.ok && <small>✓ {result.summary} · revisão {result.revision} · {result.model}</small>}
                {result?.error && <small style={{color:'#ff9fac'}}>Erro: {result.error}</small>}
              </div>
            )}

            <form className="composer" onSubmit={submit}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex.: Crie um site premium para uma clínica, com menu, hero, serviços, depoimentos, contato e visual futurista..."
              />
              <div>
                <span>HTML real · memória · versões · Supabase</span>
                <button disabled={running}>{running ? 'Gerando…' : 'Executar →'}</button>
              </div>
            </form>
          </section>

          <section className="preview">
            <div className="previewbar">
              <span>Preview real</span>
              <div className="traffic"><i/><i/><i/></div>
              <span>{previewHtml ? `index.html · r${revision}` : 'aguardando geração'} · {mode}</span>
            </div>

            <div className="canvas">
              <div className={'device ' + mode}>
                {previewHtml ? (
                  <iframe
                    title="ALTIV Preview"
                    sandbox="allow-scripts allow-forms allow-modals"
                    srcDoc={previewHtml}
                    style={{width:'100%',height:'100%',border:0,background:'#fff'}}
                  />
                ) : (
                  <div className="mock">
                    <span className="badge">REAL PREVIEW</span>
                    <h2>Crie o primeiro site</h2>
                    <p>Digite um pedido no chat. O HTML gerado pela IA aparecerá aqui e será salvo como arquivo do projeto.</p>
                    <div className="mockcards"><div/><div/><div/></div>
                  </div>
                )}
              </div>
            </div>

            <div className="agentlog">
              <div className="agenttitle"><b>Agente ALTIV</b><span>{running ? 'GERANDO' : previewHtml ? 'PRONTO' : 'STANDBY'}</span></div>
              {initialSteps.map((item,i) => (
                <div key={item}>
                  <span className={running && i < 5 ? 'pulse' : ''}>{running && i < 5 ? '●' : result?.ok ? '✓' : '○'}</span>{item}
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
