import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import IntegrationsClient from '@/components/IntegrationsClient'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) redirect('/login')
  return <IntegrationsClient />
}
