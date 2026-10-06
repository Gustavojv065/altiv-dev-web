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
    .select('id,name')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!project) notFound()
  return <StudioClient projectId={project.id} projectName={project.name} />
}
