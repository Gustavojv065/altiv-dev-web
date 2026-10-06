import type { AgentTask } from '@/lib/agent/pipeline'

export type ModelRoute = {
  id: string
  role: string
  priority: number
}

const routes: Record<AgentTask, ModelRoute[]> = {
  code: [
    { id: 'openai/gpt-5.4', role: 'coding', priority: 1 },
    { id: 'anthropic/claude-opus-4.1', role: 'coding-fallback', priority: 2 },
    { id: 'google/gemini-3.1-pro-preview', role: 'large-context', priority: 3 },
  ],
  design: [
    { id: 'google/gemini-3.1-pro-preview', role: 'design', priority: 1 },
    { id: 'openai/gpt-5.4', role: 'implementation', priority: 2 },
  ],
  debug: [
    { id: 'openai/gpt-5.4', role: 'debug', priority: 1 },
    { id: 'anthropic/claude-opus-4.1', role: 'review', priority: 2 },
  ],
  plan: [
    { id: 'openai/gpt-5.4', role: 'architecture', priority: 1 },
    { id: 'google/gemini-3.1-pro-preview', role: 'large-context', priority: 2 },
  ],
  vision: [
    { id: 'google/gemini-3.1-pro-preview', role: 'vision', priority: 1 },
    { id: 'openai/gpt-5.4', role: 'implementation', priority: 2 },
  ],
  fast: [
    { id: 'openai/gpt-5.4-mini', role: 'fast', priority: 1 },
    { id: 'google/gemini-3.1-flash', role: 'fast-fallback', priority: 2 },
  ],
}

export function chooseProvider(task: AgentTask): ModelRoute[] {
  return routes[task]
}
