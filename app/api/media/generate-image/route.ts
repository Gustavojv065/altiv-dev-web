import { NextResponse } from 'next/server'
import { generateMedia } from '@/lib/media/worker'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = await generateMedia({
      kind: 'image',
      prompt: String(body?.prompt ?? ''),
      projectId: body?.projectId ? String(body.projectId) : undefined,
      referenceImageUrl: body?.referenceImageUrl ? String(body.referenceImageUrl) : undefined,
      width: Number(body?.width ?? 1536),
      height: Number(body?.height ?? 1024),
      workflow: body?.workflow && typeof body.workflow === 'object' ? body.workflow : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Falha ao gerar imagem.' },
      { status: 503 },
    )
  }
}
