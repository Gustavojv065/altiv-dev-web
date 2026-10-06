import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

function lineDiff(a: string, b: string) {
  const before = a.split('\n')
  const after = b.split('\n')
  const max = Math.max(before.length, after.length)
  const changes: Array<{ line: number; before?: string; after?: string }> = []

  for (let i = 0; i < max; i++) {
    if (before[i] !== after[i]) {
      changes.push({ line: i + 1, before: before[i], after: after[i] })
      if (changes.length >= 300) break
    }
  }

  return {
    changedLines: changes.length,
    truncated: changes.length >= 300,
    changes,
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const url = new URL(req.url)
  const from = Number(url.searchParams.get('from'))
  const to = Number(url.searchParams.get('to'))

  if (!Number.isInteger(from) || !Number.isInteger(to)) {
    return NextResponse.json({ ok: false, error: 'Informe versões válidas em from e to.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) {
    return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })
  }

  const ownerId = String(claimsData.claims.sub)
  const { data } = await supabase
    .from('project_version_files')
    .select('version_number,content')
    .eq('project_id', id)
    .eq('owner_id', ownerId)
    .eq('path', 'index.html')
    .in('version_number', [from, to])

  const a = data?.find((row) => row.version_number === from)?.content
  const b = data?.find((row) => row.version_number === to)?.content

  if (!a || !b) {
    return NextResponse.json({ ok: false, error: 'Snapshot de uma das versões não está disponível.' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, from, to, ...lineDiff(a, b) })
}
