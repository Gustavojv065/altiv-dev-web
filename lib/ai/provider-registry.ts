import type { ProviderId } from './provider-catalog'

export type ProviderApiStyle = 'openai-chat' | 'openai-responses' | 'gemini' | 'anthropic'

export type ProviderDefinition = {
  id: ProviderId
  label: string
  note: string
  apiStyle: ProviderApiStyle
  baseUrl?: string
  chatPath?: string
  modelsPath?: string
  free?: boolean
  capabilities: Array<'code'|'design'|'vision'|'fast'|'reasoning'|'text'>
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDefinition> = {
  openrouter: {
    id:'openrouter', label:'OpenRouter', free:true,
    note:'Roteador com muitos modelos gratuitos e pagos em uma única chave.',
    apiStyle:'openai-chat', baseUrl:'https://openrouter.ai/api/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','design','vision','fast','reasoning','text'],
  },
  'opencode-zen': {
    id:'opencode-zen', label:'OpenCode Zen', free:true,
    note:'Modelos para agentes e programação, incluindo opções gratuitas quando disponíveis.',
    apiStyle:'openai-chat', baseUrl:'https://opencode.ai/zen/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','fast','reasoning','text'],
  },
  openai: {
    id:'openai', label:'OpenAI',
    note:'Modelos OpenAI via Responses API.',
    apiStyle:'openai-responses', baseUrl:'https://api.openai.com/v1', modelsPath:'/models',
    capabilities:['code','design','vision','fast','reasoning','text'],
  },
  gemini: {
    id:'gemini', label:'Google Gemini', free:true,
    note:'Gemini para código, visão, design e contexto grande. A disponibilidade depende da sua chave/cota Google AI.',
    apiStyle:'gemini',
    capabilities:['code','design','vision','fast','reasoning','text'],
  },
  nvidia: {
    id:'nvidia', label:'NVIDIA NIM',
    note:'Nemotron e outros modelos publicados na API NVIDIA.',
    apiStyle:'openai-chat', baseUrl:'https://integrate.api.nvidia.com/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','reasoning','fast','text'],
  },
  groq: {
    id:'groq', label:'Groq', free:true,
    note:'Inferência rápida com modelos disponíveis na conta Groq.',
    apiStyle:'openai-chat', baseUrl:'https://api.groq.com/openai/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','fast','text'],
  },
  cerebras: {
    id:'cerebras', label:'Cerebras', free:true,
    note:'Inferência rápida via API compatível com OpenAI.',
    apiStyle:'openai-chat', baseUrl:'https://api.cerebras.ai/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','fast','reasoning','text'],
  },
  deepseek: {
    id:'deepseek', label:'DeepSeek',
    note:'Modelos DeepSeek para código e raciocínio.',
    apiStyle:'openai-chat', baseUrl:'https://api.deepseek.com', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','reasoning','text'],
  },
  mistral: {
    id:'mistral', label:'Mistral AI',
    note:'Modelos Mistral e Codestral conforme sua conta.',
    apiStyle:'openai-chat', baseUrl:'https://api.mistral.ai/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','fast','reasoning','text'],
  },
  together: {
    id:'together', label:'Together AI',
    note:'Catálogo amplo de modelos open-weight hospedados.',
    apiStyle:'openai-chat', baseUrl:'https://api.together.xyz/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','design','vision','fast','reasoning','text'],
  },
  fireworks: {
    id:'fireworks', label:'Fireworks AI',
    note:'Inferência de modelos open-weight e especializados.',
    apiStyle:'openai-chat', baseUrl:'https://api.fireworks.ai/inference/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','fast','reasoning','text'],
  },
  xai: {
    id:'xai', label:'xAI',
    note:'Modelos Grok disponíveis na sua conta xAI.',
    apiStyle:'openai-chat', baseUrl:'https://api.x.ai/v1', chatPath:'/chat/completions', modelsPath:'/models',
    capabilities:['code','vision','reasoning','text'],
  },
  anthropic: {
    id:'anthropic', label:'Anthropic',
    note:'Claude para código, arquitetura, revisão e contexto grande.',
    apiStyle:'anthropic', baseUrl:'https://api.anthropic.com/v1', modelsPath:'/models',
    capabilities:['code','design','vision','reasoning','text'],
  },
}

export const PROVIDER_IDS = Object.keys(PROVIDER_REGISTRY) as ProviderId[]

function modelName(item:any) {
  return String(item?.id ?? item?.name ?? item?.model ?? '').replace(/^models\//,'').trim()
}

export async function discoverProviderModels(provider:ProviderId, key:string) {
  const def = PROVIDER_REGISTRY[provider]
  const signal = AbortSignal.timeout(15000)

  if (provider === 'gemini') {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key), { signal, cache:'no-store' })
    if (!response.ok) throw new Error('Gemini recusou a consulta de modelos (' + response.status + ').')
    const data = await response.json()
    return (data?.models ?? [])
      .filter((item:any)=>Array.isArray(item?.supportedGenerationMethods)
        ? item.supportedGenerationMethods.includes('generateContent')
        : true)
      .map((item:any)=>({
        id:modelName(item),
        label:String(item?.displayName ?? modelName(item)),
        inputTokenLimit:Number(item?.inputTokenLimit ?? 0) || undefined,
        outputTokenLimit:Number(item?.outputTokenLimit ?? 0) || undefined,
      }))
      .filter((item:{id:string})=>Boolean(item.id))
  }

  if (!def.baseUrl || !def.modelsPath) return []
  const headers:Record<string,string> = {}
  if (provider === 'anthropic') {
    headers['x-api-key'] = key
    headers['anthropic-version'] = '2023-06-01'
  } else {
    headers.authorization = 'Bearer ' + key
  }
  const response = await fetch(def.baseUrl + def.modelsPath, { headers, signal, cache:'no-store' })
  if (!response.ok) {
    const detail = await response.text().catch(()=> '')
    throw new Error(def.label + ' recusou a consulta de modelos (' + response.status + '). ' + detail.slice(0,140))
  }
  const data = await response.json()
  const source = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : Array.isArray(data?.models) ? data.models : []
  return source.map((item:any)=>({
    id:modelName(item),
    label:String(item?.display_name ?? item?.displayName ?? item?.name ?? modelName(item)),
  })).filter((item:{id:string})=>Boolean(item.id))
}

export async function testProviderKey(provider:ProviderId, key:string) {
  const models = await discoverProviderModels(provider,key)
  return { ok:true, models:models.slice(0,5), count:models.length }
}
