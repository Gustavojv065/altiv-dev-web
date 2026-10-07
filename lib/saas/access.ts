import { createClient } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  return {
    id: String(data.claims.sub),
    email: typeof data.claims.email === 'string' ? data.claims.email : '',
  }
}

export async function isSuperAdmin(userId:string, email?:string) {
  const ids = (process.env.ALTIV_SUPER_ADMIN_IDS || '').split(',').map((v) => v.trim()).filter(Boolean)
  const emails = (process.env.ALTIV_SUPER_ADMIN_EMAILS || '').split(',').map((v) => v.trim().toLowerCase()).filter(Boolean)
  if (ids.includes(userId)) return true
  if (email && emails.includes(email.toLowerCase())) return true

  try {
    const supabase = await createClient()
    const { data } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
    return data?.role === 'super_admin'
  } catch {
    return false
  }
}
