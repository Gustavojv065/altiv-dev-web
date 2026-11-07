import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { linkExtensionProject } from './actions'
export const dynamic = 'force-dynamic'
export default async function ExtensionProjectsAdmin({searchParams}: {searchParams: Promise<{status?:string}>}) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')
  const db = createAdminClient()
  const [{data:accounts}, {data:projects}] = await Promise.all([
    db.from('saas_accounts').select('id,name,owner_id,status').in('status',['active','trial']).order('name').limit(250),
    db.from('projects').select('id,name,github_repo,owner_id,account_id').order('created_at',{ascending:false}).limit(250),
  ])
  const {status}=await searchParams
  const message = status === 'ok' ? 'Projeto vinculado à conta.' : status === 'forbidden' ?
    'Conta e projeto devem pertencer ao mesmo proprietário e não podem estar vinculados a outra conta.' :
    status ? 'Não foi possível vincular o projeto.' : ''
  const accountMap=new Map((accounts??[]).map(a=>[a.id,a.name]))
  return <main className="adminShell"><section className="adminMain">
    <header className="adminTop"><div><span className="eyebrow">ALTIVE DEV</span>
      <h1>Projetos autorizados da extensão</h1>
      <p>Vincule projetos existentes à conta correta antes de disponibilizar acesso por código.</p>
      <a href="/admin">Voltar ao Painel Master</a>
    </div></header>
    {message && <p role="status" className={'authAlert'+(status==='ok'?'':' error')}>{message}</p>}
    <section className="adminPanel">
      <h2>Vincular projeto</h2>
      <p>Somente projetos do mesmo proprietário podem ser associados. Projetos já vinculados não são transferidos automaticamente.</p>
      <form action={linkExtensionProject} className="altivExtensionForm">
        <label htmlFor="project_id">Projeto existente</label>
        <select id="project_id" name="project_id" required defaultValue="">
          <option value="" disabled>Selecione o projeto</option>
          {(projects??[]).filter(p=>!p.account_id).map(p=><option value={p.id} key={p.id}>{p.name}{p.github_repo?' — '+p.github_repo:''}</option>)}
        </select>
        <label htmlFor="account_id">Conta do cliente (mesmo proprietário)</label>
        <select id="account_id" name="account_id" required defaultValue="">
          <option value="" disabled>Selecione a conta</option>
          {(accounts??[]).map(a=><option value={a.id} key={a.id}>{a.name}</option>)}
        </select>
        <button disabled={!projects?.some(p=>!p.account_id) || !accounts?.length}>Autorizar projeto</button>
      </form>
    </section>
    <section className="adminPanel"><h2>Vinculações atuais</h2>
      <div className="adminTableWrap"><table className="adminTable"><thead><tr>
        <th>Projeto</th><th>GitHub</th><th>Conta autorizada</th>
      </tr></thead><tbody>
        {(projects??[]).map(p=><tr key={p.id}><td>{p.name}</td>
          <td>{p.github_repo||'Não conectado'}</td>
          <td>{p.account_id?accountMap.get(p.account_id)||'Conta não listada':'Não vinculado'}</td></tr>)}
        {!(projects??[]).length&&<tr><td colSpan={3}>Não há projetos cadastrados para vincular.</td></tr>}
      </tbody></table></div>
    </section>
  </section></main>
}
