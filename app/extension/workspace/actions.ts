'use server'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { EXTENSION_SESSION_COOKIE, sha256 } from '@/lib/extension-license'
import { getExtensionSession } from '../session'
import { isValidProjectId, validateExtensionPrompt } from '@/lib/extension-request'

export async function submitExtensionRequest(form: FormData) {
  const session = await getExtensionSession()
  if (!session) redirect('/extension')
  const projectId = String(form.get('project_id') ?? '')
  const prompt = validateExtensionPrompt(form.get('prompt'))
  if (!isValidProjectId(projectId) || !prompt) {
    redirect('/extension/workspace?status=invalid')
  }
  const token = (await cookies()).get(EXTENSION_SESSION_COOKIE)?.value
  if (!token) redirect('/extension')
  const { data, error } = await createAdminClient().rpc('create_altiv_extension_request', {
    p_token_hash: sha256(token),
    p_project_id: projectId,
    p_prompt: prompt,
  })
  if (error || !data) redirect('/extension/workspace?status=unavailable')
  redirect('/extension/workspace?status=sent')
}
