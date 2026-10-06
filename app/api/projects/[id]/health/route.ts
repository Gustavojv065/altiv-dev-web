import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { analyzeHtmlQuality } from '@/lib/agent/quality'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()

  if (authError || !claimsData?.claims) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const ownerId = String(claimsData.claims.sub)
  const [{ data: project }, { data: files }, { data: spec }] = await Promise.all([
    supabase.from('projects').select('id,name,status').eq('id', id).eq('owner_id', ownerId).maybeSingle(),
    supabase.from('project_files').select('path,language,revision,content').eq('project_id', id).eq('owner_id', ownerId),
    supabase.from('project_specs').select('spec').eq('project_id', id).eq('owner_id', ownerId).maybeSingle(),
  ])

  if (!project) {
    return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })
  }

  const htmlFile = files?.find((file) => file.path === 'index.html')
  const quality = htmlFile?.content
    ? analyzeHtmlQuality(htmlFile.content)
    : { score: 0, issues: ['index.html ainda não existe'], checks: {} }

  return NextResponse.json({
    ok: true,
    project,
    fileMap: (files ?? []).map(({ path, language, revision }) => ({ path, language, revision })),
    quality,
    spec: spec?.spec ?? null,
  })
}
