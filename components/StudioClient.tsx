'use client'

import { FormEvent, useMemo, useState } from 'react'

type AgentResponse = {
  ok: boolean
  runId?: string
  conversationId?: string
  task?: string
  pipeline?: string[]
  error?: string
}

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

export default function StudioClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [lastPrompt, setLastPrompt] = useState('')
  const [mode, setMode] = useState<'desktop' | 'mobile'>('desktop')
  const [result, setResult] = useState<AgentResponse | null>(null)

  const status = useMemo(() => running ? 'Agente trabalhando' : 'Pronto para construir', [running])

  async function submit(e: FormEvent) {
    e.preventDefault()
    const value = prompt.trim()
    if (!value) return
    setLastPrompt(value)
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: value, projectId }),
      })
      const data = await response.json()
      setResult(data)
      if (data.ok) setPrompt('')
    } finally {
      setRunning(false)
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="logo">A</span><div><strong>ALTIV DEV</strong><small>AI Website Studio</small></div></div>
        <a href="/workspace" className="newProject" style={{textDecoration:'none', textAlign:'center'}}>← Projetos</a>
        <nav><a className="active">Estúdio</a><a>Arquivos</a><a>GitHub</a><a>Deploys</a><a>Memória</a><a>Agentes</a><a>Configurações</a></nav>
        <div className="provider"><span className="dot"/>Auto Router <small>melhor modelo por tarefa</small></div>
      </aside>

      <section className="workspace">
        <header><div><b>{projectName}</b><small>{status}</small></div><div className="actions"><button onClick={() => setMode('mobile')} className={mode === 'mobile' ? 'selected' : ''}>Mobile</button><button onClick={() => setMode('desktop')} className={mode === 'desktop' ? 'selected' : ''}>Desktop</button><button>GitHub</button><button className="primary">Publicar</button></div></header>
        <div className="grid">
          <section className="chat">
            <div className="hero"><span>✦</span><h1>O que vamos construir?</h1><p>Este chat já está ligado ao seu projeto no Supabase. Pedidos, conversas, execuções e memória ficam associados apenas a este projeto.</p></div>
            <div className="chips"><button onClick={() => setPrompt('Crie uma landing page premium e responsiva')}>Criar landing page</button><button>Importar GitHub</button><button onClick={() => setPrompt('Analise o projeto e corrija os erros encontrados')}>Corrigir projeto</button></div>
            {lastPrompt && <div className="conversation"><small>ÚLTIMO PEDIDO</small><p>{lastPrompt}</p>{result?.ok && <small>Salvo no projeto · execução {result.runId?.slice(0,8)}</small>}{result?.error && <small style={{color:'#ff9fac'}}>Erro: {result.error}</small>}</div>}
            <form className="composer" onSubmit={submit}><textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Ex.: Crie um site premium para uma clínica, com login, painel e banco de dados..."/><div><span>＋ arquivos · imagem · GitHub</span><button disabled={running}>{running ? 'Executando…' : 'Executar →'}</button></div></form>
          </section>
          <section className="preview"><div className="previewbar"><span>Preview</span><div className="traffic"><i/><i/><i/></div><span>ALTIV Sandbox · {mode}</span></div><div className="canvas"><div className={'device ' + mode}><div className="mock"><span className="badge">LIVE PREVIEW</span><h2>Seu projeto aparece aqui</h2><p>O próximo módulo ligará este painel ao sandbox real para executar o código gerado pela IA.</p><div className="mockcards"><div/><div/><div/></div></div></div></div><div className="agentlog"><div className="agenttitle"><b>Agente ALTIV</b><span>{running ? 'EXECUTANDO' : 'STANDBY'}</span></div>{initialSteps.map((item,i)=><div key={item}><span className={running && i < 3 ? 'pulse' : ''}>{running && i < 3 ? '●':'○'}</span>{item}</div>)}</div></section>
        </div>
      </section>
    </main>
  )
}
