'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXTENSION_SESSION_COOKIE, generateSessionToken, hashAccessCode, sha256 } from '@/lib/extension-license'

export async function activateExtension(form: FormData) {
  const codeHash = hashAccessCode(String(form.get('codigo') ?? ''))
  if (!codeHash) redirect('/extension?erro=codigo-invalido')
  const token = generateSessionToken()
  const db = createAdminClient()
  // Atomic SQL RPC avoids double redemption / partially created sessions.
  const { data, error } = await db.rpc('redeem_altiv_extension_code', {
    p_code_hash: codeHash, p_session_hash: sha256(token),
  })
  const result = Array.isArray(data) ? data[0] : null
  if (error || !result?.session_expires_at) redirect('/extension?erro=codigo-invalido')
  const expiry = new Date(result.session_expires_at)
  if (!(expiry.getTime() > Date.now())) redirect('/extension?erro=codigo-invalido')
  const store = await cookies()
  store.set(EXTENSION_SESSION_COOKIE, token, {
    httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production',
    path: '/', expires: expiry,
  })
  redirect('/extension')
}

export async function exitExtension() {
  const store = await cookies()
  const token = store.get(EXTENSION_SESSION_COOKIE)?.value
  if (token) {
    await createAdminClient().from('altiv_extension_sessions').delete().eq('token_hash', sha256(token))
  }
  store.delete(EXTENSION_SESSION_COOKIE)
  redirect('/extension')
}
