/** Pure input guard: keep prompts bounded before database validation. */
export const MAX_EXTENSION_PROMPT_LENGTH = 2000
export const MIN_EXTENSION_PROMPT_LENGTH = 12
export const MAX_EXTENSION_REQUESTS_PER_DAY = 10

export function validateExtensionPrompt(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const value = raw.normalize('NFC').trim()
  if (value.length < MIN_EXTENSION_PROMPT_LENGTH || value.length > MAX_EXTENSION_PROMPT_LENGTH) return null
  if (/\u0000|[\u0001-\u0008\u000B\u000C\u000E-\u001F]/u.test(value)) return null
  return value
}
export function isValidProjectId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
}
