export type MediaOperation =
  | 'image-generate'
  | 'image-edit'
  | 'remove-background'
  | 'inpaint'
  | 'upscale'
  | 'face-restore'
  | 'video-generate'
  | 'video-interpolate'
  | 'transcribe'
  | 'tts'
  | 'music-generate'
  | 'generate-3d'

export type MediaProvider = {
  id: string
  label: string
  operations: MediaOperation[]
  integration: 'native-worker' | 'comfyui-node' | 'reference'
  repository: string
  notes: string
}

export const MEDIA_PROVIDERS: MediaProvider[] = [
  {
    id: 'comfyui',
    label: 'ComfyUI',
    operations: ['image-generate','image-edit','inpaint','upscale','video-generate','video-interpolate','music-generate'],
    integration: 'native-worker',
    repository: 'https://github.com/Comfy-Org/ComfyUI',
    notes: 'Motor visual principal; recomendado como backend de workflows.',
  },
  {
    id: 'comfy-agent-toolkit',
    label: 'ComfyUI Agent Toolkit',
    operations: ['image-generate','image-edit','video-generate'],
    integration: 'native-worker',
    repository: 'https://github.com/Zambav/ComfyUI-Agent-Toolkit',
    notes: 'Skills e automação de workflows em linguagem natural.',
  },
  {
    id: 'comfy-agent-kit',
    label: 'ComfyUI Agent Kit',
    operations: ['image-generate','image-edit','video-generate','music-generate'],
    integration: 'native-worker',
    repository: 'https://github.com/SlavaSexton/ComfyUI-Agent-Kit',
    notes: 'Receitas, templates e integração com agentes/MCP.',
  },
  {
    id: 'wan',
    label: 'Wan Video',
    operations: ['video-generate'],
    integration: 'comfyui-node',
    repository: 'https://github.com/Wan-Video/Wan2.1',
    notes: 'Texto/imagem para vídeo; pesos/modelos têm licenças próprias.',
  },
  {
    id: 'wan-wrapper',
    label: 'ComfyUI WanVideoWrapper',
    operations: ['video-generate'],
    integration: 'comfyui-node',
    repository: 'https://github.com/kijai/ComfyUI-WanVideoWrapper',
    notes: 'Integra Wan ao ComfyUI.',
  },
  {
    id: 'frame-interpolation',
    label: 'ComfyUI Frame Interpolation',
    operations: ['video-interpolate'],
    integration: 'comfyui-node',
    repository: 'https://github.com/Fannovel16/ComfyUI-Frame-Interpolation',
    notes: 'Interpolação de frames para suavizar vídeo.',
  },
  {
    id: 'animatediff',
    label: 'AnimateDiff Evolved',
    operations: ['video-generate'],
    integration: 'comfyui-node',
    repository: 'https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved',
    notes: 'Animação via Stable Diffusion/SDXL.',
  },
  {
    id: 'iopaint',
    label: 'IOPaint',
    operations: ['image-edit','inpaint'],
    integration: 'native-worker',
    repository: 'https://github.com/Sanster/IOPaint',
    notes: 'Inpainting/outpainting e remoção/substituição de objetos.',
  },
  {
    id: 'realesrgan',
    label: 'Real-ESRGAN',
    operations: ['upscale'],
    integration: 'native-worker',
    repository: 'https://github.com/xinntao/Real-ESRGAN',
    notes: 'Upscale e melhoria de resolução.',
  },
  {
    id: 'gfpgan',
    label: 'GFPGAN',
    operations: ['face-restore'],
    integration: 'native-worker',
    repository: 'https://github.com/TencentARC/GFPGAN',
    notes: 'Restauração facial.',
  },
  {
    id: 'rembg',
    label: 'rembg',
    operations: ['remove-background'],
    integration: 'native-worker',
    repository: 'https://github.com/danielgatis/rembg',
    notes: 'Remoção de fundo.',
  },
  {
    id: 'whispercpp',
    label: 'whisper.cpp',
    operations: ['transcribe'],
    integration: 'native-worker',
    repository: 'https://github.com/ggml-org/whisper.cpp',
    notes: 'Transcrição local de áudio.',
  },
  {
    id: 'openvoice',
    label: 'OpenVoice',
    operations: ['tts'],
    integration: 'native-worker',
    repository: 'https://github.com/myshell-ai/OpenVoice',
    notes: 'Síntese/clonagem de voz; verificar licença de modelos usados.',
  },
  {
    id: 'audiocraft',
    label: 'AudioCraft / MusicGen',
    operations: ['music-generate'],
    integration: 'native-worker',
    repository: 'https://github.com/facebookresearch/audiocraft',
    notes: 'Geração de música/áudio; licenças de pesos podem diferir do código.',
  },
  {
    id: 'trellis',
    label: 'TRELLIS',
    operations: ['generate-3d'],
    integration: 'native-worker',
    repository: 'https://github.com/microsoft/TRELLIS',
    notes: 'Geração 3D; uso condicionado à licença do repositório/modelos.',
  },
  {
    id: 'instantmesh',
    label: 'InstantMesh',
    operations: ['generate-3d'],
    integration: 'native-worker',
    repository: 'https://github.com/TencentARC/InstantMesh',
    notes: 'Reconstrução/geração 3D a partir de imagem.',
  },
]

export function providersForOperation(operation: MediaOperation) {
  return MEDIA_PROVIDERS.filter((provider) => provider.operations.includes(operation))
}
