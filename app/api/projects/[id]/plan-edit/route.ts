import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { planFileTargets, type ProjectFileInfo } from '@/lib/agent/file-intelligence'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const prompt = String(body?.prompt ?? '').trim()
  if (!prompt) return NextResponse.json({ ok: false, error: 'Pedido vazio.' }, { status: 400 })

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const ownerId = auth?.claims?.sub
  if (!ownerId) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })

  const { data: files, error } = await supabase
    .from('project_files')
    .select('path,content,revision,language')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .order('path')

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  const plan = planFileTargets(prompt, (files ?? []) as ProjectFileInfo[])
  return NextResponse.json({ ok: true, plan })
}
