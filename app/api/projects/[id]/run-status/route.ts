import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: auth } = await supabase.auth.getClaims()
  if (!auth?.claims?.sub) {
    return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  }
  const ownerId = String(auth.claims.sub)

  const { data: project } = await supabase
    .from('projects')
    .select('id,status,updated_at')
    .eq('id',id)
    .eq('owner_id',ownerId)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ ok:false, error:'Projeto não encontrado.' }, { status:404 })
  }

  const [{ data: lock }, { data: run }] = await Promise.all([
    supabase
      .from('project_agent_locks')
      .select('project_id,expires_at,created_at')
      .eq('project_id',id)
      .eq('owner_id',ownerId)
      .gt('expires_at',new Date().toISOString())
      .maybeSingle(),
    supabase
      .from('agent_runs')
      .select('id,status,prompt,selected_model,error_message,started_at,finished_at')
      .eq('project_id',id)
      .eq('owner_id',ownerId)
      .order('started_at',{ ascending:false })
      .limit(1)
      .maybeSingle(),
  ])

  let currentStep:string|null = null
  if (run?.id && !['completed','failed'].includes(String(run.status))) {
    const { data: step } = await supabase
      .from('agent_run_steps')
      .select('step_name,status,started_at,created_at')
      .eq('run_id',run.id)
      .eq('owner_id',ownerId)
      .in('status',['running','queued'])
      .order('status',{ ascending:false })
      .order('created_at',{ ascending:true })
      .limit(1)
      .maybeSingle()
    currentStep = step?.step_name ?? null
  }

  const active = Boolean(lock) || Boolean(run && !['completed','failed'].includes(String(run.status)))
  return NextResponse.json({
    ok:true,
    active,
    projectStatus:project.status,
    lockExpiresAt:lock?.expires_at ?? null,
    run:run ? {
      id:run.id,
      status:run.status,
      prompt:run.prompt,
      model:run.selected_model,
      error:run.error_message,
      startedAt:run.started_at,
      finishedAt:run.finished_at,
      currentStep,
    } : null,
  })
}
