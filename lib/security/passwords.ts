import { createHash } from 'node:crypto'

export function passwordPolicyError(password:string) {
  if (password.length < 12) return 'A senha deve ter pelo menos 12 caracteres.'
  if (!/[a-z]/.test(password)) return 'Inclua pelo menos uma letra minúscula.'
  if (!/[A-Z]/.test(password)) return 'Inclua pelo menos uma letra maiúscula.'
  if (!/[0-9]/.test(password)) return 'Inclua pelo menos um número.'
  if (!/[^A-Za-z0-9]/.test(password)) return 'Inclua pelo menos um símbolo.'
  return null
}

export async function isLeakedPassword(password:string) {
  const digest = createHash('sha1').update(password,'utf8').digest('hex').toUpperCase()
  const prefix = digest.slice(0,5)
  const suffix = digest.slice(5)

  const response = await fetch('https://api.pwnedpasswords.com/range/' + prefix, {
    headers:{
      'Add-Padding':'true',
      'User-Agent':'ALTIV-DEV-password-check',
    },
    signal:AbortSignal.timeout(7000),
    cache:'no-store',
  })

  if (!response.ok) throw new Error('Serviço de verificação de senha indisponível.')
  const body = await response.text()
  return body.split(/\r?\n/).some((line) => line.split(':',1)[0].trim() === suffix)
}

export async function validateNewPassword(password:string) {
  const policy = passwordPolicyError(password)
  if (policy) return policy
  try {
    if (await isLeakedPassword(password)) {
      return 'Esta senha já apareceu em vazamentos conhecidos. Escolha outra senha.'
    }
  } catch {
    return 'Não foi possível verificar a segurança da senha agora. Tente novamente em instantes.'
  }
  return null
}
