export type ProjectMemory = {
  id: string
  projectId: string
  userId: string
  kind: 'decision' | 'preference' | 'architecture' | 'bug' | 'solution' | 'context'
  content: string
  importance: number
  embedding?: number[]
  createdAt: string
}

export type MemoryQuery = {
  projectId: string
  userId: string
  text: string
  limit?: number
}

export const MEMORY_POLICY = {
  maxRetrievedItems: 12,
  summarizeAfterMessages: 20,
  keepProjectIsolation: true,
  neverStoreSecrets: true,
} as const
