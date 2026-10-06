import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json().catch(() => ({}))
  const html = String(body?.html ?? '')

  if (!html.toLowerCase().includes('<html') || html.length < 100) {
    return NextResponse.json({ ok: false, error: 'HTML inválido ou muito curto.' }, { status: 400 })
  }

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

  const { data: current } = await supabase
    .from('project_files')
    .select('revision')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .eq('path', 'index.html')
    .maybeSingle()

  const revision = (current?.revision ?? 0) + 1

  const { error: writeError } = await supabase
    .from('project_files')
    .upsert({
      owner_id: ownerId,
      project_id: id,
      path: 'index.html',
      language: 'html',
      content: html,
      revision,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'project_id,path' })

  if (writeError) {
    return NextResponse.json({ ok: false, error: writeError.message }, { status: 500 })
  }

  const { data: lastVersion } = await supabase
    .from('project_versions')
    .select('version_number')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .order('version_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const versionNumber = (lastVersion?.version_number ?? 0) + 1

  await supabase.from('project_versions').insert({
    owner_id: ownerId,
    project_id: id,
    version_number: versionNumber,
    source_type: 'snapshot',
    summary: 'Edição manual do código',
    metadata: { revision, source: 'code-editor' },
  })

  await supabase.from('project_version_files').insert({
    owner_id: ownerId,
    project_id: id,
    version_number: versionNumber,
    path: 'index.html',
    content: html,
  })

  await supabase
    .from('projects')
    .update({ status: 'ready', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('owner_id', ownerId)

  return NextResponse.json({ ok: true, revision, versionNumber, html })
}
