import type { AgentTask } from '@/lib/agent/pipeline'

export type ProviderId = 'openrouter' | 'opencode-zen' | 'openai' | 'gemini' | 'nvidia'

export type ProviderRoute = {
  provider: ProviderId
  model: string
  free?: boolean
  role: string
}

const FREE_FIRST: Record<AgentTask, ProviderRoute[]> = {
  code: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-code-router' },
    { provider: 'opencode-zen', model: 'nemotron-3-ultra-free', free: true, role: 'zen-code-free' },
    { provider: 'nvidia', model: 'nvidia/nemotron-3-super-120b-a12b', role: 'coding' },
    { provider: 'openai', model: process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role: 'premium-code' },
    { provider: 'gemini', model: process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role: 'large-context' },
  ],
  design: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-design-router' },
    { provider: 'gemini', model: process.env.GEMINI_DESIGN_MODEL || 'gemini-3.1-pro-preview', role: 'design' },
    { provider: 'openai', model: process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role: 'implementation' },
  ],
  debug: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-debug-router' },
    { provider: 'opencode-zen', model: 'nemotron-3.5-lightning-free', free: true, role: 'zen-debug-free' },
    { provider: 'openai', model: process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role: 'debug' },
    { provider: 'gemini', model: process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role: 'review' },
  ],
  plan: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-planning-router' },
    { provider: 'openai', model: process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role: 'architecture' },
    { provider: 'gemini', model: process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role: 'large-context' },
  ],
  vision: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-vision-router' },
    { provider: 'gemini', model: process.env.GEMINI_VISION_MODEL || 'gemini-3.1-pro-preview', role: 'vision' },
    { provider: 'openai', model: process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role: 'implementation' },
  ],
  fast: [
    { provider: 'openrouter', model: 'openrouter/free', free: true, role: 'free-fast-router' },
    { provider: 'opencode-zen', model: 'ling-3.0-flash-fin-free', free: true, role: 'zen-fast-free' },
    { provider: 'gemini', model: process.env.GEMINI_FAST_MODEL || 'gemini-3.1-flash', role: 'fast' },
  ],
}

function hasProviderKey(provider: ProviderId, available?: Set<ProviderId>) {
  if (available?.has(provider)) return true
  switch (provider) {
    case 'openrouter': return Boolean(process.env.OPENROUTER_API_KEY)
    case 'opencode-zen': return Boolean(process.env.OPENCODE_ZEN_API_KEY)
    case 'openai': return Boolean(process.env.OPENAI_API_KEY)
    case 'gemini': return Boolean(process.env.GEMINI_API_KEY)
    case 'nvidia': return Boolean(process.env.NVIDIA_API_KEY)
  }
}

export function providerRoutesFor(task: AgentTask, preferFree = true, available?: Set<ProviderId>) {
  const routes = FREE_FIRST[task].filter((route) => hasProviderKey(route.provider, available))
  return preferFree ? routes.sort((a, b) => Number(Boolean(b.free)) - Number(Boolean(a.free))) : routes
}

export function configuredProviders(): ProviderId[] {
  return (['openrouter', 'opencode-zen', 'openai', 'gemini', 'nvidia'] as ProviderId[])
    .filter(hasProviderKey)
}
