import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: project } = await supabase
    .from('projects')
    .select('id,is_published')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (!project) {
    return new Response('Site não publicado.', { status: 404 })
  }

  const { data: file } = await supabase
    .from('project_files')
    .select('content')
    .eq('project_id', id)
    .eq('path', 'index.html')
    .maybeSingle()

  if (!file?.content) {
    return new Response('Arquivo não encontrado.', { status: 404 })
  }

  return new Response(file.content, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
    },
  })
}
