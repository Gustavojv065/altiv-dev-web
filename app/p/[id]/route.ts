import { createClient } from '@/lib/supabase/server'
import { renderStaticSite } from '@/lib/project/render'

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

  if (!project) return new Response('Site não publicado.', { status: 404 })

  const { data: files } = await supabase
    .from('project_files')
    .select('path,content')
    .eq('project_id', id)
    .in('path', ['index.html', 'styles.css', 'script.js'])

  const html = renderStaticSite(files ?? [])
  if (!html) return new Response('Arquivo não encontrado.', { status: 404 })

  return new Response(html, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=60, s-maxage=60',
      'content-security-policy': "sandbox allow-scripts allow-forms allow-popups; base-uri 'none'; object-src 'none'",
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'strict-origin-when-cross-origin',
    },
  })
}
