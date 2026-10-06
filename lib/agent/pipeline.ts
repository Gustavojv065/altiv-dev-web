export type AgentStage =
  | 'understand'
  | 'plan'
  | 'retrieve-memory'
  | 'generate'
  | 'validate'
  | 'preview'
  | 'browser-test'
  | 'commit'
  | 'deploy'

export type AgentTask = 'code' | 'design' | 'debug' | 'plan' | 'vision' | 'fast'

export const PIPELINE: AgentStage[] = [
  'understand',
  'plan',
  'retrieve-memory',
  'generate',
  'validate',
  'preview',
  'browser-test',
  'commit',
  'deploy',
]

export function classifyTask(prompt: string): AgentTask {
  if (/imagem|screenshot|visual|layout|logo|design/i.test(prompt)) return 'vision'
  if (/erro|bug|corrig|quebr|falh/i.test(prompt)) return 'debug'
  if (/planej|arquitet|estrutura|roadmap/i.test(prompt)) return 'plan'
  if (/rápid|rapido|fast|simples/i.test(prompt)) return 'fast'
  if (/site|página|pagina|interface|landing/i.test(prompt)) return 'design'
  return 'code'
}
