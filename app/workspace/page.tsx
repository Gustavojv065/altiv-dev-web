import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/login/actions'
import { createProject } from './actions'

export default async function WorkspacePage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login')

  const userId = String(data.claims.sub)

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase.from('profiles').select('display_name,avatar_url').eq('id', userId).maybeSingle(),
    supabase
      .from('projects')
      .select('id,name,status,updated_at')
      .eq('owner_id', userId)
      .order('updated_at', { ascending: false })
      .limit(30),
  ])

  return (
    <main className="projectsShell">
      <aside className="projectsSidebar">
        <div className="projectsBrand"><span>A</span><div><strong>ALTIV DEV</strong><small>AI Website Studio</small></div></div>
        <nav className="projectsNav">
          <a className="active">Projetos</a>
          <a>Templates <em>em breve</em></a>
          <a>Integrações <em>em breve</em></a>
        </nav>
        <form action={logout} className="projectsLogout"><button>Sair</button></form>
      </aside>

      <section className="projectsMain">
        <header className="projectsTop">
          <div>
            <span className="eyebrow">WORKSPACE</span>
            <h1>Olá, {profile?.display_name || 'criador'}.</h1>
            <p>Crie, edite e acompanhe seus projetos em um só lugar.</p>
          </div>
          <form action={createProject}><button className="createProjectBtn">＋ Novo projeto</button></form>
        </header>

        <section className="projectsOverview">
          <div className="overviewCard"><span>Projetos</span><strong>{projects?.length ?? 0}</strong></div>
          <div className="overviewCard"><span>Prontos</span><strong>{projects?.filter((p) => p.status === 'ready').length ?? 0}</strong></div>
          <div className="overviewCard"><span>Em construção</span><strong>{projects?.filter((p) => p.status === 'building').length ?? 0}</strong></div>
        </section>

        <section className="projectsSection">
          <div className="sectionHead"><div><h2>Seus projetos</h2><p>Continue de onde parou ou inicie uma nova ideia.</p></div></div>
          <div className="projectGrid">
            {(projects?.length ?? 0) === 0 ? (
              <div className="projectEmpty">
                <span>✦</span>
                <h3>Crie seu primeiro projeto</h3>
                <p>O ALTIV gera o site, salva versões e mantém o contexto das suas alterações.</p>
                <form action={createProject}><button className="createProjectBtn">Começar agora</button></form>
              </div>
            ) : projects!.map((project) => (
              <a className="projectTile" href={'/studio/' + project.id} key={project.id}>
                <div className="projectThumb">
                  <div className="miniBrowser"><i/><i/><i/></div>
                  <div className="miniPage"><span>{project.name.slice(0,1).toUpperCase()}</span></div>
                </div>
                <div className="projectTileBody">
                  <div><strong>{project.name}</strong><small>Atualizado {new Date(project.updated_at).toLocaleString('pt-BR')}</small></div>
                  <span className={'statusPill ' + project.status}>{project.status}</span>
                </div>
              </a>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}
