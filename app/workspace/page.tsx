import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'

export default async function WorkspacePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login')
  const userId = String(data.claims.sub)
  const { data: profile } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', userId).maybeSingle()
  const { data: projects } = await supabase.from('projects').select('id,name,status,updated_at').eq('owner_id', userId).order('updated_at', { ascending: false }).limit(20)

  return (
    <main className="workspacePage">
      <header className="workspaceTop">
        <div><small>ALTIV DEV</small><h1>Olá, {profile?.display_name || 'criador'}.</h1><p>Seus projetos, memórias e execuções ficam isolados na sua conta.</p></div>
        <form action={logout}><button className="authSecondary">Sair</button></form>
      </header>
      <section className="workspacePanel">
        <div className="workspacePanelHead"><div><b>Projetos</b><span>{projects?.length ?? 0} projeto(s)</span></div><a href="/" className="authPrimary linkButton">+ Novo projeto</a></div>
        <div className="projectList">
          {(projects?.length ?? 0) === 0 ? <div className="emptyState"><h2>Nenhum projeto ainda</h2><p>Volte ao estúdio e peça para a IA criar seu primeiro site.</p></div> : projects!.map((project) => <div className="projectRow" key={project.id}><div><strong>{project.name}</strong><small>{project.status}</small></div><span>{new Date(project.updated_at).toLocaleString('pt-BR')}</span></div>)}
        </div>
      </section>
    </main>
  )
}
