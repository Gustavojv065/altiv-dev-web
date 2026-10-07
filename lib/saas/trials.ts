import { createAdminClient } from '@/lib/supabase/admin'
import { SAAS_PLANS, type PlanCode } from '@/lib/saas/plans'

export function activeTrialPlan(account:{
  status:string
  trial_plan_code?:string|null
  trial_ends_at?:string|null
}) {
  if (account.status !== 'trial' || !account.trial_plan_code || !account.trial_ends_at) return null
  if (new Date(account.trial_ends_at).getTime() <= Date.now()) return null
  const code = account.trial_plan_code as PlanCode
  return SAAS_PLANS[code] || null
}

export async function normalizeExpiredTrial(account:{
  id:string
  status:string
  trial_plan_code?:string|null
  trial_ends_at?:string|null
}) {
  if (account.status !== 'trial' || !account.trial_ends_at) return account
  if (new Date(account.trial_ends_at).getTime() > Date.now()) return account

  const supabase = createAdminClient()
  await supabase
    .from('saas_accounts')
    .update({
      status:'active',
      trial_plan_code:null,
      trial_ends_at:null,
      updated_at:new Date().toISOString(),
    })
    .eq('id',account.id)

  return { ...account, status:'active', trial_plan_code:null, trial_ends_at:null }
}
