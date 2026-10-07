'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { recordUsage } from '@/lib/saas/usage'
import { assertProjectLimit } from '@/lib/saas/account'

export async function createProject() {
  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) redirect('/login')

  const ownerId = String(claimsData.claims.sub)
  let context
  try {
    context = await assertProjectLimit(ownerId)
  } catch (error) {
    redirect('/workspace?error=' + encodeURIComponent(error instanceof Error ? error.message : 'Limite do plano atingido.'))
  }
  const { data: project, error } = await supabase
    .from('projects')
    .insert({ owner_id: ownerId, account_id: context.account.id, name: 'Novo projeto', status: 'draft' })
    .select('id')
    .single()

  if (error || !project) redirect('/workspace?error=' + encodeURIComponent(error?.message ?? 'Não foi possível criar o projeto.'))
  await recordUsage({ ownerId, type:'project_create', metadata:{ projectId:project.id } })
  redirect('/studio/' + project.id)
}
