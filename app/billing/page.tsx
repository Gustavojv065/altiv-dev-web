import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/saas/access'
import { getAccountPlan } from '@/lib/saas/account'
import { createAdminClient } from '@/lib/supabase/admin'
import BillingPlansClient from '@/components/BillingPlansClient'

export default async function BillingPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const context = await getAccountPlan(user.id)
  const admin = createAdminClient()
  const { data:plans } = await admin
    .from('saas_plans')
    .select('code,name,price_monthly_brl,limits,features')
    .eq('active',true)
    .order('sort_order')

  const currentPlan = context.trial ? context.account.trial_plan_code || 'free' : context.subscription?.plan_code || 'free'

  return (
    <main className="billingPage">
      <div className="billingHeader">
        <a href="/workspace" className="backLink">← Workspace</a>
        <span className="eyebrow">ASSINATURA</span>
        <h1>Plano do ALTIV DEV</h1>
        <p>Escolha um plano. A ativação é feita automaticamente quando o Mercado Pago confirmar a assinatura.</p>
      </div>
      <BillingPlansClient plans={(plans ?? []) as any} currentPlan={currentPlan} />
    </main>
  )
}
