import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import StudioClient from '@/components/StudioClient'

export default async function StudioPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) redirect('/login')

  const ownerId = String(claimsData.claims.sub)
  const { data: project } = await supabase
    .from('projects')
    .select('id,name,status,updated_at')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!project) notFound()

  const [{ data: file }, { data: versions }, { data: conversation }] = await Promise.all([
    supabase
      .from('project_files')
      .select('path,content,revision,language,updated_at')
      .eq('project_id', id)
      .eq('owner_id', ownerId)
      .eq('path', 'index.html')
      .maybeSingle(),
    supabase
      .from('project_versions')
      .select('id,version_number,summary,created_at,metadata')
      .eq('project_id', id)
      .eq('owner_id', ownerId)
      .order('version_number', { ascending: false })
      .limit(20),
    supabase
      .from('conversations')
      .select('id,title')
      .eq('project_id', id)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let messages: Array<{ id:string; role:string; content:string; model:string|null; created_at:string }> = []
  if (conversation?.id) {
    const { data } = await supabase
      .from('messages')
      .select('id,role,content,model,created_at')
      .eq('conversation_id', conversation.id)
      .eq('owner_id', ownerId)
      .order('created_at', { ascending: true })
      .limit(80)
    messages = data ?? []
  }

  return (
    <StudioClient
      projectId={project.id}
      projectName={project.name}
      projectStatus={project.status}
      initialHtml={file?.content ?? ''}
      initialRevision={file?.revision ?? 0}
      initialMessages={messages}
      initialVersions={versions ?? []}
    />
  )
}
