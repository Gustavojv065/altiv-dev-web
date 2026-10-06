'use client'

import { FormEvent, useMemo, useState } from 'react'

const initialSteps = [
  'Entender pedido',
  'Planejar arquitetura',
  'Buscar memória do projeto',
  'Gerar/editar arquivos',
  'Validar TypeScript e build',
  'Atualizar preview',
  'Testar no navegador',
  'Preparar commit',
]

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [lastPrompt, setLastPrompt] = useState('')
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')

  const status = useMemo(() => running ? 'Agente trabalhando' : 'Pronto para construir', [running])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = prompt.trim()
    if (!value) return
    setLastPrompt(value)
    setRunning(true)
    try {
      await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value }),
      })
    } finally {
      setTimeout(() => setRunning(false), 900)
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">A</span><div><strong>ALTIV DEV</strong><small>AI Website Studio</small></div></div>
        <button className="newProject">＋ Novo projeto</button>
        <nav>
          <a className="active">Workspace</a><a>Projetos</a><a>GitHub</a><a>Deploys</a><a>Memória</a><a>Agentes</a><a>Configurações</a>
        </nav>
        <div className="provider"><span className="dot"/>Auto Router <small>melhor modelo por tarefa</small></div>
      </aside>

      <section className="workspace">
        <header>
          <div><b>ALTIV Workspace</b><small>{status}</small></div>
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
              <span>✦</span><h1>Crie, edite e publique com IA</h1>
              <p>Descreva o resultado. O ALTIV planeja, recupera contexto, altera o projeto, testa no navegador e prepara o deploy.</p>
            </div>
            <div className="chips"><button onClick={() => setPrompt('Crie uma landing page premium e responsiva')}>Criar landing page</button><button>Importar GitHub</button><button onClick={() => setPrompt('Analise o projeto e corrija os erros encontrados')}>Corrigir projeto</button></div>
            {lastPrompt && <div className="conversation"><small>ÚLTIMO PEDIDO</small><p>{lastPrompt}</p></div>}
            <form className="composer" onSubmit={submit}>
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Crie um site premium para uma clínica, com login, painel, banco de dados e publicação na Vercel..."/>
              <div><span>＋ arquivos · imagem · GitHub</span><button disabled={running}>{running ? 'Executando…' : 'Executar →'}</button></div>
            </form>
          </section>

          <section className="preview">
            <div className="previewbar"><span>Preview</span><div className="traffic"><i/><i/><i/></div><span>ALTIV Sandbox · {mode}</span></div>
            <div className="canvas">
              <div className={`device ${mode}`}>
                <div className="mock"><span className="badge">LIVE PREVIEW</span><h2>Seu projeto aparece aqui</h2><p>Preview isolado, inspeção visual, console, testes e recuperação de versões.</p><div className="mockcards"><div/><div/><div/></div></div>
              </div>
            </div>
            <div className="agentlog"><div className="agenttitle"><b>Agente ALTIV</b><span>{running ? 'EXECUTANDO' : 'STANDBY'}</span></div>{initialSteps.map((item,i)=><div key={item}><span className={running && i < 3 ? 'pulse' : ''}>{running && i < 3 ? '●':'○'}</span>{item}</div>)}</div>
          </section>
        </div>
      </section>
    </main>
  )
}
