import { createHash, randomBytes } from 'node:crypto'
/** 128-bit random, readable, one-use access code. */
export function generateAccessCode() {
  const hex = randomBytes(16).toString('hex').toUpperCase()
  return `ALT-${hex.match(/.{4}/g)!.join('-')}`
}
export function normalizeAccessCode(input: string) {
  const text = input.replace(/[\s-]/g, '').toUpperCase()
  return /^ALT[A-F0-9]{32}$/.test(text) ? text : null
}
export function sha256(text: string) { return createHash('sha256').update(text, 'utf8').digest('hex') }
export function hashAccessCode(input: string) {
  const normalized = normalizeAccessCode(input)
  return normalized ? sha256(normalized) : null
}
export function generateSessionToken() { return randomBytes(32).toString('base64url') }
export const EXTENSION_SESSION_COOKIE = 'altiv_ext_session'
export const ACCESS_CODE_DURATION_DAYS = 30
