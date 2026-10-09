import type { ProviderRoute } from './provider-catalog'
import { providerEnvKey } from './provider-catalog'
import { PROVIDER_REGISTRY } from './provider-registry'

type ChatMessage = { role:'system'|'user'|'assistant'; content:string }

async function callGemini(route:ProviderRoute,messages:ChatMessage[],timeoutMs:number,maxTokens:number,temperature:number) {
  const key = providerEnvKey('gemini')
  if (!key) throw new Error('Gemini não configurado.')
  const system = messages.find((message)=>message.role === 'system')?.content || ''
  const turns = messages.filter((message)=>message.role !== 'system')
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(route.model) + ':generateContent?key=' + encodeURIComponent(key),
    {
      method:'POST',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        systemInstruction:system ? { parts:[{text:system}] } : undefined,
        contents:turns.map((message)=>({
          role:message.role === 'assistant' ? 'model' : 'user',
          parts:[{text:message.content}],
        })),
        generationConfig:{ maxOutputTokens:maxTokens, temperature },
      }),
    }
  )
  if (!response.ok) throw new Error('Gemini / ' + route.model + ' falhou: ' + response.status + ' ' + (await response.text()).slice(0,300))
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((part:{text?:string})=>part.text || '').join('').trim()
  if (!text) throw new Error('Gemini não retornou conteúdo.')
  return text
}

async function callOpenAI(route:ProviderRoute,messages:ChatMessage[],timeoutMs:number,maxTokens:number) {
  const key = providerEnvKey('openai')
  if (!key) throw new Error('OpenAI não configurada.')
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{'content-type':'application/json',authorization:'Bearer ' + key},
    body:JSON.stringify({
      model:route.model,
      input:messages.map((message)=>({
        role:message.role,
        content:[{type:'input_text',text:message.content}],
      })),
      max_output_tokens:maxTokens,
    }),
  })
  if (!response.ok) throw new Error('OpenAI / ' + route.model + ' falhou: ' + response.status + ' ' + (await response.text()).slice(0,300))
  const data = await response.json()
  const text = String(
    data?.output_text ??
    data?.output?.flatMap((item:{content?:Array<{text?:string}>})=>item.content ?? [])
      ?.map((part:{text?:string})=>part.text || '').join('') ??
    ''
  ).trim()
  if (!text) throw new Error('OpenAI não retornou conteúdo.')
  return text
}

async function callAnthropic(route:ProviderRoute,messages:ChatMessage[],timeoutMs:number,maxTokens:number,temperature:number) {
  const key = providerEnvKey('anthropic')
  if (!key) throw new Error('Anthropic não configurada.')
  const system = messages.find((message)=>message.role === 'system')?.content || ''
  const turns = messages.filter((message)=>message.role !== 'system')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{
      'content-type':'application/json',
      'x-api-key':key,
      'anthropic-version':'2023-06-01',
    },
    body:JSON.stringify({
      model:route.model,
      system:system || undefined,
      messages:turns.map((message)=>({role:message.role === 'assistant' ? 'assistant' : 'user',content:message.content})),
      max_tokens:maxTokens,
      temperature,
    }),
  })
  if (!response.ok) throw new Error('Anthropic / ' + route.model + ' falhou: ' + response.status + ' ' + (await response.text()).slice(0,300))
  const data = await response.json()
  const text = data?.content?.map((part:{text?:string})=>part.text || '').join('').trim()
  if (!text) throw new Error('Anthropic não retornou conteúdo.')
  return text
}

export async function callProvider(
  route:ProviderRoute,
  messages:ChatMessage[],
  options:{timeoutMs?:number;maxTokens?:number;temperature?:number}={}
) {
  const timeoutMs = options.timeoutMs ?? 90000
  const maxTokens = options.maxTokens ?? 9000
  const temperature = options.temperature ?? 0.45
  const def = PROVIDER_REGISTRY[route.provider]

  if (def.apiStyle === 'gemini') return callGemini(route,messages,timeoutMs,maxTokens,temperature)
  if (def.apiStyle === 'openai-responses') return callOpenAI(route,messages,timeoutMs,maxTokens)
  if (def.apiStyle === 'anthropic') return callAnthropic(route,messages,timeoutMs,maxTokens,temperature)

  const key = providerEnvKey(route.provider)
  if (!key) throw new Error(def.label + ' não configurado.')
  if (route.provider === 'freellmapi') {
    const base = process.env.FREELLMAPI_BASE_URL
    if (!base || !/^https:\/\/[^/?#]+(?:\/v1)?\/?$/i.test(base)) throw new Error('FreeLLMAPI requer URL HTTPS terminando em /v1.')
    const response = await fetch(base.replace(/\/$/,'') + '/chat/completions', {
      method:'POST', signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json',authorization:'Bearer ' + key},
      body:JSON.stringify({model:route.model,messages,temperature,max_tokens:maxTokens,stream:false}),
    })
    if (!response.ok) throw new Error('FreeLLMAPI indisponível: HTTP ' + response.status)
    const data = await response.json()
    const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
    if (!text) throw new Error('FreeLLMAPI não retornou texto.')
    return text
  }
  if (!def.baseUrl || !def.chatPath) throw new Error(def.label + ' sem endpoint de chat configurado.')

  const headers:Record<string,string> = {
    'content-type':'application/json',
    authorization:'Bearer ' + key,
  }
  if (route.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.NEXT_PUBLIC_APP_URL || 'https://altiv.online'
    headers['X-Title'] = 'ALTIV DEV'
  }

  const response = await fetch(def.baseUrl + def.chatPath, {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers,
    body:JSON.stringify({
      model:route.model,
      messages,
      temperature,
      max_tokens:maxTokens,
      stream:false,
    }),
  })
  if (!response.ok) throw new Error(def.label + ' / ' + route.model + ' falhou: ' + response.status + ' ' + (await response.text()).slice(0,300))
  const data = await response.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error(def.label + ' / ' + route.model + ' não retornou conteúdo.')
  return text
}

export async function callWithFallback(
  routes:ProviderRoute[],
  messages:ChatMessage[],
  options?:{timeoutMs?:number;maxTokens?:number;temperature?:number}
) {
  const errors:string[] = []
  for (const route of routes) {
    try {
      const text = await callProvider(route,messages,options)
      return {text,route}
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error('Nenhum modelo configurado concluiu a tarefa. ' + errors.join(' | '))
}
