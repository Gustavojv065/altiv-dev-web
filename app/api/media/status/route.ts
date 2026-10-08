import { NextResponse } from 'next/server'
import { getMediaStatus } from '@/lib/media/worker'

export async function GET() {
  return NextResponse.json(await getMediaStatus())
}
