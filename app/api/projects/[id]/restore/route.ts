import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const versionNumber = Number(body?.versionNumber)
  if (!Number.isInteger(versionNumber) || versionNumber < 1) {
    return NextResponse.json({ ok: false, error: 'Versão inválida.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  const ownerId = auth?.claims?.sub
  if (!ownerId) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const { data: project } = await supabase.from('projects')
    .select('id').eq('id', id).eq('owner_id', ownerId).maybeSingle()
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })

  const { data: snapshotFiles, error: readError } = await supabase
    .from('project_version_files')
    .select('path,content')
    .eq('project_id', id).eq('owner_id', ownerId)
    .eq('version_number', versionNumber)
  if (readError || !snapshotFiles?.length) {
    return NextResponse.json({ ok: false, error: 'Snapshot indisponível.' }, { status: 404 })
  }

  const { data: currentFiles } = await supabase.from('project_files')
    .select('path,revision,content')
    .eq('project_id', id).eq('owner_id', ownerId)

  const previous = new Map((currentFiles ?? []).map((item) => [item.path, item]))
  const now = new Date().toISOString()
  const restored = snapshotFiles.map((file) => ({
    owner_id: ownerId,
    project_id: id,
    path: file.path,
    content: file.content,
    revision: (previous.get(file.path)?.revision ?? 0) + 1,
    language: file.path.endsWith('.css') ? 'css' : file.path.endsWith('.js') ? 'javascript' : 'html',
    updated_at: now,
  }))

  const { error: saveError } = await supabase.from('project_files')
    .upsert(restored, { onConflict: 'project_id,path' })
  if (saveError) return NextResponse.json({ ok: false, error: saveError.message }, { status: 500 })

  const { data: last } = await supabase.from('project_versions')
    .select('version_number').eq('project_id', id).eq('owner_id', ownerId)
    .order('version_number', { ascending: false }).limit(1).maybeSingle()
  const newVersionNumber = (last?.version_number ?? 0) + 1

  const { error: versionError } = await supabase.from('project_versions').insert({
    owner_id: ownerId, project_id: id, version_number: newVersionNumber,
    source_type: 'snapshot',
    summary: 'Restauração da versão r' + versionNumber,
    metadata: { restored_from: versionNumber, file_count: restored.length },
  })
  if (versionError) return NextResponse.json({ ok: false, error: versionError.message }, { status: 500 })

  const { error: snapshotError } = await supabase.from('project_version_files').insert(
    restored.map((file) => ({
      owner_id: ownerId, project_id: id, version_number: newVersionNumber,
      path: file.path, content: file.content,
    }))
  )
  if (snapshotError) return NextResponse.json({ ok: false, error: snapshotError.message }, { status: 500 })

  await supabase.from('projects').update({ status: 'ready', updated_at: now })
    .eq('id', id).eq('owner_id', ownerId)

  const htmlFile = restored.find((file) => file.path === 'index.html')
  return NextResponse.json({
    ok: true,
    html: htmlFile?.content ?? '',
    revision: htmlFile?.revision ?? 0,
    files: restored,
    restoredVersion: versionNumber,
    versionNumber: newVersionNumber,
  })
}
