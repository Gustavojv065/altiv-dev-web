'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recordUsage } from '@/lib/saas/usage'

export async function createProject() {
  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) redirect('/login')

  const ownerId = String(claimsData.claims.sub)
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ owner_id: ownerId, name: 'Novo projeto', status: 'draft' })
    .select('id')
    .single()

  if (error || !project) redirect('/workspace?error=' + encodeURIComponent(error?.message ?? 'Não foi possível criar o projeto.'))
  await recordUsage({ ownerId, type:'project_create', metadata:{ projectId:project.id } })
  redirect('/studio/' + project.id)
}
