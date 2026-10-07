import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/saas/access'
import { billingReadiness } from '@/lib/saas/billing'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})
  return NextResponse.json({ok:true,billing:billingReadiness()})
}
