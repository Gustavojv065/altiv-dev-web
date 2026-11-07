'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidProjectId } from '@/lib/extension-request'

export async function linkExtensionProject(form: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id, user.email))) redirect('/workspace')
  const accountId = String(form.get('account_id') || '')
  const projectId = String(form.get('project_id') || '')
  if (!isValidProjectId(accountId) || !isValidProjectId(projectId)) redirect('/admin/extension-projetos?status=invalid')
  const db = createAdminClient()
  const [{data: account}, {data: project}] = await Promise.all([
    db.from('saas_accounts').select('owner_id,status').eq('id', accountId).maybeSingle(),
    db.from('projects').select('owner_id,account_id').eq('id', projectId).maybeSingle(),
  ])
  if (!account || !project || account.owner_id !== project.owner_id ||
      !['active', 'trial'].includes(account.status) ||
      (project.account_id !== null && project.account_id !== accountId)) {
    redirect('/admin/extension-projetos?status=forbidden')
  }
  const {data, error} = await db.from('projects').update({account_id: accountId})
    .eq('id',projectId).eq('owner_id', account.owner_id)
    .is('account_id', null).select('id').maybeSingle()
  if (error || (!data && project.account_id !== accountId)) {
    redirect('/admin/extension-projetos?status=unavailable')
  }
  revalidatePath('/admin/extension-projetos')
  revalidatePath('/extension/workspace')
  redirect('/admin/extension-projetos?status=ok')
}
