import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
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
    .select('id')
    .eq('id', id)
    .eq('owner_id', ownerId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const { data: file } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .eq('path', 'index.html')
    .maybeSingle()

  if (!file?.content) {
    return NextResponse.json({ ok: false, error: 'Crie o site antes de publicar.' }, { status: 400 })
  }

  const publishedAt = new Date().toISOString()
  const { error } = await supabase
    .from('projects')
    .update({ is_published: true, published_at: publishedAt, status: 'ready' })
    .eq('id', id)
    .eq('owner_id', ownerId)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, url: '/p/' + id, publishedAt })
}
