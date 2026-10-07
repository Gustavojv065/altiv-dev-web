import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCredential } from '@/lib/integrations/user-credentials'
import { githubRequest } from '@/lib/github/client'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  const ownerId = String(data.claims.sub)

  try {
    const credential = await getCredential(ownerId, 'github')
    const token = credential?.secret || process.env.GITHUB_TOKEN
    if (!token) return NextResponse.json({ ok:false, error:'GitHub não conectado.' }, { status:400 })

    const repos = await githubRequest<Array<{
      id:number
      full_name:string
      private:boolean
      default_branch:string
      html_url:string
      updated_at:string
    }>>('/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member', { token })

    return NextResponse.json({
      ok:true,
      repositories:repos.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        private: repo.private,
        defaultBranch: repo.default_branch,
        url: repo.html_url,
        updatedAt: repo.updated_at,
      })),
    })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao consultar GitHub.' }, { status:500 })
  }
}
