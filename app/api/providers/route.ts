import { NextResponse } from 'next/server'
import { configuredProviders } from '@/lib/ai/provider-catalog'
import { PROVIDER_IDS, PROVIDER_REGISTRY } from '@/lib/ai/provider-registry'

export async function GET() {
  const configured = new Set(configuredProviders())
  return NextResponse.json({
    ok:true,
    providers:PROVIDER_IDS.map((id) => {
      const provider = PROVIDER_REGISTRY[id]
      return {
        id,
        label:provider.label,
        note:provider.note,
        supportsFree:Boolean(provider.free),
        byok:true,
        capabilities:provider.capabilities,
        configured:configured.has(id),
      }
    }),
    routing:{
      mode:'free-first-with-fallback',
      rule:'BYOK keys stay server-side. Manual mode can pin one provider/model; automatic mode lets the orchestrator choose and fall back.',
    },
  })
}
