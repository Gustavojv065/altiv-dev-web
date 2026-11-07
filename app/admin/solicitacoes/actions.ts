'use server'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getCurrentUser, isSuperAdmin } from '@/lib/saas/access'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidProjectId } from '@/lib/extension-request'

export async function updateExtensionRequestStatus(form: FormData) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (!(await isSuperAdmin(user.id,user.email))) redirect('/workspace')
  const id = String(form.get('request_id') || '')
  const status = String(form.get('status') || '')
  if (!isValidProjectId(id) || !['in_review','rejected'].includes(status)) redirect('/admin/solicitacoes?status=invalid')
  const {error} = await createAdminClient().from('altiv_extension_requests')
    .update({status,reviewed_at:new Date().toISOString(),reviewed_by:user.id})
    .eq('id',id).eq('status','pending')
  if (error) redirect('/admin/solicitacoes?status=error')
  revalidatePath('/admin/solicitacoes')
  revalidatePath('/extension/workspace')
  redirect('/admin/solicitacoes?status=updated')
}
