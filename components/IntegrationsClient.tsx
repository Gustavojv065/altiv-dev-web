'use client'

import { useEffect, useMemo, useState } from 'react'

type Provider = {
  id:'openrouter'|'opencode-zen'|'openai'|'gemini'|'nvidia'
  label:string
  note:string
  free?:boolean
}

type Repo = {
  id:number
  fullName:string
  private:boolean
  defaultBranch:string
  url:string
  updatedAt:string
}

const providers:Provider[] = [
  { id:'openrouter', label:'OpenRouter', free:true, note:'Recomendado. Pode usar o Free Models Router ou modelos pagos na mesma chave.' },
  { id:'opencode-zen', label:'OpenCode Zen', free:true, note:'Modelos voltados a agentes e programação. Alguns modelos podem ter tier gratuito.' },
  { id:'openai', label:'OpenAI', note:'Use sua própria chave para modelos OpenAI compatíveis.' },
  { id:'gemini', label:'Gemini', note:'Use sua própria chave Google AI para contexto grande, design e visão.' },
  { id:'nvidia', label:'NVIDIA', note:'Opcional para Nemotron e outros modelos disponíveis na API NVIDIA.' },
]

export default function IntegrationsClient() {
  const [configured,setConfigured] = useState<Set<string>>(new Set())
  const [keys,setKeys] = useState<Record<string,string>>({})
  const [busy,setBusy] = useState<string|null>(null)
  const [message,setMessage] = useState('')
  const [githubToken,setGithubToken] = useState('')
  const [githubLogin,setGithubLogin] = useState('')
  const [repos,setRepos] = useState<Repo[]>([])
  const [loadingRepos,setLoadingRepos] = useState(false)
  const [importing,setImporting] = useState<string|null>(null)

  async function refresh() {
    const response = await fetch('/api/integrations/credentials', { cache:'no-store' })
    const data = await response.json()
    if (data.ok) setConfigured(new Set((data.credentials ?? []).map((item:{kind:string}) => item.kind)))
  }

  useEffect(() => { refresh().catch(() => {}) }, [])

  async function testProvider(provider:Provider) {
    const key = (keys[provider.id] || '').trim()
    if (!key) return setMessage('Cole a chave de ' + provider.label + ' primeiro.')
    setBusy(provider.id); setMessage('')
    try {
      const response = await fetch('/api/integrations/providers/test', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ provider:provider.id, key }),
      })
      const data = await response.json()
      setMessage(data.ok ? provider.label + ' conectado com sucesso.' : data.error)
    } finally { setBusy(null) }
  }

  async function saveProvider(provider:Provider) {
    const key = (keys[provider.id] || '').trim()
    if (!key) return setMessage('Cole a chave de ' + provider.label + ' primeiro.')
    setBusy(provider.id); setMessage('')
    try {
      const response = await fetch('/api/integrations/credentials', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ kind:provider.id, secret:key, label:provider.label }),
      })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      setKeys((current) => ({...current,[provider.id]:''}))
      await refresh()
      setMessage(provider.label + ' salvo com criptografia.')
    } finally { setBusy(null) }
  }

  async function removeProvider(provider:Provider) {
    setBusy(provider.id)
    try {
      const response = await fetch('/api/integrations/credentials?kind=' + encodeURIComponent(provider.id), { method:'DELETE' })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      await refresh()
      setMessage(provider.label + ' removido.')
    } finally { setBusy(null) }
  }

  async function connectGithub() {
    const token = githubToken.trim()
    if (!token) return setMessage('Cole o token do GitHub primeiro.')
    setBusy('github'); setMessage('')
    try {
      const test = await fetch('/api/integrations/github/test', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ token }),
      })
      const testData = await test.json()
      if (!testData.ok) return setMessage(testData.error)

      const save = await fetch('/api/integrations/credentials', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ kind:'github', secret:token, label:'GitHub', metadata:{ login:testData.login } }),
      })
      const saveData = await save.json()
      if (!saveData.ok) return setMessage(saveData.error)
      setGithubLogin(testData.login || '')
      setGithubToken('')
      await refresh()
      setMessage('GitHub conectado como @' + testData.login + '.')
      await loadRepos()
    } finally { setBusy(null) }
  }

  async function loadRepos() {
    setLoadingRepos(true); setMessage('')
    try {
      const response = await fetch('/api/integrations/github/repos', { cache:'no-store' })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      setRepos(data.repositories ?? [])
    } finally { setLoadingRepos(false) }
  }

  async function importRepo(repo:Repo) {
    setImporting(repo.fullName); setMessage('')
    try {
      const response = await fetch('/api/integrations/github/import', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ fullName:repo.fullName, branch:repo.defaultBranch }),
      })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      window.location.href = '/studio/' + data.projectId
    } finally { setImporting(null) }
  }

  const githubConnected = configured.has('github')
  const configuredCount = useMemo(() => providers.filter((p) => configured.has(p.id)).length, [configured])

  return (
    <main className="integrationsPage">
      <header className="integrationsTop">
        <div>
          <a href="/workspace" className="backLink">← Workspace</a>
          <span className="eyebrow">ALTIV INTELLIGENCE</span>
          <h1>Integrações e modelos</h1>
          <p>Conecte suas próprias APIs. O ALTIV tenta opções gratuitas primeiro e usa fallback automático quando necessário.</p>
        </div>
        <div className="integrationSummary"><strong>{configuredCount}</strong><span>IAs conectadas</span></div>
      </header>

      {message && <div className="integrationNotice">{message}</div>}

      <section className="integrationSection">
        <div className="integrationSectionHead">
          <div><h2>Providers de IA</h2><p>As chaves são armazenadas criptografadas e nunca são exibidas novamente.</p></div>
          <span className="freeBadge">FREE-FIRST + BYOK</span>
        </div>
        <div className="providerGrid">
          {providers.map((provider) => {
            const active = configured.has(provider.id)
            return (
              <article className="providerCard" key={provider.id}>
                <div className="providerCardTop">
                  <div><strong>{provider.label}</strong><small>{provider.note}</small></div>
                  <span className={active ? 'connectionPill on' : 'connectionPill'}>{active ? 'Conectado' : 'Desconectado'}</span>
                </div>
                <input
                  type="password"
                  value={keys[provider.id] || ''}
                  onChange={(e) => setKeys((current) => ({...current,[provider.id]:e.target.value}))}
                  placeholder={active ? 'Cole uma nova chave para substituir' : 'Cole sua API key'}
                  autoComplete="new-password"
                />
                <div className="providerActions">
                  <button onClick={() => testProvider(provider)} disabled={busy === provider.id}>Testar</button>
                  <button className="primaryAction" onClick={() => saveProvider(provider)} disabled={busy === provider.id}>Salvar</button>
                  {active && <button onClick={() => removeProvider(provider)} disabled={busy === provider.id}>Remover</button>}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section className="integrationSection">
        <div className="integrationSectionHead">
          <div><h2>GitHub</h2><p>Conecte um token para importar e editar projetos existentes. OAuth/GitHub App será a evolução comercial desta conexão.</p></div>
          <span className={githubConnected ? 'connectionPill on' : 'connectionPill'}>{githubConnected ? 'Conectado' : 'Não conectado'}</span>
        </div>
        <div className="githubConnectCard">
          <div className="githubCredentialRow">
            <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)}
              placeholder={githubConnected ? 'Cole outro token para substituir' : 'GitHub token'} autoComplete="new-password" />
            <button className="primaryAction" onClick={connectGithub} disabled={busy === 'github'}>{busy === 'github' ? 'Conectando…' : 'Conectar GitHub'}</button>
            {githubConnected && <button onClick={loadRepos} disabled={loadingRepos}>{loadingRepos ? 'Carregando…' : 'Listar repositórios'}</button>}
          </div>
          {githubLogin && <small>Conta atual: @{githubLogin}</small>}
        </div>

        {repos.length > 0 && (
          <div className="repoGrid">
            {repos.map((repo) => (
              <article className="repoCard" key={repo.id}>
                <div><strong>{repo.fullName}</strong><small>{repo.private ? 'Privado' : 'Público'} · {repo.defaultBranch}</small></div>
                <button className="primaryAction" onClick={() => importRepo(repo)} disabled={importing !== null}>
                  {importing === repo.fullName ? 'Importando…' : 'Abrir no ALTIV'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
