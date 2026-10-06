import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const ownerId = String(claimsData.claims.sub)

  const { data: project } = await supabase
    .from('projects')
    .select('id,name,status,updated_at')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const { data: file } = await supabase
    .from('project_files')
    .select('content,revision,updated_at')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .eq('path', 'index.html')
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    project,
    html: file?.content ?? '',
    revision: file?.revision ?? 0,
    fileUpdatedAt: file?.updated_at ?? null,
  })
}
