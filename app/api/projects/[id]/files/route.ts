import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const ownerId = auth?.claims?.sub
  if (!ownerId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

  const { data, error } = await supabase
    .from('project_files')
    .select('path,language,revision,content')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .order('path')

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, files: data ?? [] })
}
