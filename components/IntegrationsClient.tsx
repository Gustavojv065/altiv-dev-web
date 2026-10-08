'use client'

import { useEffect, useMemo, useState } from 'react'

type ProviderId =
  | 'openrouter' | 'opencode-zen' | 'openai' | 'gemini' | 'nvidia'
  | 'groq' | 'cerebras' | 'deepseek' | 'mistral' | 'together'
  | 'fireworks' | 'xai' | 'anthropic'

type Provider = {
  id:ProviderId
  label:string
  note:string
  free?:boolean
  capabilities:string[]
}

type Model = {
  id:string
  label:string
  inputTokenLimit?:number
  outputTokenLimit?:number
}

type CredentialState = {
  kind:string
  label:string
  enabled:boolean
  metadata?:Record<string,unknown>
  updated_at?:string
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
  { id:'openrouter', label:'OpenRouter', free:true, note:'Muitos modelos gratuitos e pagos com uma única chave.', capabilities:['Código','Design','Visão','Raciocínio'] },
  { id:'opencode-zen', label:'OpenCode Zen', free:true, note:'Modelos voltados a agentes e programação.', capabilities:['Código','Agentes','Rápido'] },
  { id:'gemini', label:'Google Gemini', free:true, note:'Código, visão, design e contexto grande usando sua Google AI key.', capabilities:['Código','Design','Visão','Raciocínio'] },
  { id:'nvidia', label:'NVIDIA NIM', note:'Nemotron e outros modelos publicados na NVIDIA API.', capabilities:['Código','Raciocínio','Rápido'] },
  { id:'openai', label:'OpenAI', note:'Modelos OpenAI via API própria.', capabilities:['Código','Design','Visão','Raciocínio'] },
  { id:'groq', label:'Groq', free:true, note:'Inferência muito rápida com os modelos habilitados na sua conta.', capabilities:['Código','Rápido'] },
  { id:'cerebras', label:'Cerebras', free:true, note:'Inferência rápida e modelos compatíveis com OpenAI API.', capabilities:['Código','Raciocínio','Rápido'] },
  { id:'deepseek', label:'DeepSeek', note:'Modelos DeepSeek para código e raciocínio.', capabilities:['Código','Raciocínio'] },
  { id:'mistral', label:'Mistral AI', note:'Mistral/Codestral conforme sua conta.', capabilities:['Código','Rápido'] },
  { id:'together', label:'Together AI', note:'Grande catálogo de modelos open-weight hospedados.', capabilities:['Código','Design','Visão'] },
  { id:'fireworks', label:'Fireworks AI', note:'Modelos open-weight e especializados em inferência.', capabilities:['Código','Rápido'] },
  { id:'xai', label:'xAI', note:'Modelos Grok disponíveis na sua conta.', capabilities:['Código','Visão','Raciocínio'] },
  { id:'anthropic', label:'Anthropic', note:'Claude para código, revisão e contexto grande.', capabilities:['Código','Design','Visão','Raciocínio'] },
]

export default function IntegrationsClient() {
  const [credentialStates,setCredentialStates] = useState<CredentialState[]>([])
  const [configured,setConfigured] = useState<Set<string>>(new Set())
  const [keys,setKeys] = useState<Record<string,string>>({})
  const [busy,setBusy] = useState<string|null>(null)
  const [message,setMessage] = useState('')
  const [models,setModels] = useState<Record<string,Model[]>>({})
  const [modelLoading,setModelLoading] = useState<string|null>(null)
  const [selectedModels,setSelectedModels] = useState<Record<string,string>>({})
  const [manualRoute,setManualRoute] = useState<{provider:string;model:string}|null>(null)
  const [githubToken,setGithubToken] = useState('')
  const [githubLogin,setGithubLogin] = useState('')
  const [repos,setRepos] = useState<Repo[]>([])
  const [loadingRepos,setLoadingRepos] = useState(false)
  const [importing,setImporting] = useState<string|null>(null)

  async function refresh() {
    const response = await fetch('/api/integrations/credentials', { cache:'no-store' })
    const data = await response.json()
    if (!data.ok) return
    const states:CredentialState[] = data.credentials ?? []
    setCredentialStates(states)
    setConfigured(new Set(states.map((item)=>item.kind)))
    const manual = states.find((item)=>Boolean(item.metadata?.manualActive) && typeof item.metadata?.selectedModel === 'string')
    setManualRoute(manual ? { provider:manual.kind, model:String(manual.metadata?.selectedModel) } : null)
    setSelectedModels((current)=>{
      const next = {...current}
      for (const item of states) {
        const selected = item.metadata?.selectedModel
        if (typeof selected === 'string' && selected) next[item.kind] = selected
      }
      return next
    })
  }

  useEffect(() => { refresh().catch(()=>{}) }, [])

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
      setMessage(data.ok
        ? provider.label + ' conectado. ' + Number(data.modelCount ?? 0) + ' modelos encontrados.'
        : data.error)
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
      setKeys((current)=>({...current,[provider.id]:''}))
      await refresh()
      setMessage(provider.label + ' salvo com criptografia. Agora carregue os modelos disponíveis.')
      await loadModels(provider.id)
    } finally { setBusy(null) }
  }

  async function removeProvider(provider:Provider) {
    setBusy(provider.id)
    try {
      const response = await fetch('/api/integrations/credentials?kind=' + encodeURIComponent(provider.id), { method:'DELETE' })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      setModels((current)=>{ const next={...current}; delete next[provider.id]; return next })
      await refresh()
      setMessage(provider.label + ' removido.')
    } finally { setBusy(null) }
  }

  async function loadModels(providerId:ProviderId) {
    setModelLoading(providerId); setMessage('')
    try {
      const response = await fetch('/api/integrations/providers/models?provider=' + encodeURIComponent(providerId), { cache:'no-store' })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      const found:Model[] = data.models ?? []
      setModels((current)=>({...current,[providerId]:found}))
      setSelectedModels((current)=>({...current,[providerId]:current[providerId] || data.selectedModel || found[0]?.id || ''}))
      setMessage(found.length
        ? found.length + ' modelos carregados de ' + providers.find((p)=>p.id===providerId)?.label + '.'
        : 'A API não retornou modelos selecionáveis.')
    } finally { setModelLoading(null) }
  }

  async function useManualModel(providerId:ProviderId) {
    const model = selectedModels[providerId]
    if (!model) return setMessage('Selecione um modelo primeiro.')
    setBusy('routing'); setMessage('')
    try {
      const response = await fetch('/api/integrations/providers/models', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ mode:'manual', provider:providerId, model }),
      })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      setManualRoute({provider:providerId,model})
      await refresh()
      setMessage('Modo manual ativado: ' + providerId + ' / ' + model)
    } finally { setBusy(null) }
  }

  async function useAutomaticRouting() {
    setBusy('routing'); setMessage('')
    try {
      const response = await fetch('/api/integrations/providers/models', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({ mode:'auto' }),
      })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error)
      setManualRoute(null)
      await refresh()
      setMessage('Modo automático ativado. O orquestrador escolherá o melhor provider/modelo disponível e fará fallback.')
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
  const configuredCount = useMemo(()=>providers.filter((p)=>configured.has(p.id)).length,[configured])

  return (
    <main className="integrationsPage">
      <header className="integrationsTop">
        <div>
          <a href="/workspace" className="backLink">← Workspace</a>
          <span className="eyebrow">ALTIV AI ENGINE MANAGER</span>
          <h1>Motores, APIs e modelos</h1>
          <p>Conecte suas próprias APIs. No automático, o orquestrador escolhe e faz fallback. No manual, você fixa qualquer modelo retornado pela sua API.</p>
        </div>
        <div className="integrationSummary"><strong>{configuredCount}</strong><span>IAs conectadas</span></div>
      </header>

      {message && <div className="integrationNotice">{message}</div>}

      <section className="integrationSection">
        <div className="integrationSectionHead">
          <div>
            <h2>Roteamento</h2>
            <p>{manualRoute ? 'Manual: ' + manualRoute.provider + ' / ' + manualRoute.model : 'Automático: free-first + melhor capacidade + fallback.'}</p>
          </div>
          <button className="primaryAction engineModeButton" onClick={useAutomaticRouting} disabled={busy==='routing'}>
            Usar modo automático
          </button>
        </div>
      </section>

      <section className="integrationSection">
        <div className="integrationSectionHead">
          <div><h2>Providers de IA</h2><p>Chaves ficam criptografadas. A lista de modelos é consultada diretamente na API conectada.</p></div>
          <span className="freeBadge">AUTO + MANUAL · BYOK</span>
        </div>
        <div className="providerGrid">
          {providers.map((provider)=>{
            const active = configured.has(provider.id)
            const providerModels = models[provider.id] ?? []
            return (
              <article className="providerCard" key={provider.id}>
                <div className="providerCardTop">
                  <div>
                    <strong>{provider.label}</strong>
                    <small>{provider.note}</small>
                    <small>{provider.capabilities.join(' · ')}</small>
                  </div>
                  <span className={active ? 'connectionPill on' : 'connectionPill'}>{active ? 'Conectado' : 'Desconectado'}</span>
                </div>

                <input
                  type="password"
                  value={keys[provider.id] || ''}
                  onChange={(e)=>setKeys((current)=>({...current,[provider.id]:e.target.value}))}
                  placeholder={active ? 'Cole uma nova chave para substituir' : 'Cole sua API key'}
                  autoComplete="new-password"
                />

                <div className="providerActions">
                  <button onClick={()=>testProvider(provider)} disabled={busy===provider.id}>Testar chave</button>
                  <button className="primaryAction" onClick={()=>saveProvider(provider)} disabled={busy===provider.id}>Salvar</button>
                  {active && <button onClick={()=>loadModels(provider.id)} disabled={modelLoading===provider.id}>
                    {modelLoading===provider.id ? 'Carregando…' : 'Carregar modelos'}
                  </button>}
                  {active && <button onClick={()=>removeProvider(provider)} disabled={busy===provider.id}>Remover</button>}
                </div>

                {providerModels.length > 0 && (
                  <div className="modelPicker">
                    <label>Modelo manual</label>
                    <select value={selectedModels[provider.id] || ''} onChange={(e)=>setSelectedModels((current)=>({...current,[provider.id]:e.target.value}))}>
                      {providerModels.map((model)=><option value={model.id} key={model.id}>{model.label || model.id}</option>)}
                    </select>
                    <button className="primaryAction" onClick={()=>useManualModel(provider.id)} disabled={busy==='routing'}>
                      Usar este modelo
                    </button>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      </section>

      <section className="integrationSection">
        <div className="integrationSectionHead">
          <div><h2>GitHub</h2><p>Conecte um token para importar, editar no workspace, revisar preview e só depois criar branch/commit/PR.</p></div>
          <span className={githubConnected ? 'connectionPill on' : 'connectionPill'}>{githubConnected ? 'Conectado' : 'Não conectado'}</span>
        </div>
        <div className="githubConnectCard">
          <div className="githubCredentialRow">
            <input type="password" value={githubToken} onChange={(e)=>setGithubToken(e.target.value)}
              placeholder={githubConnected ? 'Cole outro token para substituir' : 'GitHub token'} autoComplete="new-password" />
            <button className="primaryAction" onClick={connectGithub} disabled={busy==='github'}>{busy==='github' ? 'Conectando…' : 'Conectar GitHub'}</button>
            {githubConnected && <button onClick={loadRepos} disabled={loadingRepos}>{loadingRepos ? 'Carregando…' : 'Listar repositórios'}</button>}
          </div>
          {githubLogin && <small>Conta atual: @{githubLogin}</small>}
        </div>

        {repos.length > 0 && (
          <div className="repoGrid">
            {repos.map((repo)=>(
              <article className="repoCard" key={repo.id}>
                <div><strong>{repo.fullName}</strong><small>{repo.private ? 'Privado' : 'Público'} · {repo.defaultBranch}</small></div>
                <button className="primaryAction" onClick={()=>importRepo(repo)} disabled={importing!==null}>
                  {importing===repo.fullName ? 'Importando…' : 'Abrir no ALTIV'}
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
