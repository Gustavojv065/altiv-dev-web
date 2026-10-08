import { NextResponse } from 'next/server'
import { generateMedia } from '@/lib/media/worker'
import { MEDIA_PROVIDERS, type MediaOperation } from '@/lib/media/providers'

const imageOps = new Set<MediaOperation>([
  'image-generate','image-edit','remove-background','inpaint','upscale','face-restore'
])
const videoOps = new Set<MediaOperation>(['video-generate','video-interpolate'])

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const operation = String(body?.operation ?? '') as MediaOperation
    const supported = MEDIA_PROVIDERS.some((provider) => provider.operations.includes(operation))
    if (!supported) {
      return NextResponse.json({ ok:false, error:'Operação de mídia não suportada.' }, { status:400 })
    }

    const workerUrl = (process.env.ALTIV_MEDIA_WORKER_URL ?? '').trim().replace(/\/$/, '')
    if (!workerUrl) {
      if (operation === 'image-generate' || operation === 'video-generate') {
        const result = await generateMedia({
          kind: operation === 'image-generate' ? 'image' : 'video',
          prompt: String(body?.prompt ?? ''),
          projectId: body?.projectId ? String(body.projectId) : undefined,
          referenceImageUrl: body?.referenceImageUrl ? String(body.referenceImageUrl) : undefined,
          width: Number(body?.width ?? (operation === 'image-generate' ? 1536 : 1280)),
          height: Number(body?.height ?? (operation === 'image-generate' ? 1024 : 720)),
          durationSeconds: Number(body?.durationSeconds ?? 5),
        })
        return NextResponse.json({ ...result, operation })
      }

      return NextResponse.json({
        ok:false,
        error:'ALTIV_MEDIA_WORKER_URL ainda não está configurado para esta operação.',
        operation,
      }, { status:503 })
    }

    const response = await fetch(workerUrl + '/v1/media/run', {
      method:'POST',
      headers:{
        'content-type':'application/json',
        ...(process.env.ALTIV_MEDIA_API_KEY
          ? { authorization:'Bearer ' + process.env.ALTIV_MEDIA_API_KEY }
          : {}),
      },
      body:JSON.stringify({
        operation,
        prompt:String(body?.prompt ?? ''),
        projectId:body?.projectId,
        inputUrl:body?.inputUrl ?? body?.referenceImageUrl,
        maskUrl:body?.maskUrl,
        width:body?.width,
        height:body?.height,
        durationSeconds:body?.durationSeconds,
        voice:body?.voice,
        options:body?.options,
      }),
      cache:'no-store',
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return NextResponse.json({ ok:false, operation, error:data?.error ?? 'Falha no worker de mídia.' }, { status:response.status })
    }

    return NextResponse.json({
      ok:true,
      operation,
      provider:data?.provider ?? 'altiv-worker',
      jobId:data?.jobId ?? data?.id,
      status:data?.status ?? 'queued',
      outputUrl:data?.outputUrl ?? data?.url,
      outputs:data?.outputs,
      kind:imageOps.has(operation) ? 'image' : videoOps.has(operation) ? 'video' : 'other',
    })
  } catch (error) {
    return NextResponse.json(
      { ok:false, error:error instanceof Error ? error.message : 'Falha ao executar operação de mídia.' },
      { status:503 },
    )
  }
}
