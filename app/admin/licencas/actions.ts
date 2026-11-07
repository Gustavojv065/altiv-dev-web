'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { ACCESS_CODE_DURATION_DAYS, generateAccessCode, hashAccessCode } from '@/lib/extension-license'

export type IssueState = { error: string; code: string }
const EMPTY: IssueState = { error: '', code: '' }
const uuid = /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i

export async function issueExtensionLicense(_previous: IssueState, form: FormData): Promise<IssueState> {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) return { ...EMPTY, error: 'Sem permissão.' }
  const accountId = String(form.get('account_id') || '')
  if (!uuid.test(accountId)) return { ...EMPTY, error: 'Conta inválida.' }
  const db = createAdminClient()
  const { data: account } = await db.from('saas_accounts').select('id,status').eq('id', accountId).maybeSingle()
  if (!account || !['active', 'trial'].includes(account.status)) {
    return { ...EMPTY, error: 'Conta não encontrada ou suspensa.' }
  }
  const code = generateAccessCode()
  const expiresAt = new Date(Date.now() + ACCESS_CODE_DURATION_DAYS * 86400000).toISOString()
  const { error } = await db.from('altiv_extension_licenses').insert({
    account_id: accountId, created_by: user.id,
    code_hash: hashAccessCode(code), expires_at: expiresAt,
  })
  if (error) return { ...EMPTY, error: 'Falha ao emitir. Confira a migração no ambiente de homologação.' }
  revalidatePath('/admin/licencas')
  return { code, error: '' }
}

export async function revokeExtensionLicense(form: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) redirect('/workspace')
  const licenseId = String(form.get('license_id') || '')
  if (!uuid.test(licenseId)) redirect('/admin/licencas')
  const db = createAdminClient()
  await db.from('altiv_extension_licenses')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', licenseId).is('revoked_at', null)
  revalidatePath('/admin/licencas')
  redirect('/admin/licencas')
}
