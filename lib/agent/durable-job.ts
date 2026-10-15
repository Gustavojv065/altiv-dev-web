/**
 * Queue payload contract for the external ALTIV worker.
 * IMPORTANT: do not accept ownerId from client input. Derive it from authenticated claims.
 * This module does not execute jobs or replace the existing synchronous /api/agent route.
 */
export type AltivAgentJob = {
  schemaVersion: 1
  jobId: string
  ownerId: string
  projectId: string
  prompt: string
  requestedAt: string
}
export const MAX_QUEUED_PROMPT_LENGTH = 12000
export function validateAgentJob(value: unknown): AltivAgentJob {
  if (!value || typeof value !== 'object') throw new Error('Invalid job payload')
  const job = value as Record<string, unknown>
  for (const field of ['jobId','ownerId','projectId','requestedAt'] as const) {
    if (typeof job[field] !== 'string' || !(job[field] as string).trim()) throw new Error('Invalid job field: ' + field)
  }
  if (job.schemaVersion !== 1) throw new Error('Unsupported job schema')
  if (typeof job.prompt !== 'string' || !job.prompt.trim() || job.prompt.length > MAX_QUEUED_PROMPT_LENGTH) {
    throw new Error('Invalid prompt length')
  }
  return job as AltivAgentJob
}
