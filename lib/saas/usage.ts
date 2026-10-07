import { createClient } from '@/lib/supabase/server'

export type UsageEventType = 'agent_run' | 'project_create' | 'github_import' | 'deploy' | 'api_call'

export async function recordUsage(input:{
  ownerId:string
  accountId?:string | null
  type:UsageEventType
  quantity?:number
  metadata?:Record<string,unknown>
}) {
  try {
    const supabase = await createClient()
    await supabase.from('usage_events').insert({
      owner_id:input.ownerId,
      account_id:input.accountId ?? null,
      event_type:input.type,
      quantity:input.quantity ?? 1,
      metadata:input.metadata ?? {},
    })
  } catch {
    // Usage metering must never break the primary user action.
  }
}
