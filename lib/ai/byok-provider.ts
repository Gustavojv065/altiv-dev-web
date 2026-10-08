import type { ProviderId, ProviderRoute } from './provider-catalog'
import { PROVIDER_REGISTRY } from './provider-registry'

export type UserProviderKeys = Partial<Record<ProviderId, string>>
type Message = { role:'system'|'user'|'assistant'; content:string }

async function callGemini(model:string, key:string, messages:Message[], timeoutMs:number, maxTokens:number, temperature:number) {
  const system = messages.find((m)=>m.role === 'system')?.content || ''
  const turns = messages.filter((m)=>m.role !== 'system')
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key),
    {
      method:'POST',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        systemInstruction:system ? { parts:[{text:system}] } : undefined,
        contents:turns.map((m)=>({ role:m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}] })),
        generationConfig:{ maxOutputTokens:maxTokens, temperature },
      }),
    }
  )
  if (!response.ok) throw new Error('Gemini falhou: ' + response.status + ' ' + (await response.text()).slice(0,220))
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p:{text?:string})=>p.text || '').join('').trim()
  if (!text) throw new Error('Gemini não retornou conteúdo.')
  return text
}

async function callOpenAIResponses(model:string,key:string,messages:Message[],timeoutMs:number,maxTokens:number) {
  const response = await fetch('https://api.openai.com/v1/responses', {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{'content-type':'application/json',authorization:'Bearer ' + key},
    body:JSON.stringify({
      model,
      input:messages.map((m)=>({ role:m.role, content:[{type:'input_text',text:m.content}] })),
      max_output_tokens:maxTokens,
    }),
  })
  if (!response.ok) throw new Error('OpenAI falhou: ' + response.status + ' ' + (await response.text()).slice(0,220))
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

async function callAnthropic(model:string,key:string,messages:Message[],timeoutMs:number,maxTokens:number,temperature:number) {
  const system = messages.find((m)=>m.role === 'system')?.content || ''
  const turns = messages.filter((m)=>m.role !== 'system')
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{
      'content-type':'application/json',
      'x-api-key':key,
      'anthropic-version':'2023-06-01',
    },
    body:JSON.stringify({
      model,
      system:system || undefined,
      messages:turns.map((m)=>({ role:m.role === 'assistant' ? 'assistant' : 'user', content:m.content })),
      max_tokens:maxTokens,
      temperature,
    }),
  })
  if (!response.ok) throw new Error('Anthropic falhou: ' + response.status + ' ' + (await response.text()).slice(0,220))
  const data = await response.json()
  const text = data?.content?.map((part:{text?:string})=>part.text || '').join('').trim()
  if (!text) throw new Error('Anthropic não retornou conteúdo.')
  return text
}

export async function callUserProvider(
  route:ProviderRoute,
  key:string,
  messages:Message[],
  options:{timeoutMs?:number;maxTokens?:number;temperature?:number}={}
) {
  const timeoutMs = options.timeoutMs ?? 90000
  const maxTokens = options.maxTokens ?? 9000
  const temperature = options.temperature ?? 0.45
  const def = PROVIDER_REGISTRY[route.provider]

  if (def.apiStyle === 'gemini') return callGemini(route.model,key,messages,timeoutMs,maxTokens,temperature)
  if (def.apiStyle === 'openai-responses') return callOpenAIResponses(route.model,key,messages,timeoutMs,maxTokens)
  if (def.apiStyle === 'anthropic') return callAnthropic(route.model,key,messages,timeoutMs,maxTokens,temperature)

  if (!def.baseUrl || !def.chatPath) throw new Error(def.label + ' não possui endpoint de chat configurado.')
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
  if (!response.ok) throw new Error(def.label + ' / ' + route.model + ' falhou: ' + response.status + ' ' + (await response.text()).slice(0,220))
  const data = await response.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error(def.label + ' / ' + route.model + ' não retornou conteúdo.')
  return text
}

export async function callUserFallback(
  routes:ProviderRoute[],
  keys:UserProviderKeys,
  messages:Message[],
  options?:{timeoutMs?:number;maxTokens?:number;temperature?:number}
) {
  const errors:string[] = []
  for (const route of routes) {
    const key = keys[route.provider]
    if (!key) continue
    try {
      const text = await callUserProvider(route,key,messages,options)
      return { text, route }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error('Nenhuma chave do usuário concluiu a tarefa. ' + errors.join(' | '))
}
