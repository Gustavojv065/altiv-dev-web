import { NextResponse } from 'next/server'
import { capabilities } from '@/lib/integrations/capabilities'

export function GET() {
  return NextResponse.json({
    ok: true,
    service: 'ALTIV DEV',
    version: '0.2.0',
    capabilities,
  })
}
