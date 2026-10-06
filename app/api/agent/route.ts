import { NextRequest, NextResponse } from 'next/server'
import { classifyTask, PIPELINE } from '@/lib/agent/pipeline'
import { chooseProvider } from '@/lib/ai/providers'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const prompt = String(body?.prompt ?? '').trim()
  const projectId = String(body?.projectId ?? '').trim()

  if (!prompt || !projectId) return NextResponse.json({ ok: false, error: 'Prompt e projeto são obrigatórios.' }, { status: 400 })

  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) return NextResponse.json({ ok: false, error: 'Não autenticado.' }, { status: 401 })

  const ownerId = String(claimsData.claims.sub)
  const { data: project } = await supabase.from('projects').select('id,name').eq('id', projectId).eq('owner_id', ownerId).maybeSingle()
  if (!project) return NextResponse.json({ ok: false, error: 'Projeto não encontrado.' }, { status: 404 })

  const task = classifyTask(prompt)
  const route = chooseProvider(task)

  let { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conversation) {
    const created = await supabase.from('conversations').insert({ owner_id: ownerId, project_id: projectId, title: prompt.slice(0, 80) }).select('id').single()
    if (created.error || !created.data) return NextResponse.json({ ok: false, error: created.error?.message ?? 'Falha ao criar conversa.' }, { status: 500 })
    conversation = created.data
  }

  const messageInsert = await supabase.from('messages').insert({ owner_id: ownerId, conversation_id: conversation.id, role: 'user', content: prompt })
  if (messageInsert.error) return NextResponse.json({ ok: false, error: messageInsert.error.message }, { status: 500 })

  const runInsert = await supabase.from('agent_runs').insert({
    owner_id: ownerId,
    project_id: projectId,
    conversation_id: conversation.id,
    prompt,
    task_type: task,
    status: 'planning',
    selected_model: route[0]?.id ?? null,
    fallback_models: route.slice(1).map((item) => item.id),
    started_at: new Date().toISOString(),
  }).select('id').single()

  if (runInsert.error || !runInsert.data) return NextResponse.json({ ok: false, error: runInsert.error?.message ?? 'Falha ao registrar execução.' }, { status: 500 })

  const steps = PIPELINE.map((step, index) => ({ owner_id: ownerId, run_id: runInsert.data.id, step_name: step, status: index === 0 ? 'running' : 'queued' }))
  await supabase.from('agent_run_steps').insert(steps)

  await supabase.from('project_memories').insert({
    owner_id: ownerId,
    project_id: projectId,
    scope: 'project',
    kind: 'context',
    content: prompt,
    importance: 50,
    metadata: { source: 'user_prompt', run_id: runInsert.data.id },
  })

  await supabase.from('projects').update({ status: 'building', updated_at: new Date().toISOString() }).eq('id', projectId).eq('owner_id', ownerId)

  return NextResponse.json({ ok: true, projectId, conversationId: conversation.id, runId: runInsert.data.id, task, route, pipeline: PIPELINE, persisted: true })
}
