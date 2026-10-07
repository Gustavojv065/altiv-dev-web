import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/saas/access'
import { getAccountPlan } from '@/lib/saas/account'
import { createAdminClient } from '@/lib/supabase/admin'
import { createMercadoPagoSubscription } from '@/lib/billing/mercado-pago'

export async function POST(req:NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})
  if (!user.email) return NextResponse.json({ok:false,error:'Sua conta precisa ter e-mail confirmado para assinar.'},{status:400})

  const body = await req.json().catch(() => ({}))
  const planCode = String(body?.planCode ?? '')
  if (!['starter','pro','business'].includes(planCode)) {
    return NextResponse.json({ok:false,error:'Plano inválido.'},{status:400})
  }

  try {
    const context = await getAccountPlan(user.id)
    const admin = createAdminClient()
    const { data:plan,error } = await admin
      .from('saas_plans')
      .select('code,name,price_monthly_brl,active')
      .eq('code',planCode)
      .eq('active',true)
      .single()

    if (error || !plan) throw error || new Error('Plano não encontrado.')
    const amount = Number(plan.price_monthly_brl || 0)
    if (!(amount > 0)) return NextResponse.json({ok:false,error:'Preço deste plano ainda não foi configurado.'},{status:409})

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://altiv-dev-web.vercel.app'
    const subscription = await createMercadoPagoSubscription({
      accountId:context.account.id,
      planCode,
      planName:plan.name,
      payerEmail:user.email,
      amount,
      backUrl:siteUrl + '/workspace?billing=return',
    })

    if (!subscription.id || !subscription.initPoint) {
      return NextResponse.json({ok:false,error:'Mercado Pago não retornou URL de pagamento.'},{status:502})
    }

    return NextResponse.json({
      ok:true,
      checkoutUrl:subscription.initPoint,
      providerSubscriptionId:subscription.id,
      status:subscription.status,
    })
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao iniciar assinatura.'},{status:500})
  }
}
