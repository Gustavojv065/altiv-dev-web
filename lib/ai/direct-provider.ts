import type { ProviderRoute } from './provider-catalog'

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }

type ProviderConfig = {
  key: string | undefined
  url: string
  headers: Record<string, string>
}

function providerConfig(route: ProviderRoute): ProviderConfig | null {
  switch (route.provider) {
    case 'openrouter':
      return {
        key: process.env.OPENROUTER_API_KEY,
        url: 'https://openrouter.ai/api/v1/chat/completions',
        headers: {
          'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://altiv.online',
          'X-Title': 'ALTIV DEV',
        } satisfies Record<string, string>,
      }
    case 'opencode-zen':
      return {
        key: process.env.OPENCODE_ZEN_API_KEY,
        url: 'https://opencode.ai/zen/v1/chat/completions',
        headers: {},
      }
    case 'openai':
      return {
        key: process.env.OPENAI_API_KEY,
        url: 'https://api.openai.com/v1/responses',
        headers: {},
      }
    case 'nvidia':
      return {
        key: process.env.NVIDIA_API_KEY,
        url: 'https://integrate.api.nvidia.com/v1/chat/completions',
        headers: {},
      }
    default:
      return null
  }
}

async function callGemini(route: ProviderRoute, messages: ChatMessage[], timeoutMs: number, maxTokens: number) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('Gemini não configurado.')
  const system = messages.find((message) => message.role === 'system')?.content || ''
  const turns = messages.filter((message) => message.role !== 'system')
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(route.model) + ':generateContent?key=' + encodeURIComponent(key)
  const response = await fetch(url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: turns.map((message) => ({
        role: message.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: message.content }],
      })),
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.45 },
    }),
  })
  if (!response.ok) throw new Error('Gemini falhou: ' + response.status + ' ' + (await response.text()).slice(0, 300))
  const data = await response.json()
  const text = data?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('').trim()
  if (!text) throw new Error('Gemini não retornou conteúdo.')
  return text
}

export async function callProvider(
  route: ProviderRoute,
  messages: ChatMessage[],
  options: { timeoutMs?: number; maxTokens?: number; temperature?: number } = {}
) {
  const timeoutMs = options.timeoutMs ?? 90000
  const maxTokens = options.maxTokens ?? 9000
  if (route.provider === 'gemini') return callGemini(route, messages, timeoutMs, maxTokens)

  if (route.provider === 'openai') {
    const key = process.env.OPENAI_API_KEY
    if (!key) throw new Error('OpenAI não configurada.')
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({
        model: route.model,
        input: messages.map((message) => ({
          role: message.role,
          content: [{ type: 'input_text', text: message.content }],
        })),
        max_output_tokens: maxTokens,
      }),
    })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error('openai / ' + route.model + ' falhou: ' + response.status + ' ' + detail.slice(0, 350))
    }
    const data = await response.json()
    const text = String(
      data?.output_text ??
      data?.output?.flatMap((item: { content?: Array<{ text?: string }> }) => item.content ?? [])
        ?.map((part: { text?: string }) => part.text || '').join('') ??
      ''
    ).trim()
    if (!text) throw new Error('openai / ' + route.model + ' não retornou conteúdo.')
    return text
  }

  const config = providerConfig(route)
  if (!config?.key) throw new Error(route.provider + ' não configurado.')

  const response = await fetch(config.url, {
    method: 'POST',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'content-type': 'application/json',
      authorization: 'Bearer ' + config.key,
      ...config.headers,
    },
    body: JSON.stringify({
      model: route.model,
      messages,
      temperature: options.temperature ?? 0.45,
      max_tokens: maxTokens,
      stream: false,
    }),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(route.provider + ' / ' + route.model + ' falhou: ' + response.status + ' ' + detail.slice(0, 350))
  }

  const data = await response.json()
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim()
  if (!text) throw new Error(route.provider + ' / ' + route.model + ' não retornou conteúdo.')
  return text
}

export async function callWithFallback(
  routes: ProviderRoute[],
  messages: ChatMessage[],
  options?: { timeoutMs?: number; maxTokens?: number; temperature?: number }
) {
  const errors: string[] = []
  for (const route of routes) {
    try {
      const text = await callProvider(route, messages, options)
      return { text, route }
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
    }
  }
  throw new Error('Nenhum modelo configurado concluiu a tarefa. ' + errors.join(' | '))
}
