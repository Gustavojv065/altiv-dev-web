import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

function encryptionKey() {
  const raw = process.env.ALTIV_SECRET_ENCRYPTION_KEY
  if (!raw) throw new Error('ALTIV_SECRET_ENCRYPTION_KEY não configurada.')
  const key = Buffer.from(raw, 'base64')
  if (key.length !== 32) throw new Error('ALTIV_SECRET_ENCRYPTION_KEY deve ter 32 bytes em base64.')
  return key
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  }
}

export function decryptSecret(input: { ciphertext: string; iv: string; tag: string }) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(input.iv, 'base64'))
  decipher.setAuthTag(Buffer.from(input.tag, 'base64'))
  return Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, 'base64')),
    decipher.final(),
  ]).toString('utf8')
}
