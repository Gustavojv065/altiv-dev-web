'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PlanCode } from '@/lib/saas/plans'

async function requireAdmin() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')
  return user
}

function formValue(formData:FormData,key:string) {
  return String(formData.get(key) ?? '').trim()
}

export async function setAccountStatus(formData:FormData) {
  await requireAdmin()
  const accountId = formValue(formData,'account_id')
  const status = formValue(formData,'status')
  const allowed = new Set(['trial','active','past_due','suspended','canceled'])
  if (!accountId || !allowed.has(status)) redirect('/admin/clients?error=Dados%20inválidos')

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('saas_accounts')
    .update({ status, updated_at:new Date().toISOString() })
    .eq('id',accountId)

  if (error) redirect('/admin/clients?error=' + encodeURIComponent(error.message))
  revalidatePath('/admin')
  revalidatePath('/admin/clients')
  redirect('/admin/clients?message=' + encodeURIComponent('Status da conta atualizado.'))
}

export async function setAccountPlan(formData:FormData) {
  await requireAdmin()
  const accountId = formValue(formData,'account_id')
  const planCode = formValue(formData,'plan_code') as PlanCode
  const allowed = new Set<PlanCode>(['free','starter','pro','business'])
  if (!accountId || !allowed.has(planCode)) redirect('/admin/clients?error=Plano%20inválido')

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const { data:current } = await supabase
    .from('saas_subscriptions')
    .select('id')
    .eq('account_id',accountId)
    .in('status',['trialing','active','past_due','paused'])
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle()

  if (current?.id) {
    const { error } = await supabase
      .from('saas_subscriptions')
      .update({ plan_code:planCode, status:'active', updated_at:now })
      .eq('id',current.id)
    if (error) redirect('/admin/clients?error=' + encodeURIComponent(error.message))
  } else {
    const { error } = await supabase.from('saas_subscriptions').insert({
      account_id:accountId,
      plan_code:planCode,
      status:'active',
      current_period_start:now,
    })
    if (error) redirect('/admin/clients?error=' + encodeURIComponent(error.message))
  }

  revalidatePath('/admin')
  revalidatePath('/admin/clients')
  redirect('/admin/clients?message=' + encodeURIComponent('Plano atualizado para ' + planCode + '.'))
}
