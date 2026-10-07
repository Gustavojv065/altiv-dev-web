'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')
}

function numberValue(formData:FormData,key:string) {
  const raw = String(formData.get(key) ?? '').replace(',','.').trim()
  if (!raw) return null
  const value = Number(raw)
  return Number.isFinite(value) && value >= 0 ? value : NaN
}

export async function updatePlanPrices(formData:FormData) {
  await requireAdmin()
  const code = String(formData.get('code') ?? '')
  if (!['free','starter','pro','business'].includes(code)) redirect('/admin/plans?error=Plano%20inválido')

  const monthly = numberValue(formData,'price_monthly_brl')
  const yearly = numberValue(formData,'price_yearly_brl')
  if (Number.isNaN(monthly) || Number.isNaN(yearly)) redirect('/admin/plans?error=Preço%20inválido')

  const admin = createAdminClient()
  const { error } = await admin
    .from('saas_plans')
    .update({
      price_monthly_brl:monthly,
      price_yearly_brl:yearly,
      updated_at:new Date().toISOString(),
    })
    .eq('code',code)

  if (error) redirect('/admin/plans?error=' + encodeURIComponent(error.message))
  revalidatePath('/admin/plans')
  redirect('/admin/plans?message=' + encodeURIComponent('Preços atualizados.'))
}
