import 'server-only'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXTENSION_SESSION_COOKIE, sha256 } from '@/lib/extension-license'

export async function getExtensionSession() {
  const token = (await cookies()).get(EXTENSION_SESSION_COOKIE)?.value
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const { data: session, error } = await supabase
    .from('altiv_extension_sessions')
    .select('license_id,expires_at')
    .eq('token_hash', sha256(token))
    .is('revoked_at', null).gt('expires_at', now).maybeSingle()
  if (error || !session) return null
  const { data: license } = await supabase.from('altiv_extension_licenses')
    .select('account_id,expires_at,revoked_at').eq('id', session.license_id).maybeSingle()
  if (!license || license.revoked_at || license.expires_at <= now) return null
  const { data: account } = await supabase.from('saas_accounts')
    .select('name,owner_id,status,trial_ends_at').eq('id', license.account_id).maybeSingle()
  if (!account || !['active', 'trial'].includes(account.status)) return null
  if (account.status === 'trial' && (!account.trial_ends_at || account.trial_ends_at <= now)) return null
  return { accountId: license.account_id as string, accountName: account.name as string, ownerId: account.owner_id as string, licenseId: session.license_id as string, expiresAt: session.expires_at as string }
}
