import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { SAAS_PLANS } from '@/lib/saas/plans'

async function safeCount(table:string) {
  try {
    const supabase = createAdminClient()
    const { count } = await supabase.from(table).select('*', { count:'exact', head:true })
    return count ?? 0
  } catch {
    return 0
  }
}

export default async function AdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) redirect('/workspace')

  const [users, projects, accounts, subscriptions, agentRuns] = await Promise.all([
    safeCount('profiles'),
    safeCount('projects'),
    safeCount('saas_accounts'),
    safeCount('saas_subscriptions'),
    safeCount('agent_runs'),
  ])

  return (
    <main className="adminShell">
      <aside className="adminSidebar">
        <div className="projectsBrand"><span>A</span><div><strong>ALTIV ADMIN</strong><small>SaaS Control Center</small></div></div>
        <nav className="adminNav">
          <a className="active">Visão geral</a>
          <a href="/admin/clients">Clientes</a>
          <a href="/admin/plans">Planos e preços</a>
          <a href="/workspace">Workspace</a>
          <a href="/integrations">Integrações</a>
        </nav>
      </aside>

      <section className="adminMain">
        <header className="adminTop">
          <div><span className="eyebrow">SUPER ADMIN</span><h1>Painel administrativo</h1><p>Base comercial do ALTIV DEV para clientes, planos, uso e operação do SaaS.</p></div>
        </header>

        <section className="adminMetrics">
          <div className="adminMetric"><span>Usuários</span><strong>{users}</strong></div>
          <div className="adminMetric"><span>Contas SaaS</span><strong>{accounts}</strong></div>
          <div className="adminMetric"><span>Projetos</span><strong>{projects}</strong></div>
          <div className="adminMetric"><span>Assinaturas</span><strong>{subscriptions}</strong></div>
          <div className="adminMetric"><span>Execuções IA</span><strong>{agentRuns}</strong></div>
        </section>

        <section className="adminPanel">
          <div className="sectionHead"><div><h2>Planos preparados</h2><p>Limites podem ser ajustados antes do lançamento comercial.</p></div></div>
          <div className="adminPlanGrid">
            {Object.values(SAAS_PLANS).map((plan) => (
              <article className="adminPlanCard" key={plan.code}>
                <span>{plan.label}</span>
                <strong>{plan.projects} projetos</strong>
                <small>{plan.monthlyAgentRuns} execuções IA/mês</small>
                <small>{plan.members} membro(s)</small>
                <small>{plan.privateRepositories ? 'Repos privados' : 'Somente público'}</small>
                <small>{plan.customDomain ? 'Domínio próprio' : 'Sem domínio próprio'}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="adminPanel">
          <div className="sectionHead"><div><h2>Estrutura comercial</h2><p>Preparada para receber cobrança, licenças, equipes e métricas sem alterar o motor do editor.</p></div></div>
          <div className="adminChecklist">
            <span>✓ Multi-tenant por conta</span>
            <span>✓ Membros e papéis</span>
            <span>✓ Planos e limites</span>
            <span>✓ Assinaturas</span>
            <span>✓ Medição de uso</span>
            <span>✓ BYOK por cliente</span>
            <span>✓ GitHub por cliente</span>
            <span>✓ Super administrador</span>
          </div>
        </section>
      </section>
    </main>
  )
}
