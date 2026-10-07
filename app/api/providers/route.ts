import { NextResponse } from 'next/server'
import { configuredProviders } from '@/lib/ai/provider-catalog'

const catalog = [
  { id: 'openrouter', label: 'OpenRouter', supportsFree: true, freeModel: 'openrouter/free', byok: true },
  { id: 'opencode-zen', label: 'OpenCode Zen', supportsFree: true, freeModel: 'nemotron-3-ultra-free', byok: true },
  { id: 'openai', label: 'OpenAI', supportsFree: false, byok: true },
  { id: 'gemini', label: 'Gemini', supportsFree: false, byok: true },
  { id: 'nvidia', label: 'NVIDIA', supportsFree: false, byok: true },
] as const

export async function GET() {
  const configured = new Set(configuredProviders())
  return NextResponse.json({
    ok: true,
    providers: catalog.map((provider) => ({
      ...provider,
      configured: configured.has(provider.id),
    })),
    routing: {
      mode: 'free-first-with-fallback',
      rule: 'Use only providers configured on the server; never expose API keys to the browser.',
    },
  })
}
