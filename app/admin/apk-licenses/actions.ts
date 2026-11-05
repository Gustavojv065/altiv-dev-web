'use server'

import 'server-only'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'

const path = '/admin/apk-licenses'
const DAYS = 30
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const value = (form: FormData, key: string) => String(form.get(key) ?? '').trim()
const flash = (kind: 'message' | 'error', message: string) =>
  redirect(path + '?' + kind + '=' + encodeURIComponent(message))

/**
 * Stronger privilege boundary for issuing paid APK entitlements. We deliberately
 * do not trust profiles.role alone: it may be editable through older RLS.
 */
export async function requireApkLicenseAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) redirect('/workspace')
  const ids = (process.env.ALTIV_SUPER_ADMIN_IDS ?? '').split(',').map(x => x.trim()).filter(Boolean)
  const emails = (process.env.ALTIV_SUPER_ADMIN_EMAILS ?? '').split(',')
    .map(x => x.trim().toLowerCase()).filter(Boolean)
  if (!ids.includes(user.id) && !emails.includes(user.email.toLowerCase())) redirect('/workspace')
  return user
}

function configInviteUrl() {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:') return null
    return url.origin + '/ativar'
  } catch { return null }
}

async function recordEvent(
  userId: string, actorId: string,
  action: 'invited' | 'linked' | 'renewed' | 'suspended' | 'cancelled',
  previous: string | null, next: string | null,
) {
  const admin = createAdminClient()
  const { error } = await admin.from('altiv_apk_license_events').insert({
    user_id: userId, actor_id: actorId, action,
    previous_expires_at: previous, new_expires_at: next,
  })
  if (error) throw new Error('Falha no registro de auditoria. Verifique o painel antes de repetir a ação.')
}

export async function inviteApkCustomer(form: FormData) {
  const actor = await requireApkLicenseAdmin()
  const email = value(form, 'email').toLowerCase()
  if (email.length > 254 || !EMAIL.test(email)) flash('error', 'Informe um e-mail válido.')
  const redirectTo = configInviteUrl()
  if (!redirectTo) flash('error', 'Configure NEXT_PUBLIC_SITE_URL (HTTPS) antes de convidar clientes.')

  const admin = createAdminClient()
  // Fail closed before sending an invite if the migration has not been applied.
  const { error: migrationError } = await admin.from('altiv_service_subscriptions')
    .select('user_id').limit(1)
  if (migrationError) flash('error', 'A migração das licenças APK ainda não está aplicada no Supabase.')

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: redirectTo!,
  })
  if (error || !data.user?.id) {
    flash('error', 'Não foi possível enviar o convite. Se o e-mail já tem conta, vincule o UUID existente.')
  }

  const from = new Date()
  const until = new Date(from.getTime() + DAYS * 86400000)
  const { error: licenseError } = await admin.from('altiv_service_subscriptions').insert({
    user_id: data.user!.id,
    plan_code: 'monthly',
    status: 'active',
    valid_from: from.toISOString(),
    valid_until: until.toISOString(),
  })
  if (licenseError) {
    flash('error', 'O convite foi criado, mas a licença não foi ativada. Vincule o usuário existente antes de reenviar.')
  }

  await recordEvent(data.user!.id, actor.id, 'invited', null, until.toISOString())
  revalidatePath(path)
  flash('message', 'Convite enviado por e-mail e licença de 30 dias criada.')
}

export async function linkExistingApkUser(form: FormData) {
  const actor = await requireApkLicenseAdmin()
  const userId = value(form, 'user_id')
  if (!UUID.test(userId)) flash('error', 'Informe o UUID de um usuário Supabase Auth existente.')
  const admin = createAdminClient()
  const { data, error: userError } = await admin.auth.admin.getUserById(userId)
  if (userError || !data.user) flash('error', 'Usuário não encontrado no Supabase Auth.')

  const { data: current, error: lookupError } = await admin.from('altiv_service_subscriptions')
    .select('user_id').eq('user_id', userId).maybeSingle()
  if (lookupError) flash('error', 'A migração das licenças APK ainda não foi aplicada.')
  if (current) flash('error', 'O usuário já possui licença. Use Renovar ou Suspender.')

  const from = new Date()
  const until = new Date(from.getTime() + DAYS * 86400000)
  const { error } = await admin.from('altiv_service_subscriptions').insert({
    user_id: userId, plan_code: 'monthly', status: 'active',
    valid_from: from.toISOString(), valid_until: until.toISOString(),
  })
  if (error) flash('error', 'Não foi possível vincular a licença.')
  await recordEvent(userId, actor.id, 'linked', null, until.toISOString())
  revalidatePath(path)
  flash('message', 'Licença de 30 dias ativada para o usuário existente.')
}

export async function renewApkLicense(form: FormData) {
  const actor = await requireApkLicenseAdmin()
  const userId = value(form, 'user_id')
  if (!UUID.test(userId)) flash('error', 'Licença inválida.')
  const admin = createAdminClient()
  const { data, error } = await admin.from('altiv_service_subscriptions')
    .select('valid_until').eq('user_id', userId).maybeSingle()
  if (error || !data) flash('error', 'Não foi possível encontrar a licença.')

  // Extends existing validity if still active; starts from today if expired.
  const now = Date.now()
  const oldExpiry = String(data!.valid_until)
  const base = Math.max(now, new Date(oldExpiry).getTime())
  if (!Number.isFinite(base)) flash('error', 'Data de vencimento inválida.')
  const next = new Date(base + DAYS * 86400000).toISOString()

  // Optimistic concurrency: repeated concurrent clicks cannot silently
  // overwrite each other's date. Always re-read after a conflict.
  const { data: updated, error: updateError } = await admin.from('altiv_service_subscriptions')
    .update({ status: 'active', plan_code: 'monthly', valid_from: new Date(now).toISOString(),
      valid_until: next, updated_at: new Date(now).toISOString() })
    .eq('user_id', userId).eq('valid_until', oldExpiry)
    .select('user_id').maybeSingle()
  if (updateError || !updated) flash('error', 'Não foi possível renovar. Atualize a página para verificar alterações concorrentes.')
  await recordEvent(userId, actor.id, 'renewed', oldExpiry, next)
  revalidatePath(path)
  flash('message', 'Licença renovada por mais 30 dias.')
}

export async function suspendApkLicense(form: FormData) {
  const actor = await requireApkLicenseAdmin()
  const userId = value(form, 'user_id')
  if (!UUID.test(userId)) flash('error', 'Licença inválida.')
  const admin = createAdminClient()
  const { data, error } = await admin.from('altiv_service_subscriptions')
    .update({ status: 'suspended', updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('valid_until').maybeSingle()
  if (error || !data) flash('error', 'Não foi possível suspender a licença.')
  await recordEvent(userId, actor.id, 'suspended', data.valid_until, data.valid_until)
  revalidatePath(path)
  flash('message', 'Acesso aos serviços comerciais suspenso, sem apagar dados locais.')
}
