import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getExtensionSession } from '../session'
import { submitExtensionRequest } from './actions'
import { MAX_EXTENSION_PROMPT_LENGTH, MIN_EXTENSION_PROMPT_LENGTH, MAX_EXTENSION_REQUESTS_PER_DAY } from '@/lib/extension-request'
export const dynamic = 'force-dynamic'

export default async function ExtensionWorkspace({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const session = await getExtensionSession()
  if (!session) redirect('/extension')
  const db = createAdminClient()
  // Service role bypasses RLS: both owner and account constraints are mandatory.
  const [{ data: projects }, { data: requests }] = await Promise.all([
    db.from('projects').select('id,name,github_repo').eq('account_id', session.accountId)
      .eq('owner_id', session.ownerId).order('created_at', { ascending: false }).limit(100),
    db.from('altiv_extension_requests').select('id,project_id,prompt,status,created_at')
      .eq('account_id', session.accountId).eq('license_id', session.licenseId)
      .order('created_at', { ascending: false }).limit(20),
  ])
  const projectMap = new Map((projects ?? []).map((p) => [p.id,p.name]))
  const { status } = await searchParams
  const message = status === 'sent' ? 'Solicitação recebida e aguardando análise.' :
    status === 'invalid' ? 'Selecione um projeto e escreva de 12 a 2000 caracteres.' :
    status === 'unavailable' ? 'Não foi possível registrar agora. Verifique o limite diário ou entre em contato com o administrador.' : ''
  return <main className="authPage">
    <section className="authCard" style={{ maxWidth: 760, width: '100%' }}>
      <div className="authBrand"><div className="authLogo">A</div><div><strong>ALTIVE DEV — Projetos</strong>
        <span>{session.accountName} • acesso por código</span></div></div>
      {message && <p role="status" className={'authAlert' + (status === 'sent' ? '' : ' error')}>{message}</p>}
      <h2>Solicitar uma alteração</h2>
      <p>Descreva a mudança. Ela será revisada pelo administrador antes de qualquer alteração no GitHub ou deploy.</p>
      {projects?.length ? <form action={submitExtensionRequest}>
        <label htmlFor="project_id">Projeto autorizado</label>
        <select id="project_id" name="project_id" required defaultValue="">
          <option value="" disabled>Escolha seu projeto</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}{p.github_repo ? ' • ' + p.github_repo : ''}</option>)}
        </select>
        <label htmlFor="prompt">O que você deseja alterar?</label>
        <textarea id="prompt" name="prompt" minLength={MIN_EXTENSION_PROMPT_LENGTH}
          maxLength={MAX_EXTENSION_PROMPT_LENGTH} required rows={5}
          placeholder="Ex.: Ajustar o botão de contato na página inicial para abrir o WhatsApp correto." />
        <div className="authActions"><button className="authPrimary">Enviar solicitação</button></div>
        <small>Limite de {MAX_EXTENSION_REQUESTS_PER_DAY} solicitações por conta a cada dia UTC no piloto.</small>
      </form> : <p className="authAlert">Seu administrador ainda precisa vincular um projeto à sua licença.</p>}
      <h2>Últimas solicitações desta licença</h2>
      {(requests ?? []).length ? <div className="adminTableWrap"><table className="adminTable">
        <thead><tr><th>Projeto</th><th>Pedido</th><th>Estado</th><th>Data</th></tr></thead>
        <tbody>{requests?.map((request) => <tr key={request.id}>
          <td>{projectMap.get(request.project_id) ?? 'Projeto indisponível'}</td>
          <td style={{ maxWidth: 230, overflowWrap: 'anywhere' }}>{request.prompt}</td>
          <td>{request.status === 'pending' ? 'Aguardando análise' : request.status === 'in_review' ?
              'Em análise' : request.status === 'rejected' ? 'Recusado' : 'Concluído'}</td>
          <td>{new Date(request.created_at).toLocaleDateString('pt-BR')}</td>
        </tr>)}</tbody></table></div> : <p>Nenhuma solicitação registrada.</p>}
      <p><a href="/extension">Voltar à licença</a></p>
    </section>
  </main>
}
