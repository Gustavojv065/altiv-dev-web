import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { setAccountPlan, setAccountStatus } from './actions'
import { startTrial, endTrial } from './trial-actions'

export default async function AdminClientsPage({ searchParams }: { searchParams: Promise<{message?:string;error?:string}> }) {
  const params = await searchParams
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')

  const supabase = createAdminClient()
  const { data:accounts } = await supabase
    .from('saas_accounts')
    .select('id,name,slug,status,owner_id,created_at,trial_plan_code,trial_ends_at')
    .order('created_at',{ascending:false})
    .limit(100)

  const ownerIds = Array.from(new Set((accounts ?? []).map((a) => a.owner_id)))
  const [{ data:profiles }, { data:subscriptions }] = await Promise.all([
    ownerIds.length ? supabase.from('profiles').select('id,display_name,role').in('id',ownerIds) : Promise.resolve({data:[]}),
    (accounts?.length ?? 0) ? supabase.from('saas_subscriptions').select('account_id,plan_code,status,current_period_end').in('account_id',(accounts ?? []).map((a) => a.id)) : Promise.resolve({data:[]}),
  ])

  const profileMap = new Map((profiles ?? []).map((p) => [p.id,p]))
  const subMap = new Map((subscriptions ?? []).map((s) => [s.account_id,s]))

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <div className="projectsBrand"><span>A</span><div><strong>ALTIV ADMIN</strong><small>SaaS Control Center</small></div></div>
        <nav className="adminNav">
          <a href="/admin">Visão geral</a>
          <a className="active">Clientes</a>
          <a href="/workspace">Workspace</a>
        </nav>
      </aside>
      <section className="adminMain">
        <header className="adminTop"><div><span className="eyebrow">CLIENTES</span><h1>Contas do SaaS</h1><p>Visão administrativa das contas, plano e status comercial.</p></div></header>
        {params.message && <div className="integrationNotice">{params.message}</div>}
        {params.error && <div className="authAlert error">{params.error}</div>}
        <section className="adminPanel">
          <div className="adminTableWrap">
            <table className="adminTable">
              <thead><tr><th>Cliente</th><th>Workspace</th><th>Plano</th><th>Status</th><th>Criado</th><th>Ações</th></tr></thead>
              <tbody>
                {(accounts ?? []).map((account) => {
                  const profile = profileMap.get(account.owner_id)
                  const sub = subMap.get(account.id)
                  return (
                    <tr key={account.id}>
                      <td><strong>{profile?.display_name || 'Cliente'}</strong><small>{profile?.role || 'user'}</small></td>
                      <td>{account.name}<small>{account.slug}</small></td>
                      <td>{sub?.plan_code || 'free'}</td>
                      <td><span className={'connectionPill ' + (account.status === 'active' ? 'on' : '')}>{account.status}</span></td>
                      <td>{new Date(account.created_at).toLocaleDateString('pt-BR')}</td>
                      <td>
                        <div className="adminRowActions">
                          <form action={setAccountPlan}>
                            <input type="hidden" name="account_id" value={account.id} />
                            <select name="plan_code" defaultValue={sub?.plan_code || 'free'}>
                              <option value="free">Free</option>
                              <option value="starter">Starter</option>
                              <option value="pro">Pro</option>
                              <option value="business">Business</option>
                            </select>
                            <button>Alterar plano</button>
                          </form>
                          <form action={setAccountStatus}>
                            <input type="hidden" name="account_id" value={account.id} />
                            <select name="status" defaultValue={account.status}>
                              <option value="trial">Trial</option>
                              <option value="active">Ativo</option>
                              <option value="past_due">Pagamento pendente</option>
                              <option value="suspended">Suspenso</option>
                              <option value="canceled">Cancelado</option>
                            </select>
                            <button>Atualizar</button>
                          </form>
                          <form action={startTrial}>
                            <input type="hidden" name="account_id" value={account.id} />
                            <select name="trial_plan_code" defaultValue={account.trial_plan_code || 'pro'}>
                              <option value="starter">Teste Starter</option>
                              <option value="pro">Teste Pro</option>
                              <option value="business">Teste Business</option>
                            </select>
                            <select name="trial_days" defaultValue="14">
                              <option value="7">7 dias</option>
                              <option value="14">14 dias</option>
                              <option value="30">30 dias</option>
                            </select>
                            <button>Iniciar teste</button>
                          </form>
                          {account.status === 'trial' && (
                            <form action={endTrial}>
                              <input type="hidden" name="account_id" value={account.id} />
                              <button>Encerrar teste</button>
                            </form>
                          )}
                          {account.trial_ends_at && <small>Teste até {new Date(account.trial_ends_at).toLocaleDateString('pt-BR')}</small>}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {(accounts?.length ?? 0) === 0 && <tr><td colSpan={6}>Nenhuma conta SaaS criada ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  )
}
