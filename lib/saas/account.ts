import { createClient } from '@/lib/supabase/server'
import { SAAS_PLANS, type PlanCode } from '@/lib/saas/plans'

function slugify(value:string) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42) || 'workspace'
}

export async function ensureSaasAccount(user:{id:string;email?:string}) {
  const supabase = await createClient()
  const { data: existing } = await supabase
    .from('saas_accounts')
    .select('id,name,slug,status')
    .eq('owner_id', user.id)
    .order('created_at',{ascending:true})
    .limit(1)
    .maybeSingle()

  if (existing) {
    await ensureFreeSubscription(existing.id)
    return existing
  }

  const base = slugify((user.email || 'workspace').split('@')[0])
  let account:null|{id:string;name:string;slug:string;status:string} = null

  for (let attempt=0;attempt<4 && !account;attempt++) {
    const suffix = attempt === 0 ? '' : '-' + Math.random().toString(36).slice(2,7)
    const { data, error } = await supabase.from('saas_accounts').insert({
      owner_id:user.id,
      name:'Meu Workspace',
      slug:base + suffix,
      status:'active',
    }).select('id,name,slug,status').single()
    if (!error && data) account = data
  }

  if (!account) throw new Error('Não foi possível criar a conta SaaS.')

  await supabase.from('saas_memberships').upsert({
    account_id:account.id,
    user_id:user.id,
    role:'owner',
  }, { onConflict:'account_id,user_id' })

  await ensureFreeSubscription(account.id)
  return account
}

async function ensureFreeSubscription(accountId:string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('saas_subscriptions')
    .select('id')
    .eq('account_id',accountId)
    .in('status',['trialing','active','past_due','paused'])
    .limit(1)
    .maybeSingle()

  if (!data) {
    await supabase.from('saas_subscriptions').insert({
      account_id:accountId,
      plan_code:'free',
      status:'active',
      current_period_start:new Date().toISOString(),
    })
  }
}

export async function getAccountPlan(ownerId:string) {
  const supabase = await createClient()
  const account = await ensureSaasAccount({id:ownerId})
  const { data:subscription } = await supabase
    .from('saas_subscriptions')
    .select('plan_code,status,current_period_start,current_period_end')
    .eq('account_id',account.id)
    .in('status',['trialing','active','past_due','paused'])
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle()

  if (account.status === 'suspended') throw new Error('Esta conta está suspensa. Entre em contato com o suporte.')
  if (account.status === 'canceled') throw new Error('Esta conta foi cancelada.')
  const code = (subscription?.plan_code || 'free') as PlanCode
  return { account, subscription, plan:SAAS_PLANS[code] || SAAS_PLANS.free }
}

export async function assertProjectLimit(ownerId:string) {
  const supabase = await createClient()
  const context = await getAccountPlan(ownerId)
  const { count } = await supabase.from('projects').select('*',{count:'exact',head:true}).eq('owner_id',ownerId)
  if ((count ?? 0) >= context.plan.projects) {
    throw new Error('Limite de ' + context.plan.projects + ' projetos atingido no plano ' + context.plan.label + '.')
  }
  return context
}

export async function assertAgentRunLimit(ownerId:string) {
  const supabase = await createClient()
  const context = await getAccountPlan(ownerId)
  const now = new Date()
  const start = new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString()
  const { data } = await supabase
    .from('usage_events')
    .select('quantity')
    .eq('owner_id',ownerId)
    .eq('event_type','agent_run')
    .gte('created_at',start)

  const used = (data ?? []).reduce((sum,row) => sum + Number(row.quantity || 0),0)
  if (used >= context.plan.monthlyAgentRuns) {
    throw new Error('Limite mensal de ' + context.plan.monthlyAgentRuns + ' execuções de IA atingido no plano ' + context.plan.label + '.')
  }
  return { ...context, used }
}
