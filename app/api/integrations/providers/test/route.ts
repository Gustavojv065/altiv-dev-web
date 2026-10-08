import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ProviderId } from '@/lib/ai/provider-catalog'
import { PROVIDER_REGISTRY, testProviderKey } from '@/lib/ai/provider-registry'

function validProvider(value:string):value is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDER_REGISTRY,value)
}

export async function POST(req:NextRequest) {
  const supabase = await createClient()
  const { data:claimsData,error:authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})

  const body = await req.json().catch(()=>({}))
  const provider = String(body?.provider ?? '')
  const key = String(body?.key ?? '').trim()
  if (!validProvider(provider)) return NextResponse.json({ok:false,error:'Provider inválido.'},{status:400})
  if (!key) return NextResponse.json({ok:false,error:'Chave obrigatória.'},{status:400})

  try {
    const result = await testProviderKey(provider,key)
    return NextResponse.json({ok:true,provider,modelCount:result.count,sampleModels:result.models})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao testar provider.'},{status:500})
  }
}
