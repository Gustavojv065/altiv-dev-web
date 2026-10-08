export type MediaKind = 'image' | 'video'

export type MediaJobRequest = {
  kind: MediaKind
  prompt: string
  projectId?: string
  referenceImageUrl?: string
  width?: number
  height?: number
  durationSeconds?: number
  workflow?: Record<string, unknown>
}

export type MediaJobResult = {
  ok: boolean
  provider: 'altiv-worker' | 'comfyui'
  jobId?: string
  status?: string
  outputUrl?: string
  outputs?: unknown
  error?: string
}

function cleanBaseUrl(value?: string) {
  return (value ?? '').trim().replace(/\/$/, '')
}

async function workerRequest(path: string, body: Record<string, unknown>) {
  const baseUrl = cleanBaseUrl(process.env.ALTIV_MEDIA_WORKER_URL)
  if (!baseUrl) return null

  const response = await fetch(baseUrl + path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(process.env.ALTIV_MEDIA_API_KEY
        ? { authorization: 'Bearer ' + process.env.ALTIV_MEDIA_API_KEY }
        : {}),
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error ?? 'O servidor de mídia recusou a solicitação.')
  }

  return data
}

async function comfyPrompt(workflow: Record<string, unknown>) {
  const baseUrl = cleanBaseUrl(process.env.COMFYUI_BASE_URL)
  if (!baseUrl) return null

  const response = await fetch(baseUrl + '/prompt', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt: workflow }),
    cache: 'no-store',
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error ?? 'O ComfyUI recusou o workflow.')
  }

  return data
}

export async function getMediaStatus() {
  const workerUrl = cleanBaseUrl(process.env.ALTIV_MEDIA_WORKER_URL)
  const comfyUrl = cleanBaseUrl(process.env.COMFYUI_BASE_URL)

  return {
    ok: true,
    configured: Boolean(workerUrl || comfyUrl),
    worker: Boolean(workerUrl),
    comfyui: Boolean(comfyUrl),
    image: Boolean(workerUrl || comfyUrl),
    video: Boolean(workerUrl || comfyUrl),
    note: workerUrl
      ? 'ALTIV Media Worker configurado.'
      : comfyUrl
        ? 'ComfyUI configurado. Para geração por prompt sem workflow manual, configure também ALTIV_MEDIA_WORKER_URL.'
        : 'Configure ALTIV_MEDIA_WORKER_URL ou COMFYUI_BASE_URL.',
  }
}

export async function generateMedia(input: MediaJobRequest): Promise<MediaJobResult> {
  const prompt = input.prompt.trim()
  if (!prompt) throw new Error('Informe um prompt para gerar a mídia.')

  const workerPath = input.kind === 'image' ? '/v1/images/generate' : '/v1/videos/generate'
  const worker = await workerRequest(workerPath, {
    prompt,
    projectId: input.projectId,
    referenceImageUrl: input.referenceImageUrl,
    width: input.width,
    height: input.height,
    durationSeconds: input.durationSeconds,
  })

  if (worker) {
    return {
      ok: true,
      provider: 'altiv-worker',
      jobId: worker.jobId ?? worker.id,
      status: worker.status ?? 'queued',
      outputUrl: worker.outputUrl ?? worker.url,
      outputs: worker.outputs,
    }
  }

  if (input.workflow) {
    const comfy = await comfyPrompt(input.workflow)
    if (comfy) {
      return {
        ok: true,
        provider: 'comfyui',
        jobId: comfy.prompt_id,
        status: 'queued',
        outputs: comfy,
      }
    }
  }

  throw new Error(
    'Motor de mídia ainda não configurado. Defina ALTIV_MEDIA_WORKER_URL para geração por prompt ou COMFYUI_BASE_URL com um workflow.'
  )
}
