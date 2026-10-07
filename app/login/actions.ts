'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { validateNewPassword } from '@/lib/security/passwords'

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim()
}

export async function login(formData: FormData) {
  const supabase = await createClient()
  const email = value(formData, 'email')
  const password = value(formData, 'password')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/workspace')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = value(formData, 'email')
  const password = value(formData, 'password')
  const displayName = value(formData, 'display_name')
  const passwordError = await validateNewPassword(password)
  if (passwordError) redirect('/login?error=' + encodeURIComponent(passwordError))
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://altiv-dev-web.vercel.app'
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName }, emailRedirectTo: siteUrl + '/auth/confirm' },
  })
  if (error) redirect('/login?error=' + encodeURIComponent(error.message))
  redirect('/login?message=' + encodeURIComponent('Cadastro criado. Verifique seu e-mail para confirmar a conta.'))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
