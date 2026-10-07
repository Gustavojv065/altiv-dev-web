import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const path = body?.path
  const content = body?.content
  if ((path !== 'styles.css' && path !== 'script.js') || typeof content !== 'string' || content.length > 250000) {
    return NextResponse.json({ ok: false, error: 'Arquivo inválido' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const ownerId = auth?.claims?.sub
  if (!ownerId) return NextResponse.json({ ok: false, error: 'Não autenticado' }, { status: 401 })

  const { data: project } = await supabase.from('projects').select('id')
    .eq('id', id).eq('owner_id', ownerId).maybeSingle()
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado' }, { status: 404 })

  const { data: current } = await supabase.from('project_files')
    .select('revision').eq('project_id', id).eq('owner_id', ownerId).eq('path', path).maybeSingle()

  const revision = (current?.revision ?? 0) + 1
  const { error } = await supabase.from('project_files').upsert({
    project_id: id,
    owner_id: ownerId,
    path,
    language: path === 'styles.css' ? 'css' : 'javascript',
    content,
    revision,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'project_id,path' })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const { data: last } = await supabase.from('project_versions')
    .select('version_number').eq('project_id', id).eq('owner_id', ownerId)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()
  const versionNumber = (last?.version_number ?? 0) + 1

  const { error: versionError } = await supabase.from('project_versions').insert({
    project_id: id, owner_id: ownerId, version_number: versionNumber,
    source_type: 'snapshot', summary: 'Edição manual de ' + path,
    metadata: { source: 'file-editor', path, revision },
  })
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 })

  const { data: allFiles, error: readError } = await supabase.from('project_files')
    .select('path,content').eq('project_id', id).eq('owner_id', ownerId)
  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 })

  const { error: snapshotError } = await supabase.from('project_version_files').insert(
    (allFiles ?? []).map((file) => ({
      project_id: id, owner_id: ownerId, version_number: versionNumber,
      path: file.path, content: file.content,
    }))
  )
  if (snapshotError) return NextResponse.json({ ok: false, error: snapshotError.message }, { status: 500 })

  await supabase.from('projects').update({ updated_at: new Date().toISOString() })
    .eq('id', id).eq('owner_id', ownerId)

  return NextResponse.json({ ok: true, path, revision, versionNumber })
}
