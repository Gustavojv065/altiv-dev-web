import { NextResponse } from 'next/server'
import { MEDIA_PROVIDERS } from '@/lib/media/providers'

export async function GET() {
  return NextResponse.json({ ok:true, providers:MEDIA_PROVIDERS })
}
