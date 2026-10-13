import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCredential } from '@/lib/integrations/user-credentials'
import { pushProjectToGitHub } from '@/lib/github/project-sync'
import { recordUsage } from '@/lib/saas/usage'

function safeBranchName(projectId:string) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14)
  return 'altiv/' + projectId.slice(0,8) + '-' + stamp
}

export async function POST(req:NextRequest,{params}:{params:Promise<{id:string}>}) {
  const { id } = await params
  const supabase = await createClient()
  const { data:claimsData,error:authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) return NextResponse.json({ok:false,error:'Não autenticado.'},{status:401})

  const ownerId = String(claimsData.claims.sub)
  const body = await req.json().catch(() => ({}))
  const message = String(body?.message || 'Atualização via ALTIV DEV').slice(0,120)

  const { data:project } = await supabase
    .from('projects')
    .select('id,name,github_repo,github_branch')
    .eq('id',id)
    .eq('owner_id',ownerId)
    .maybeSingle()

  if (!project?.github_repo) return NextResponse.json({ok:false,error:'Este projeto não está conectado a um repositório GitHub.'},{status:400})

  const { data:files,error:filesError } = await supabase
    .from('project_files')
    .select('path,content')
    .eq('project_id',id)
    .eq('owner_id',ownerId)
    .order('path')

  if (filesError) return NextResponse.json({ok:false,error:filesError.message},{status:500})
  if (!files?.length) return NextResponse.json({ok:false,error:'Nenhum arquivo para enviar ao GitHub.'},{status:400})

  try {
    const credential = await getCredential(ownerId,'github')
    const token = credential?.secret || process.env.GITHUB_TOKEN
    if (!token) return NextResponse.json({ok:false,error:'GitHub não conectado.'},{status:400})

    // Persist a complete restore point before any external GitHub write.
    const { data:lastVersion,error:lastVersionError } = await supabase
      .from('project_versions')
      .select('version_number')
      .eq('project_id',id)
      .eq('owner_id',ownerId)
      .order('version_number',{ ascending:false })
      .limit(1)
      .maybeSingle()
    if (lastVersionError) throw lastVersionError

    const backupVersion = (lastVersion?.version_number ?? 0) + 1
    const { error:backupError } = await supabase.from('project_versions').insert({
      owner_id:ownerId,
      project_id:id,
      version_number:backupVersion,
      source_type:'snapshot',
      summary:'Backup antes do envio ao GitHub',
      metadata:{ action:'pre_github_push', repository:project.github_repo, file_count:files.length },
    })
    if (backupError) throw backupError

    const { error:backupFilesError } = await supabase.from('project_version_files').insert(
      files.map((file)=>({
        owner_id:ownerId,
        project_id:id,
        version_number:backupVersion,
        path:file.path,
        content:file.content,
      }))
    )
    if (backupFilesError) {
      await supabase.from('project_versions').delete()
        .eq('project_id',id).eq('owner_id',ownerId).eq('version_number',backupVersion)
      throw backupFilesError
    }

    const branchName = safeBranchName(id)
    const result = await pushProjectToGitHub({
      token,
      repoFullName:project.github_repo,
      baseBranch:project.github_branch || 'main',
      files,
      message,
      branchName,
      createPullRequest:true,
    })

    await recordUsage({
      ownerId,
      type:'api_call',
      metadata:{ provider:'github',action:'push_pr',projectId:id,repository:project.github_repo,branch:branchName },
    })

    return NextResponse.json({ok:true,backupVersion,...result})
  } catch (error) {
    return NextResponse.json({ok:false,error:error instanceof Error ? error.message : 'Falha ao enviar para GitHub.'},{status:500})
  }
}
