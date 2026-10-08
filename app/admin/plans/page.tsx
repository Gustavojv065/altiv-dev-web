import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { updatePlanPrices } from './actions'

export default async function AdminPlansPage({ searchParams }:{searchParams:Promise<{message?:string;error?:string}>}) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')

  const admin = createAdminClient()
  const { data:plans } = await admin
    .from('saas_plans')
    .select('code,name,price_monthly_brl,price_yearly_brl,active,sort_order')
    .order('sort_order')

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <div className="projectsBrand"><span>A</span><div><strong>ALTIV ADMIN</strong><small>SaaS Control Center</small></div></div>
        <nav className="adminNav">
          <a href="/admin">Visão geral</a>
          <a href="/admin/clients">Clientes</a>
          <a className="active">Planos e preços</a>
          <a href="/workspace">Workspace</a>
        </nav>
      </aside>
      <section className="adminMain">
        <header className="adminTop"><div><span className="eyebrow">PLANOS</span><h1>Planos e preços</h1><p>Configure os valores comerciais antes de habilitar o checkout.</p></div></header>
        {params.message && <div className="integrationNotice">{params.message}</div>}
        {params.error && <div className="authAlert error">{params.error}</div>}
        <section className="adminPanel">
          <div className="adminPlanGrid">
            {(plans ?? []).map((plan) => (
              <form action={updatePlanPrices} className="adminPlanCard" key={plan.code}>
                <input type="hidden" name="code" value={plan.code} />
                <span>{plan.name}</span>
                <strong>{plan.code === 'free' ? 'Gratuito' : 'Cobrança configurável'}</strong>
                <label>Mensal (R$)</label>
                <input name="price_monthly_brl" inputMode="decimal" defaultValue={plan.price_monthly_brl ?? ''} disabled={plan.code === 'free'} placeholder="0,00" />
                <label>Anual (R$)</label>
                <input name="price_yearly_brl" inputMode="decimal" defaultValue={plan.price_yearly_brl ?? ''} disabled={plan.code === 'free'} placeholder="0,00" />
                {plan.code !== 'free' && <button>Salvar preços</button>}
              </form>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
