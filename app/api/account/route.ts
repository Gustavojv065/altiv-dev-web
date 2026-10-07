import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/saas/access'
import { getAccountPlan } from '@/lib/saas/account'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})
  try {
    const {account,subscription,plan} = await getAccountPlan(user.id)
    return NextResponse.json({ok:true,account,subscription,plan})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao carregar conta.'},{status:500})
  }
}
