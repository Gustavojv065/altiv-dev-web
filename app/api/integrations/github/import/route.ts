import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCredential } from '@/lib/integrations/user-credentials'
import { githubRequest } from '@/lib/github/client'

export const maxDuration = 300

const allowedExtensions = new Set([
  'html','css','js','jsx','ts','tsx','json','md','mdx','vue','svelte','astro',
  'yml','yaml','toml','txt','sql','svg'
])

function language(path:string) {
  const ext = path.split('.').pop()?.toLowerCase() || 'text'
  return ext === 'yml' ? 'yaml' : ext
}

export async function POST(req:NextRequest) {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  const ownerId = String(data.claims.sub)
  const body = await req.json().catch(() => ({}))
  const fullName = String(body?.fullName ?? '').trim()
  const branch = String(body?.branch ?? 'main').trim()
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(fullName)) {
    return NextResponse.json({ ok:false, error:'Repositório inválido.' }, { status:400 })
  }

  try {
    const credential = await getCredential(ownerId, 'github')
    const token = credential?.secret || process.env.GITHUB_TOKEN
    if (!token) return NextResponse.json({ ok:false, error:'GitHub não conectado.' }, { status:400 })

    const repo = await githubRequest<{name:string;full_name:string;default_branch:string}>('/repos/' + fullName, { token })
    const ref = branch || repo.default_branch
    const tree = await githubRequest<{tree:Array<{path:string;type:string;size?:number;sha:string}>;truncated:boolean}>(
      '/repos/' + fullName + '/git/trees/' + encodeURIComponent(ref) + '?recursive=1',
      { token }
    )

    const candidates = tree.tree
      .filter((item) => item.type === 'blob' && (item.size ?? 0) <= 300000)
      .filter((item) => allowedExtensions.has(item.path.split('.').pop()?.toLowerCase() || ''))
      .filter((item) => !/(^|\/)(node_modules|dist|build|\.next|coverage|vendor)(\/|$)/.test(item.path))
      .slice(0, 120)

    const projectInsert = await supabase.from('projects').insert({
      owner_id: ownerId,
      name: repo.name,
      status: 'draft',
      github_repo: repo.full_name,
    }).select('id').single()
    if (projectInsert.error || !projectInsert.data) throw projectInsert.error || new Error('Falha ao criar projeto.')
    const projectId = projectInsert.data.id

    const rows:Array<{owner_id:string;project_id:string;path:string;content:string;revision:number;language:string}> = []

    for (let i=0;i<candidates.length;i+=8) {
      const chunk = candidates.slice(i,i+8)
      const contents = await Promise.all(chunk.map(async (item) => {
        try {
          const file = await githubRequest<{content?:string;encoding?:string}>(
            '/repos/' + fullName + '/contents/' + item.path + '?ref=' + encodeURIComponent(ref),
            { token }
          )
          if (file.encoding !== 'base64' || !file.content) return null
          return {
            owner_id: ownerId,
            project_id: projectId,
            path: item.path,
            content: Buffer.from(file.content.replace(/\n/g,''), 'base64').toString('utf8'),
            revision: 1,
            language: language(item.path),
          }
        } catch {
          return null
        }
      }))
      rows.push(...contents.filter((row): row is NonNullable<typeof row> => Boolean(row)))
    }

    if (rows.length) {
      const write = await supabase.from('project_files').upsert(rows, { onConflict:'project_id,path' })
      if (write.error) throw write.error
    }

    return NextResponse.json({
      ok:true,
      projectId,
      importedFiles:rows.length,
      truncated:tree.truncated || candidates.length >= 120,
      repository:repo.full_name,
      branch:ref,
    })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao importar repositório.' }, { status:500 })
  }
}
