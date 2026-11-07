import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_EXTENSION_REQUESTS_PER_DAY, MAX_EXTENSION_PROMPT_LENGTH, validateExtensionPrompt, isValidProjectId } from '../lib/extension-request.ts'

test('rejects missing, empty or too-short changes', () => {
  for (const value of [null, undefined, {}, 4, '', 'short', ' '.repeat(25)]) {
    assert.equal(validateExtensionPrompt(value), null)
  }
})
test('trims and normalizes valid requests', () => {
  assert.equal(validateExtensionPrompt('  Alterar o botão de contato.  '), 'Alterar o botão de contato.')
  assert.equal(validateExtensionPrompt('Atualizar texto de capa.').length > 12, true)
})
test('limits request size and denies control characters', () => {
  assert.equal(validateExtensionPrompt('A'.repeat(MAX_EXTENSION_PROMPT_LENGTH+1)), null)
  assert.equal(validateExtensionPrompt('A'.repeat(MAX_EXTENSION_PROMPT_LENGTH)), 'A'.repeat(MAX_EXTENSION_PROMPT_LENGTH))
  assert.equal(validateExtensionPrompt('Pedido normal\u0000 mais texto'), null)
  assert.equal(validateExtensionPrompt('Pedido com\nquebra de linha'), 'Pedido com\nquebra de linha')
})
test('accepts only canonical UUIDs and enforces finite daily quota', () => {
  assert.equal(isValidProjectId('2d8e3d3e-770a-4f4c-8a51-16bf5208a8d9'), true)
  assert.equal(isValidProjectId('2d8e3d3e-770a-4f4c-8a51-16bf5208a8d9/../../other'), false)
  assert.equal(isValidProjectId(''), false)
  assert.equal(MAX_EXTENSION_REQUESTS_PER_DAY, 10)
})
