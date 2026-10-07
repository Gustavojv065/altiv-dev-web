import type { ProviderId, ProviderRoute } from './provider-catalog'

export type UserProviderKeys = Partial<Record<ProviderId, string>>
type Message = { role:'system'|'user'|'assistant'; content:string }

async function gemini(model:string, key:string, messages:Message[], timeoutMs:number, maxTokens:number) {
  const system = messages.find((m) => m.role === 'system')?.content || ''
  const turns = messages.filter((m) => m.role !== 'system')
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(key),
    {
      method:'POST',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        systemInstruction: system ? { parts:[{text:system}] } : undefined,
        contents:turns.map((m) => ({ role:m.role === 'assistant' ? 'model' : 'user', parts:[{text:m.content}] })),
        generationConfig:{ maxOutputTokens:maxTokens, temperature:0.45 },
      }),
    }
  )
  if (!response.ok) throw new Error('Gemini falhou: ' + response.status)
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((p:{text?:string}) => p.text || '').join('').trim()
  if (!text) throw new Error('Gemini não retornou conteúdo.')
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
  if (route.provider === 'gemini') return gemini(route.model, key, messages, timeoutMs, maxTokens)

  if (route.provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST',
      signal:AbortSignal.timeout(timeoutMs),
      headers:{'content-type':'application/json',authorization:'Bearer ' + key},
      body:JSON.stringify({
        model:route.model,
        input:messages.map((m) => ({ role:m.role, content:[{type:'input_text',text:m.content}] })),
        max_output_tokens:maxTokens,
      }),
    })
    if (!response.ok) throw new Error('OpenAI falhou: ' + response.status)
    const data = await response.json()
    const text = String(data?.output_text ?? '').trim()
    if (!text) throw new Error('OpenAI não retornou conteúdo.')
    return text
  }

  const url =
    route.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' :
    route.provider === 'opencode-zen' ? 'https://opencode.ai/zen/v1/chat/completions' :
    route.provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' :
    ''

  if (!url) throw new Error('Provider não suportado.')
  const response = await fetch(url, {
    method:'POST',
    signal:AbortSignal.timeout(timeoutMs),
    headers:{
      'content-type':'application/json',
      authorization:'Bearer ' + key,
      ...(route.provider === 'openrouter' ? {
        'HTTP-Referer':process.env.NEXT_PUBLIC_APP_URL || 'https://altiv.online',
        'X-Title':'ALTIV DEV',
      } : {}),
    },
    body:JSON.stringify({
      model:route.model,
      messages,
      temperature:options.temperature ?? 0.45,
      max_tokens:maxTokens,
      stream:false,
    }),
  })
  if (!response.ok) throw new Error(route.provider + ' falhou: ' + response.status)
  const data = await response.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error(route.provider + ' não retornou conteúdo.')
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
      const text = await callUserProvider(route, key, messages, options)
      return { text, route }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error('Nenhuma chave do usuário concluiu a tarefa. ' + errors.join(' | '))
}
