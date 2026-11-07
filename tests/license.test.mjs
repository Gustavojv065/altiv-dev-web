import test from 'node:test'
import assert from 'node:assert/strict'
import { generateAccessCode, hashAccessCode, normalizeAccessCode, sha256, generateSessionToken } from '../lib/extension-license.ts'
test('access code has 128-bit random space and an ALT prefix', () => {
  const code = generateAccessCode()
  assert.match(code, /^ALT(-[A-F0-9]{4}){8}$/)
  assert.equal(normalizeAccessCode(code)?.length, 35)
})
test('normalizes separators but rejects truncated or extended codes', () => {
  const code = generateAccessCode()
  assert.equal(hashAccessCode(code), hashAccessCode(code.toLowerCase().replaceAll('-', '')))
  assert.equal(hashAccessCode(code + 'X'), null)
  assert.equal(hashAccessCode('ALT-1234'), null)
})
test('codes and session tokens are unique and cryptographically random', () => {
  const a = generateAccessCode(), b = generateAccessCode()
  const s1 = generateSessionToken(), s2 = generateSessionToken()
  assert.notEqual(a, b); assert.notEqual(s1, s2)
  assert.match(s1, /^[a-zA-Z0-9_-]{43}$/)
  assert.notEqual(sha256(s1), s1)
})
test('only a 64-digit SHA-256 hash is stored', () => {
  const code = generateAccessCode()
  assert.match(hashAccessCode(code), /^[a-f0-9]{64}$/)
  assert.ok(!hashAccessCode(code).includes(code))
})
