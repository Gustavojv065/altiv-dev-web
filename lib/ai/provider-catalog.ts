import type { AgentTask } from '@/lib/agent/pipeline'

export type ProviderId =
  | 'openrouter'
  | 'opencode-zen'
  | 'openai'
  | 'gemini'
  | 'nvidia'
  | 'groq'
  | 'cerebras'
  | 'deepseek'
  | 'mistral'
  | 'together'
  | 'fireworks'
  | 'xai'
  | 'anthropic'

export type ProviderRoute = {
  provider: ProviderId
  model: string
  free?: boolean
  role: string
}

const FREE_FIRST: Record<AgentTask, ProviderRoute[]> = {
  code: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-code-router' },
    { provider:'groq', model:'openai/gpt-oss-120b', free:true, role:'free-code-groq' },
    { provider:'opencode-zen', model:'nemotron-3-ultra-free', free:true, role:'zen-code-free' },
    { provider:'groq', model:'openai/gpt-oss-120b', free:true, role:'fast-code' },
    { provider:'cerebras', model:'gpt-oss-120b', free:true, role:'fast-code' },
    { provider:'nvidia', model:'nvidia/nemotron-3-super-120b-a12b', role:'coding' },
    { provider:'deepseek', model:'deepseek-chat', role:'coding' },
    { provider:'mistral', model:'codestral-latest', role:'coding' },
    { provider:'anthropic', model:'claude-sonnet-4-5', role:'premium-code' },
    { provider:'openai', model:process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role:'premium-code' },
    { provider:'gemini', model:process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role:'large-context' },
  ],
  design: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-design-router' },
    { provider:'gemini', model:process.env.GEMINI_DESIGN_MODEL || 'gemini-3.1-pro-preview', role:'design-vision' },
    { provider:'anthropic', model:'claude-sonnet-4-5', role:'design-review' },
    { provider:'openai', model:process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role:'implementation' },
    { provider:'together', model:'meta-llama/Llama-4-Maverick-17B-128E-Instruct-FP8', role:'design-alt' },
  ],
  debug: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-debug-router' },
    { provider:'opencode-zen', model:'nemotron-3.5-lightning-free', free:true, role:'zen-debug-free' },
    { provider:'cerebras', model:'gpt-oss-120b', free:true, role:'fast-debug' },
    { provider:'deepseek', model:'deepseek-reasoner', role:'reasoning' },
    { provider:'anthropic', model:'claude-sonnet-4-5', role:'review' },
    { provider:'openai', model:process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role:'debug' },
    { provider:'gemini', model:process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role:'review' },
  ],
  plan: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-planning-router' },
    { provider:'groq', model:'openai/gpt-oss-120b', free:true, role:'free-planning-groq' },
    { provider:'cerebras', model:'gpt-oss-120b', free:true, role:'fast-plan' },
    { provider:'deepseek', model:'deepseek-reasoner', role:'reasoning' },
    { provider:'anthropic', model:'claude-sonnet-4-5', role:'architecture' },
    { provider:'openai', model:process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role:'architecture' },
    { provider:'gemini', model:process.env.GEMINI_CODE_MODEL || 'gemini-3.1-pro-preview', role:'large-context' },
  ],
  vision: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-vision-router' },
    { provider:'gemini', model:process.env.GEMINI_FREE_MODEL || 'gemini-2.5-flash', free:true, role:'free-vision-gemini' },
    { provider:'gemini', model:process.env.GEMINI_VISION_MODEL || 'gemini-3.1-pro-preview', role:'vision' },
    { provider:'xai', model:'grok-4', role:'vision-alt' },
    { provider:'openai', model:process.env.OPENAI_CODE_MODEL || 'gpt-5.6-sol', role:'implementation' },
    { provider:'anthropic', model:'claude-sonnet-4-5', role:'vision-review' },
  ],
  fast: [
    { provider:'openrouter', model:'openrouter/free', free:true, role:'free-fast-router' },
    { provider:'groq', model:'openai/gpt-oss-120b', free:true, role:'free-fast-groq' },
    { provider:'opencode-zen', model:'ling-3.0-flash-fin-free', free:true, role:'zen-fast-free' },
    { provider:'groq', model:'llama-3.3-70b-versatile', free:true, role:'fast' },
    { provider:'cerebras', model:'llama3.1-8b', free:true, role:'fast' },
    { provider:'gemini', model:process.env.GEMINI_FAST_MODEL || 'gemini-3.1-flash', role:'fast' },
    { provider:'mistral', model:'mistral-small-latest', role:'fast' },
  ],
}

const ALL_PROVIDER_IDS:ProviderId[] = [
  'openrouter','opencode-zen','openai','gemini','nvidia','groq','cerebras',
  'deepseek','mistral','together','fireworks','xai','anthropic',
]

function envKey(provider:ProviderId) {
  const map:Record<ProviderId,string|undefined> = {
    openrouter:process.env.OPENROUTER_API_KEY,
    'opencode-zen':process.env.OPENCODE_ZEN_API_KEY,
    openai:process.env.OPENAI_API_KEY,
    gemini:process.env.GEMINI_API_KEY,
    nvidia:process.env.NVIDIA_API_KEY,
    groq:process.env.GROQ_API_KEY,
    cerebras:process.env.CEREBRAS_API_KEY,
    deepseek:process.env.DEEPSEEK_API_KEY,
    mistral:process.env.MISTRAL_API_KEY,
    together:process.env.TOGETHER_API_KEY,
    fireworks:process.env.FIREWORKS_API_KEY,
    xai:process.env.XAI_API_KEY,
    anthropic:process.env.ANTHROPIC_API_KEY,
  }
  return map[provider]
}

function hasProviderKey(provider: ProviderId, available?: Set<ProviderId>) {
  if (available?.has(provider)) return true
  return Boolean(envKey(provider))
}

export function providerRoutesFor(task: AgentTask, preferFree = true, available?: Set<ProviderId>) {
  const routes = FREE_FIRST[task].filter((route) => hasProviderKey(route.provider, available))
  return preferFree ? routes.sort((a,b)=>Number(Boolean(b.free))-Number(Boolean(a.free))) : routes
}

export function configuredProviders(): ProviderId[] {
  return ALL_PROVIDER_IDS.filter((provider)=>hasProviderKey(provider))
}

export function providerEnvKey(provider:ProviderId) {
  return envKey(provider)
}

export function allProviderIds() {
  return [...ALL_PROVIDER_IDS]
}
