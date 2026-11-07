import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { updateExtensionRequestStatus } from './actions'
export const dynamic='force-dynamic'
export default async function ExtensionRequestsAdmin({searchParams}:{searchParams:Promise<{status?:string}>}) {
 const user=await getCurrentUser()
 if(!user)redirect('/login')
 if(!(await isSuperAdmin(user.id,user.email)))redirect('/workspace')
 const db=createAdminClient()
 const [{data:requests,error},{data:projects},{data:accounts}]=await Promise.all([
   db.from('altiv_extension_requests').select('id,account_id,project_id,prompt,status,created_at').order('created_at',{ascending:false}).limit(100),
   db.from('projects').select('id,name').limit(250),
   db.from('saas_accounts').select('id,name').limit(250),
 ])
 const projectMap=new Map((projects??[]).map(p=>[p.id,p.name]))
 const accountMap=new Map((accounts??[]).map(a=>[a.id,a.name]))
 const {status}=await searchParams
 return <main className="adminShell"><section className="adminMain">
   <header className="adminTop"><div><span className="eyebrow">ALTIVE DEV</span>
   <h1>Solicitações da extensão</h1>
   <p>Fila de análise humana. Nenhum pedido executa IA, faz commit ou deploy automaticamente.</p>
   <a href="/admin">Voltar ao Painel Master</a></div></header>
   {status==='updated'&&<p className="authAlert">Solicitação atualizada.</p>}
   {status&&status!=='updated'&&<p className="authAlert error">Não foi possível atualizar o pedido.</p>}
   {error&&<p className="authAlert error">Fila indisponível: confira a migração no Supabase de homologação.</p>}
   <section className="adminPanel"><div className="adminTableWrap"><table className="adminTable">
   <thead><tr><th>Conta</th><th>Projeto</th><th>Solicitação</th><th>Estado</th><th>Registrado</th><th>Ação</th></tr></thead>
   <tbody>{(requests??[]).map(r=><tr key={r.id}>
    <td>{accountMap.get(r.account_id)||'Conta não listada'}</td>
    <td>{projectMap.get(r.project_id)||'Projeto não listado'}</td>
    <td style={{maxWidth:350,overflowWrap:'anywhere',whiteSpace:'pre-wrap'}}>{r.prompt}</td>
    <td>{r.status==='pending'?'Aguardando':r.status==='in_review'?'Em análise':r.status==='rejected'?'Recusada':'Concluída'}</td>
    <td>{new Date(r.created_at).toLocaleDateString('pt-BR')}</td>
    <td>{r.status==='pending'&&<div className="adminRowActions">
      <form action={updateExtensionRequestStatus}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="in_review"/><button>Colocar em análise</button></form>
      <form action={updateExtensionRequestStatus}><input type="hidden" name="request_id" value={r.id}/><input type="hidden" name="status" value="rejected"/><button>Recusar</button></form>
    </div>}</td>
   </tr>)}
   {!(requests??[]).length&&<tr><td colSpan={6}>Nenhuma solicitação encontrada.</td></tr>}
   </tbody></table></div></section>
 </section></main>
}
