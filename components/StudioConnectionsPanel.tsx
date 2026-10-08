'use client'

import { useEffect, useMemo, useState } from 'react'

type ProviderId =
  | 'openrouter' | 'opencode-zen' | 'openai' | 'gemini' | 'nvidia'
  | 'groq' | 'cerebras' | 'deepseek' | 'mistral' | 'together'
  | 'fireworks' | 'xai' | 'anthropic'

type Provider = { id:ProviderId; label:string; free?:boolean }
type Model = { id:string; label:string }
type CredentialState = { kind:string; metadata?:Record<string,unknown> }
type Repo = { id:number; fullName:string; private:boolean; defaultBranch:string; updatedAt:string }

const providers:Provider[] = [
  {id:'openrouter',label:'OpenRouter',free:true},
  {id:'opencode-zen',label:'OpenCode Zen',free:true},
  {id:'gemini',label:'Google Gemini',free:true},
  {id:'nvidia',label:'NVIDIA NIM'},
  {id:'openai',label:'OpenAI'},
  {id:'groq',label:'Groq',free:true},
  {id:'cerebras',label:'Cerebras',free:true},
  {id:'deepseek',label:'DeepSeek'},
  {id:'mistral',label:'Mistral AI'},
  {id:'together',label:'Together AI'},
  {id:'fireworks',label:'Fireworks AI'},
  {id:'xai',label:'xAI'},
  {id:'anthropic',label:'Anthropic'},
]

export default function StudioConnectionsPanel({mode}:{mode:'github'|'ai'}) {
  const [states,setStates] = useState<CredentialState[]>([])
  const [keys,setKeys] = useState<Record<string,string>>({})
  const [models,setModels] = useState<Record<string,Model[]>>({})
  const [selected,setSelected] = useState<Record<string,string>>({})
  const [manual,setManual] = useState<{provider:string;model:string}|null>(null)
  const [busy,setBusy] = useState<string|null>(null)
  const [message,setMessage] = useState('')
  const [githubToken,setGithubToken] = useState('')
  const [repos,setRepos] = useState<Repo[]>([])
  const [loadingRepos,setLoadingRepos] = useState(false)
  const [importing,setImporting] = useState<string|null>(null)

  async function refresh() {
    const response = await fetch('/api/integrations/credentials',{cache:'no-store'})
    const data = await response.json()
    if (!data.ok) return
    const next:CredentialState[] = data.credentials ?? []
    setStates(next)
    const route = next.find((item)=>Boolean(item.metadata?.manualActive) && typeof item.metadata?.selectedModel === 'string')
    setManual(route ? {provider:route.kind,model:String(route.metadata?.selectedModel)} : null)
    setSelected((current)=>{
      const result={...current}
      for(const item of next){
        if(typeof item.metadata?.selectedModel === 'string') result[item.kind]=String(item.metadata.selectedModel)
      }
      return result
    })
  }

  useEffect(()=>{ refresh().catch(()=>{}) },[])
  const configured = useMemo(()=>new Set(states.map((item)=>item.kind)),[states])

  async function saveProvider(provider:Provider) {
    const key=(keys[provider.id]||'').trim()
    if(!key) return setMessage('Cole a chave de '+provider.label+'.')
    setBusy(provider.id); setMessage('')
    try{
      const test=await fetch('/api/integrations/providers/test',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({provider:provider.id,key}),
      })
      const testData=await test.json()
      if(!testData.ok) return setMessage(testData.error || 'Chave recusada.')

      const save=await fetch('/api/integrations/credentials',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({kind:provider.id,secret:key,label:provider.label}),
      })
      const saveData=await save.json()
      if(!saveData.ok) return setMessage(saveData.error)
      setKeys((old)=>({...old,[provider.id]:''}))
      await refresh()
      await loadModels(provider.id)
      setMessage(provider.label+' conectado e modelos carregados.')
    } finally { setBusy(null) }
  }

  async function loadModels(provider:ProviderId) {
    setBusy('models-'+provider); setMessage('')
    try{
      const response=await fetch('/api/integrations/providers/models?provider='+encodeURIComponent(provider),{cache:'no-store'})
      const data=await response.json()
      if(!data.ok) return setMessage(data.error)
      const found:Model[]=data.models ?? []
      setModels((old)=>({...old,[provider]:found}))
      setSelected((old)=>({...old,[provider]:old[provider] || data.selectedModel || found[0]?.id || ''}))
      setMessage(found.length+' modelos disponíveis em '+providers.find((p)=>p.id===provider)?.label+'.')
    } finally { setBusy(null) }
  }

  async function setManualModel(provider:ProviderId) {
    const model=selected[provider]
    if(!model) return setMessage('Selecione um modelo.')
    setBusy('route')
    try{
      const response=await fetch('/api/integrations/providers/models',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({mode:'manual',provider,model}),
      })
      const data=await response.json()
      if(!data.ok) return setMessage(data.error)
      setManual({provider,model})
      await refresh()
      setMessage('Modelo manual salvo: '+model)
    } finally { setBusy(null) }
  }

  async function setAuto() {
    setBusy('route')
    try{
      const response=await fetch('/api/integrations/providers/models',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({mode:'auto'}),
      })
      const data=await response.json()
      if(!data.ok) return setMessage(data.error)
      setManual(null)
      await refresh()
      setMessage('Modo automático salvo. O orquestrador escolhe e usa fallback.')
    } finally { setBusy(null) }
  }

  async function connectGithub() {
    const token=githubToken.trim()
    if(!token) return setMessage('Cole o token do GitHub.')
    setBusy('github'); setMessage('')
    try{
      const test=await fetch('/api/integrations/github/test',{
        method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),
      })
      const testData=await test.json()
      if(!testData.ok) return setMessage(testData.error)

      const save=await fetch('/api/integrations/credentials',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({kind:'github',secret:token,label:'GitHub',metadata:{login:testData.login}}),
      })
      const saveData=await save.json()
      if(!saveData.ok) return setMessage(saveData.error)
      setGithubToken('')
      await refresh()
      await loadRepos()
      setMessage('GitHub conectado como @'+testData.login+'.')
    } finally { setBusy(null) }
  }

  async function loadRepos() {
    setLoadingRepos(true); setMessage('')
    try{
      const response=await fetch('/api/integrations/github/repos',{cache:'no-store'})
      const data=await response.json()
      if(!data.ok) return setMessage(data.error)
      setRepos(data.repositories ?? [])
    } finally { setLoadingRepos(false) }
  }

  async function importRepo(repo:Repo) {
    setImporting(repo.fullName); setMessage('')
    try{
      const response=await fetch('/api/integrations/github/import',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({fullName:repo.fullName,branch:repo.defaultBranch}),
      })
      const data=await response.json()
      if(!data.ok) return setMessage(data.error)
      window.location.href='/studio/'+data.projectId
    } finally { setImporting(null) }
  }

  if(mode==='github'){
    const connected=configured.has('github')
    return (
      <div className="sideContent studioConnections">
        <div className="sideIntro">
          <h2>GitHub</h2>
          <p>Conecte seu token, liste seus repositórios e abra qualquer um no ALTIV. Cada repositório importado fica salvo como um projeto separado.</p>
        </div>
        {message && <div className="studioConnectionNotice">{message}</div>}
        <div className="studioConnectionCard">
          <div className="connectionTitle"><strong>Conta GitHub</strong><span className={connected?'miniStatus on':'miniStatus'}>{connected?'Conectado':'Desconectado'}</span></div>
          <input type="password" value={githubToken} onChange={(e)=>setGithubToken(e.target.value)}
            placeholder={connected?'Cole outro token para substituir':'Cole o token do GitHub'} />
          <div className="connectionActions">
            <button className="primaryAction" onClick={connectGithub} disabled={busy==='github'}>{busy==='github'?'Conectando…':'Salvar token'}</button>
            {connected && <button onClick={loadRepos} disabled={loadingRepos}>{loadingRepos?'Carregando…':'Listar repositórios'}</button>}
          </div>
        </div>
        {repos.length>0 && <div className="studioRepoList">
          {repos.map((repo)=><button className="studioRepoRow" key={repo.id} onClick={()=>importRepo(repo)} disabled={importing!==null}>
            <div><strong>{repo.fullName}</strong><small>{repo.private?'Privado':'Público'} · {repo.defaultBranch}</small></div>
            <span>{importing===repo.fullName?'Abrindo…':'Abrir ›'}</span>
          </button>)}
        </div>}
      </div>
    )
  }

  return (
    <div className="sideContent studioConnections">
      <div className="sideIntro">
        <h2>APIs e modelos</h2>
        <p>Salve suas chaves, carregue os modelos reais da API e escolha Automático ou Manual.</p>
      </div>
      {message && <div className="studioConnectionNotice">{message}</div>}
      <div className="routingCard">
        <div><strong>Roteamento</strong><small>{manual ? 'Manual · '+manual.provider+' / '+manual.model : 'Automático · orquestrador + fallback'}</small></div>
        <button className={!manual?'active':''} onClick={setAuto} disabled={busy==='route'}>Automático</button>
      </div>
      <div className="studioProviderList">
        {providers.map((provider)=>{
          const active=configured.has(provider.id)
          const providerModels=models[provider.id] ?? []
          return <details className="studioProviderCard" key={provider.id} open={active && providerModels.length>0}>
            <summary>
              <div><strong>{provider.label}</strong><small>{provider.free?'Free/tier grátis quando disponível':'Pago ou conforme créditos da conta'}</small></div>
              <span className={active?'miniStatus on':'miniStatus'}>{active?'ON':'OFF'}</span>
            </summary>
            <input type="password" value={keys[provider.id]||''}
              onChange={(e)=>setKeys((old)=>({...old,[provider.id]:e.target.value}))}
              placeholder={active?'Nova chave para substituir':'Cole a API key'} />
            <div className="connectionActions">
              <button className="primaryAction" onClick={()=>saveProvider(provider)} disabled={busy===provider.id}>{busy===provider.id?'Testando…':'Testar + salvar'}</button>
              {active && <button onClick={()=>loadModels(provider.id)} disabled={busy==='models-'+provider.id}>{busy==='models-'+provider.id?'Carregando…':'Modelos'}</button>}
            </div>
            {providerModels.length>0 && <div className="compactModelPicker">
              <select value={selected[provider.id]||''} onChange={(e)=>setSelected((old)=>({...old,[provider.id]:e.target.value}))}>
                {providerModels.map((model)=><option value={model.id} key={model.id}>{model.label || model.id}</option>)}
              </select>
              <button className="primaryAction" onClick={()=>setManualModel(provider.id)} disabled={busy==='route'}>Usar manualmente</button>
            </div>}
          </details>
        })}
      </div>
      <a className="studioManageLink" href="/integrations">Abrir gerenciador completo de integrações ↗</a>
    </div>
  )
}
