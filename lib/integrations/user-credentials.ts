import { createClient } from '@/lib/supabase/server'
import { decryptSecret, encryptSecret } from '@/lib/security/secrets'
import type { ProviderId } from '@/lib/ai/provider-catalog'

export type CredentialKind = ProviderId | 'github'

export async function listCredentialStates(ownerId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_credentials')
    .select('kind,label,enabled,metadata,updated_at')
    .eq('owner_id', ownerId)
  if (error) throw error
  return data ?? []
}

export async function saveCredential(ownerId: string, kind: CredentialKind, secret: string, label?: string, metadata?: Record<string, unknown>) {
  const supabase = await createClient()
  const encrypted = encryptSecret(secret)
  const { error } = await supabase
    .from('user_credentials')
    .upsert({
      owner_id: ownerId,
      kind,
      label: label || kind,
      encrypted_secret: encrypted.ciphertext,
      secret_iv: encrypted.iv,
      secret_tag: encrypted.tag,
      enabled: true,
      metadata: metadata ?? {},
      updated_at: new Date().toISOString(),
    }, { onConflict: 'owner_id,kind' })
  if (error) throw error
}

export async function getCredential(ownerId: string, kind: CredentialKind) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_credentials')
    .select('encrypted_secret,secret_iv,secret_tag,enabled,metadata')
    .eq('owner_id', ownerId)
    .eq('kind', kind)
    .maybeSingle()
  if (error) throw error
  if (!data?.enabled) return null
  return {
    secret: decryptSecret({
      ciphertext: data.encrypted_secret,
      iv: data.secret_iv,
      tag: data.secret_tag,
    }),
    metadata: (data.metadata ?? {}) as Record<string, unknown>,
  }
}

export async function deleteCredential(ownerId: string, kind: CredentialKind) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('user_credentials')
    .delete()
    .eq('owner_id', ownerId)
    .eq('kind', kind)
  if (error) throw error
}


export async function updateCredentialMetadata(ownerId:string, kind:CredentialKind, metadata:Record<string,unknown>) {
  const supabase = await createClient()
  const { data:current, error:readError } = await supabase
    .from('user_credentials')
    .select('metadata')
    .eq('owner_id',ownerId)
    .eq('kind',kind)
    .maybeSingle()
  if (readError) throw readError
  if (!current) throw new Error('Credencial não encontrada.')
  const { error } = await supabase
    .from('user_credentials')
    .update({ metadata:{ ...(current.metadata ?? {}), ...metadata }, updated_at:new Date().toISOString() })
    .eq('owner_id',ownerId)
    .eq('kind',kind)
  if (error) throw error
}

export async function clearManualRouting(ownerId:string) {
  const supabase = await createClient()
  const { data:rows, error } = await supabase
    .from('user_credentials')
    .select('kind,metadata')
    .eq('owner_id',ownerId)
  if (error) throw error
  for (const row of rows ?? []) {
    const metadata = { ...(row.metadata ?? {}), manualActive:false }
    const { error:updateError } = await supabase
      .from('user_credentials')
      .update({ metadata, updated_at:new Date().toISOString() })
      .eq('owner_id',ownerId)
      .eq('kind',row.kind)
    if (updateError) throw updateError
  }
}
