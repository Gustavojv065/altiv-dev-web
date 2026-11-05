import { createAdminClient } from '@/lib/supabase/admin'
import { requireApkLicenseAdmin, inviteApkCustomer, linkExistingApkUser, renewApkLicense, suspendApkLicense } from './actions'

type License = {
  user_id: string
  plan_code: string
  status: string
  valid_from: string
  valid_until: string
  created_at: string
}

const date = (value: string) => new Date(value).toLocaleString('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  timeZone: 'America/Cuiaba',
})

export default async function AdminApkLicensesPage({
  searchParams,
}: { searchParams: Promise<{ message?: string; error?: string }> }) {
  await requireApkLicenseAdmin()
  const params = await searchParams
  const admin = createAdminClient()
  const { data, error } = await admin.from('altiv_service_subscriptions')
    .select('user_id,plan_code,status,valid_from,valid_until,created_at')
    .order('created_at', { ascending: false })
    .limit(100)
  const licenses = (data ?? []) as License[]
  // Names and email addresses never appear on anonymous or client endpoints.
  const users = await Promise.all(licenses.map(async row => {
    const result = await admin.auth.admin.getUserById(row.user_id)
    return [row.user_id, result.data.user?.email ?? null] as const
  }))
  const emailMap = new Map(users)
  const now = Date.now()
  const active = licenses.filter(row =>
    row.status === 'active' &&
    new Date(row.valid_from).getTime() <= now &&
    new Date(row.valid_until).getTime() > now).length

  return <main className="adminShell">
    <aside className="adminSidebar">
      <div className="projectsBrand"><span>A</span><div><strong>ALTIV ADMIN</strong><small>Seu Painel Master</small></div></div>
      <nav className="adminNav">
        <a href="/admin">Visão geral</a>
        <a href="/admin/clients">Clientes do site</a>
        <a href="/admin/plans">Planos do site</a>
        <a className="active" href="/admin/apk-licenses">Licenças do APK</a>
        <a href="/workspace">Workspace</a>
      </nav>
    </aside>
    <section className="adminMain">
      <header className="adminTop">
        <div><span className="eyebrow">ALTIV DEV AI · ANDROID</span><h1>Licenças do APK</h1>
          <p>Controle o acesso comercial do aplicativo no seu Painel Master. A assinatura do site permanece independente.</p></div>
      </header>
      {params.message && <div className="integrationNotice" role="status">{params.message}</div>}
      {params.error && <div className="authAlert error" role="alert">{params.error}</div>}
      {error && <div className="authAlert error" role="alert">
        A tabela de licenças ainda não está disponível. Revise a migração do Supabase em staging antes de habilitar convites.
      </div>}
      <div className="adminMetrics">
        <article className="adminMetric"><span>Licenças cadastradas</span><strong>{licenses.length}</strong></article>
        <article className="adminMetric"><span>Ativas agora</span><strong>{active}</strong></article>
        <article className="adminMetric"><span>Duração de renovação</span><strong>30 dias</strong></article>
      </div>
      <section className="adminPanel">
        <div className="sectionHead"><div><h2>Convidar novo cliente</h2>
          <p>Envia um convite por e-mail para definir a senha. Nenhuma senha é criada ou enviada pelo administrador.</p></div></div>
        <form action={inviteApkCustomer} className="adminPlanCard" style={{maxWidth:640}}>
          <label htmlFor="apk-email">E-mail do cliente</label>
          <input id="apk-email" type="email" name="email" autoComplete="email" required placeholder="cliente@exemplo.com" />
          <p>Plano ALTIV DEV AI · 30 dias a partir da emissão do convite. A confirmação depende do e-mail chegar ao cliente.</p>
          <button type="submit" disabled={Boolean(error)}>Convidar e liberar 30 dias</button>
        </form>
      </section>
      <section className="adminPanel">
        <div className="sectionHead"><div><h2>Vincular conta já cadastrada</h2>
          <p>Para clientes que já possuem e-mail e senha no Supabase Auth do seu painel, informe o ID do usuário. Não duplicaremos a conta.</p></div></div>
        <form action={linkExistingApkUser} className="adminPlanCard" style={{maxWidth:640}}>
          <label htmlFor="apk-user-id">ID do usuário (UUID)</label>
          <input id="apk-user-id" name="user_id" required placeholder="00000000-0000-0000-0000-000000000000" />
          <button type="submit" disabled={Boolean(error)}>Vincular licença de 30 dias</button>
        </form>
      </section>
      <section className="adminPanel">
        <div className="sectionHead"><div><h2>Licenças e renovações</h2>
          <p>Renove ou suspenda somente os serviços comerciais ALTIV. Arquivos e ferramentas locais do cliente não são apagados.</p></div></div>
        <div className="adminTableWrap">
          <table className="adminTable">
            <thead><tr><th>Cliente</th><th>Status</th><th>Início</th><th>Vencimento</th><th>Ações</th></tr></thead>
            <tbody>
              {licenses.map(row => {
                const isActive = row.status === 'active' &&
                  new Date(row.valid_from).getTime() <= now && new Date(row.valid_until).getTime() > now
                return <tr key={row.user_id}>
                  <td><strong>{emailMap.get(row.user_id) || 'Usuário cadastrado'}</strong><small>{row.user_id}</small></td>
                  <td><span className={'connectionPill ' + (isActive ? 'on' : '')}>
                    {isActive ? 'Ativa' : row.status === 'suspended' ? 'Suspensa' : row.status === 'cancelled' ? 'Cancelada' : 'Vencida / pendente'}
                  </span></td>
                  <td>{date(row.valid_from)}</td>
                  <td>{date(row.valid_until)}</td>
                  <td><div className="adminRowActions">
                    <form action={renewApkLicense}>
                      <input type="hidden" name="user_id" value={row.user_id} />
                      <button type="submit">Renovar +30 dias</button>
                    </form>
                    {row.status !== 'suspended' && <form action={suspendApkLicense}>
                      <input type="hidden" name="user_id" value={row.user_id} />
                      <button type="submit">Suspender</button>
                    </form>}
                  </div></td>
                </tr>
              })}
              {!licenses.length && <tr><td colSpan={5}>
                {error ? 'Configure as tabelas de licenciamento para visualizar clientes.' : 'Nenhuma licença do APK foi emitida.'}
              </td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  </main>
}
