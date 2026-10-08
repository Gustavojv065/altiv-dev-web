import { createHmac, timingSafeEqual } from 'node:crypto'

const API = 'https://api.mercadopago.com'

function accessToken() {
  const token = process.env.MERCADO_PAGO_ACCESS_TOKEN
  if (!token) throw new Error('MERCADO_PAGO_ACCESS_TOKEN não configurado.')
  return token
}

export async function createMercadoPagoSubscription(input:{
  accountId:string
  planCode:string
  planName:string
  payerEmail:string
  amount:number
  backUrl:string
}) {
  const response = await fetch(API + '/preapproval', {
    method:'POST',
    headers:{
      'content-type':'application/json',
      authorization:'Bearer ' + accessToken(),
    },
    body:JSON.stringify({
      reason:'ALTIV DEV — Plano ' + input.planName,
      external_reference:input.accountId + ':' + input.planCode,
      payer_email:input.payerEmail,
      auto_recurring:{
        frequency:1,
        frequency_type:'months',
        transaction_amount:input.amount,
        currency_id:'BRL',
      },
      back_url:input.backUrl,
    }),
    signal:AbortSignal.timeout(20000),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error('Mercado Pago recusou a assinatura (' + response.status + '): ' + JSON.stringify(data).slice(0,500))
  }

  return {
    id:String(data.id || ''),
    status:String(data.status || 'pending'),
    initPoint:String(data.init_point || ''),
    raw:data,
  }
}

export async function getMercadoPagoSubscription(id:string) {
  const response = await fetch(API + '/preapproval/' + encodeURIComponent(id), {
    headers:{ authorization:'Bearer ' + accessToken() },
    cache:'no-store',
    signal:AbortSignal.timeout(15000),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error('Falha ao consultar assinatura Mercado Pago (' + response.status + ').')
  return data as {
    id:string
    status:string
    external_reference?:string
    payer_id?:number|string
    next_payment_date?:string
    date_created?:string
    last_modified?:string
  }
}

export function verifyMercadoPagoWebhook(input:{
  xSignature:string|null
  xRequestId:string|null
  dataId:string
}) {
  const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET
  if (!secret || !input.xSignature || !input.xRequestId || !input.dataId) return false

  const pairs = Object.fromEntries(
    input.xSignature.split(',').map((part) => {
      const [key,...rest] = part.trim().split('=')
      return [key,rest.join('=')]
    })
  )
  const ts = pairs.ts
  const received = pairs.v1
  if (!ts || !received) return false

  const manifest = 'id:' + input.dataId + ';request-id:' + input.xRequestId + ';ts:' + ts + ';'
  const calculated = createHmac('sha256', secret).update(manifest).digest('hex')

  try {
    return timingSafeEqual(Buffer.from(calculated,'hex'), Buffer.from(received,'hex'))
  } catch {
    return false
  }
}
