import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.from('projects').select('id').limit(1)
    return NextResponse.json({ ok: !error, connected: true, error: error?.message ?? null })
  } catch (error) {
    return NextResponse.json({ ok: false, connected: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
