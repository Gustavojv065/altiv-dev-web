import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getMercadoPagoSubscription, verifyMercadoPagoWebhook } from '@/lib/billing/mercado-pago'

function mapStatus(status:string) {
  if (status === 'authorized') return 'active'
  if (status === 'paused') return 'paused'
  if (status === 'cancelled' || status === 'cancelled_by_user') return 'canceled'
  return 'past_due'
}

export async function POST(req:NextRequest) {
  const url = new URL(req.url)
  const body = await req.json().catch(() => ({}))
  const dataId = String(url.searchParams.get('data.id') || body?.data?.id || '')
  const eventId = String(body?.id || dataId || '')
  const valid = verifyMercadoPagoWebhook({
    xSignature:req.headers.get('x-signature'),
    xRequestId:req.headers.get('x-request-id'),
    dataId,
  })

  if (!valid) return NextResponse.json({ok:false},{status:401})

  const admin = createAdminClient()
  const eventInsert = await admin.from('billing_events').upsert({
    provider:'mercado_pago',
    provider_event_id:eventId || null,
    event_type:String(body?.type || body?.action || 'subscription'),
    payload:body,
  }, { onConflict:'provider,provider_event_id', ignoreDuplicates:true }).select('id,processed').maybeSingle()

  if (eventInsert.data?.processed) return NextResponse.json({ok:true,duplicate:true})

  try {
    const subscription = await getMercadoPagoSubscription(dataId)
    const [accountId,planCode] = String(subscription.external_reference || '').split(':')
    if (!accountId || !['starter','pro','business'].includes(planCode)) {
      throw new Error('external_reference inválida.')
    }

    const localStatus = mapStatus(subscription.status)
    const { data:existing } = await admin
      .from('saas_subscriptions')
      .select('id')
      .eq('provider','mercado_pago')
      .eq('provider_subscription_id',subscription.id)
      .maybeSingle()

    const row = {
      account_id:accountId,
      plan_code:planCode,
      provider:'mercado_pago',
      provider_customer_id:subscription.payer_id ? String(subscription.payer_id) : null,
      provider_subscription_id:subscription.id,
      status:localStatus,
      current_period_start:subscription.date_created || null,
      current_period_end:subscription.next_payment_date || null,
      updated_at:new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await admin.from('saas_subscriptions').update(row).eq('id',existing.id)
      if (error) throw error
    } else {
      const { error } = await admin.from('saas_subscriptions').insert(row)
      if (error) throw error
    }

    if (localStatus === 'active') {
      await admin.from('saas_accounts').update({status:'active',updated_at:new Date().toISOString()}).eq('id',accountId)
    } else if (localStatus === 'paused' || localStatus === 'past_due') {
      await admin.from('saas_accounts').update({status:'past_due',updated_at:new Date().toISOString()}).eq('id',accountId)
    }

    if (eventInsert.data?.id) {
      await admin.from('billing_events').update({
        account_id:accountId,
        processed:true,
        processed_at:new Date().toISOString(),
        error_message:null,
      }).eq('id',eventInsert.data.id)
    }

    return NextResponse.json({ok:true})
  } catch (error) {
    if (eventInsert.data?.id) {
      await admin.from('billing_events').update({
        error_message:error instanceof Error ? error.message : String(error),
      }).eq('id',eventInsert.data.id)
    }
    return NextResponse.json({ok:false},{status:500})
  }
}
