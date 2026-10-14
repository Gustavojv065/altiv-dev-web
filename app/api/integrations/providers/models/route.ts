import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { discoverProviderModels, PROVIDER_REGISTRY } from '@/lib/ai/provider-registry'
import type { ProviderId } from '@/lib/ai/provider-catalog'
import { clearManualRouting, getCredential, updateCredentialMetadata } from '@/lib/integrations/user-credentials'

async function ownerId() {
  const supabase = await createClient()
  const { data,error } = await supabase.auth.getClaims()
  if (error || !data?.claims?.sub) return null
  return String(data.claims.sub)
}

function validProvider(value:string):value is ProviderId {
  return Object.prototype.hasOwnProperty.call(PROVIDER_REGISTRY,value)
}

export async function GET(req:NextRequest) {
  const id = await ownerId()
  if (!id) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})
  const provider = String(new URL(req.url).searchParams.get('provider') ?? '')
  if (!validProvider(provider)) return NextResponse.json({ok:false,error:'Provider inválido.'},{status:400})

  try {
    const credential = await getCredential(id,provider)
    if (!credential?.secret) return NextResponse.json({ok:false,error:'Provider não conectado.'},{status:400})
    const models = await discoverProviderModels(provider,credential.secret)
    return NextResponse.json({
      ok:true,
      provider,
      models,
      selectedModel:String(credential.metadata?.selectedModel ?? ''),
      manualActive:Boolean(credential.metadata?.manualActive),
      count:models.length,
    })
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao carregar modelos.'},{status:500})
  }
}

export async function POST(req:NextRequest) {
  const id = await ownerId()
  if (!id) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})
  const body = await req.json().catch(()=>({}))
  const mode = String(body?.mode ?? 'auto')
  if (mode === 'auto') {
    try {
      await clearManualRouting(id)
      return NextResponse.json({ok:true,mode:'auto'})
    } catch (error) {
      return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao ativar modo automático.'},{status:500})
    }
  }

  const provider = String(body?.provider ?? '')
  const model = String(body?.model ?? '').trim()
  if (!validProvider(provider) || !model) return NextResponse.json({ok:false,error:'Provider e modelo são obrigatórios.'},{status:400})

  try {
    const credential = await getCredential(id,provider)
    if (!credential?.secret) return NextResponse.json({ok:false,error:'Provider não conectado.'},{status:400})
    await clearManualRouting(id)
    await updateCredentialMetadata(id,provider,{ selectedModel:model, manualActive:true })
    return NextResponse.json({ok:true,mode:'manual',provider,model})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao salvar preferência.'},{status:500})
  }
}
