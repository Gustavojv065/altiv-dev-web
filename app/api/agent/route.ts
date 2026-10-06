import { NextRequest, NextResponse } from 'next/server'
import { classifyTask, PIPELINE } from '@/lib/agent/pipeline'
import { chooseProvider } from '@/lib/ai/providers'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const prompt = String(body?.prompt ?? '').trim()

  if (!prompt) {
    return NextResponse.json({ ok: false, error: 'Prompt obrigatório.' }, { status: 400 })
  }

  const task = classifyTask(prompt)

  return NextResponse.json({
    ok: true,
    task,
    route: chooseProvider(task),
    pipeline: PIPELINE,
    projectMemory: true,
    browserValidation: true,
    nextAction: 'Connect AI Gateway, sandbox and GitHub execution tools.',
  })
}
