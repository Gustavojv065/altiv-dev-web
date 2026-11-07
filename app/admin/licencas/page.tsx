import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { revokeExtensionLicense } from './actions'
import IssueForm from './issue-form'
export const dynamic = 'force-dynamic'

export default async function LicenseAdminPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) redirect('/workspace')
  const db = createAdminClient()
  const [{ data: accounts }, { data: licenses }] = await Promise.all([
    db.from('saas_accounts').select('id,name,status').in('status', ['active','trial']).order('name'),
    db.from('altiv_extension_licenses').select('id,account_id,created_at,expires_at,redeemed_at,revoked_at')
      .order('created_at', { ascending: false }).limit(100),
  ])
  const names = new Map((accounts ?? []).map((a) => [a.id, a.name]))
  return (
    <main className="adminShell">
      <section className="adminMain">
        <header className="adminTop"><div><span className="eyebrow">ALTIVE DEV</span>
          <h1>Licenças da extensão</h1><p>Códigos de acesso para clientes sem Termux.</p>
          <a href="/admin">Voltar ao painel master</a>
        </div></header>
        <IssueForm accounts={(accounts ?? []).map(({id,name}) => ({id,name}))}/>
        <section className="adminPanel"><h2>Últimas licenças</h2>
          <div className="adminTableWrap"><table className="adminTable">
            <thead><tr><th>Cliente</th><th>Emissão</th><th>Vencimento</th><th>Estado</th><th>Ação</th></tr></thead>
            <tbody>{(licenses ?? []).map((license) => {
              const state = license.revoked_at ? 'Revogada' :
                new Date(license.expires_at).getTime() < Date.now() ? 'Expirada' :
                license.redeemed_at ? 'Ativada' : 'Disponível'
              return <tr key={license.id}>
                <td>{names.get(license.account_id) ?? 'Conta cadastrada'}</td>
                <td>{new Date(license.created_at).toLocaleDateString('pt-BR')}</td>
                <td>{new Date(license.expires_at).toLocaleDateString('pt-BR')}</td>
                <td>{state}</td>
                <td>{!license.revoked_at && <form action={revokeExtensionLicense}>
                  <input type="hidden" name="license_id" value={license.id}/>
                  <button>Revogar</button></form>}</td>
              </tr>
            })}{(licenses?.length ?? 0) === 0 && <tr><td colSpan={5}>Nenhuma licença emitida.</td></tr>}</tbody>
          </table></div>
        </section>
      </section>
    </main>
  )
}
