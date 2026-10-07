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

function value(formData:FormData,key:string) {
  return String(formData.get(key) ?? '').trim()
}

export async function startTrial(formData:FormData) {
  await requireAdmin()
  const accountId = value(formData,'account_id')
  const planCode = value(formData,'trial_plan_code')
  const days = Number(value(formData,'trial_days'))
  if (!accountId || !['starter','pro','business'].includes(planCode) || ![7,14,30].includes(days)) {
    redirect('/admin/clients?error=' + encodeURIComponent('Configuração de teste inválida.'))
  }

  const endsAt = new Date(Date.now() + days * 86400000).toISOString()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('saas_accounts')
    .update({
      status:'trial',
      trial_plan_code:planCode,
      trial_ends_at:endsAt,
      updated_at:new Date().toISOString(),
    })
    .eq('id',accountId)

  if (error) redirect('/admin/clients?error=' + encodeURIComponent(error.message))
  revalidatePath('/admin')
  revalidatePath('/admin/clients')
  redirect('/admin/clients?message=' + encodeURIComponent('Período de teste ativado.'))
}

export async function endTrial(formData:FormData) {
  await requireAdmin()
  const accountId = value(formData,'account_id')
  if (!accountId) redirect('/admin/clients?error=' + encodeURIComponent('Conta inválida.'))

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('saas_accounts')
    .update({
      status:'active',
      trial_plan_code:null,
      trial_ends_at:null,
      updated_at:new Date().toISOString(),
    })
    .eq('id',accountId)

  if (error) redirect('/admin/clients?error=' + encodeURIComponent(error.message))
  revalidatePath('/admin')
  revalidatePath('/admin/clients')
  redirect('/admin/clients?message=' + encodeURIComponent('Período de teste encerrado.'))
}
