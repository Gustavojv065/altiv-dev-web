import { selectAltivSkills } from '@/lib/agent/skills'
import type { ProjectFileInfo } from '@/lib/agent/file-intelligence'

export type AgentRole =
  | 'orchestrator'
  | 'designer'
  | 'frontend'
  | 'backend'
  | 'github'
  | 'media'
  | 'qa'

export type OrchestrationPlan = {
  intent: 'create' | 'edit' | 'debug' | 'design' | 'media' | 'git' | 'review'
  roles: AgentRole[]
  skills: Array<{ id:string; label:string }>
  needsMedia: boolean
  mediaKinds: Array<'image' | 'video' | 'audio' | '3d'>
  requiresVisualVerification: boolean
  requiresRepositoryAnalysis: boolean
  requestedPalette: string[]
  checkpoints: string[]
}

function unique<T>(items:T[]) {
  return Array.from(new Set(items))
}

function requestedPalette(prompt:string) {
  const text = prompt.toLowerCase()
  const palette:string[] = []
  const colors:Array<[RegExp,string]> = [
    [/azul|blue/i,'azul'],
    [/branc[oa]|white/i,'branco'],
    [/pret[oa]|black/i,'preto'],
    [/dourad[oa]|gold/i,'dourado'],
    [/vermelh[oa]|red/i,'vermelho'],
    [/verd[ea]|green/i,'verde'],
    [/rox[oa]|purple|violet/i,'roxo'],
    [/cinza|gray|grey/i,'cinza'],
    [/bege|beige/i,'bege'],
  ]
  for (const [pattern,label] of colors) if (pattern.test(text)) palette.push(label)
  return unique(palette)
}

export function orchestrateRequest(prompt:string, files:ProjectFileInfo[] = []):OrchestrationPlan {
  const text = prompt.toLowerCase()
  const roles:AgentRole[] = ['orchestrator']
  const mediaKinds:OrchestrationPlan['mediaKinds'] = []

  const isCreate = /(crie|criar|novo site|do zero|landing page nova|construa)/i.test(text)
  const isDebug = /(erro|bug|falh|quebr|corrig|não funciona|nao funciona)/i.test(text)
  const isGit = /(github|repositório|repositorio|commit|push|pull request|branch|merge)/i.test(text)
  const isReview = /(revis|auditor|qa|qualidade|verifique|teste)/i.test(text)
  const isDesign = /(cor|paleta|tema|visual|design|layout|fonte|tipografia|claro|escuro|moderno|premium|bonito|responsiv)/i.test(text)
  const wantsImage = /(imagem|foto|fotografia|hero image|banner|logo|ilustração|ilustracao)/i.test(text)
  const wantsVideo = /(vídeo|video|reel|animação em vídeo|animacao em video)/i.test(text)
  const wantsAudio = /(áudio|audio|voz|música|musica|narração|narracao)/i.test(text)
  const wants3d = /(3d|modelo 3d|objeto 3d)/i.test(text)

  if (isDesign || isCreate) roles.push('designer','frontend')
  if (isDebug) roles.push('frontend','backend','qa')
  if (isGit) roles.push('github')
  if (isReview) roles.push('qa')
  if (wantsImage || wantsVideo || wantsAudio || wants3d) roles.push('media','frontend')
  if (!roles.includes('frontend') && files.some((file)=>/\.(html|css|js|jsx|ts|tsx|vue|svelte|astro)$/i.test(file.path))) roles.push('frontend')

  if (wantsImage) mediaKinds.push('image')
  if (wantsVideo) mediaKinds.push('video')
  if (wantsAudio) mediaKinds.push('audio')
  if (wants3d) mediaKinds.push('3d')

  const intent:OrchestrationPlan['intent'] =
    isGit ? 'git' :
    isDebug ? 'debug' :
    (wantsImage || wantsVideo || wantsAudio || wants3d) && !isDesign && !isCreate ? 'media' :
    isReview ? 'review' :
    isCreate ? 'create' :
    isDesign ? 'design' : 'edit'

  const requiresVisualVerification = isDesign || isCreate || wantsImage || wantsVideo
  const skills = selectAltivSkills(prompt, 10).map((skill)=>({ id:skill.id, label:skill.label }))

  const checkpoints = [
    'entender o pedido e preservar o que não deve mudar',
    'ler os arquivos relevantes antes de editar',
    ...(requiresVisualVerification ? ['comparar o resultado visual com o pedido antes de concluir'] : []),
    ...(mediaKinds.length ? ['confirmar que os assets gerados foram salvos e carregam no preview'] : []),
    'validar responsividade e regressões relacionadas',
    'só declarar concluído quando houver alteração verificável',
  ]

  return {
    intent,
    roles:unique(roles),
    skills,
    needsMedia:mediaKinds.length > 0,
    mediaKinds:unique(mediaKinds),
    requiresVisualVerification,
    requiresRepositoryAnalysis:true,
    requestedPalette:requestedPalette(prompt),
    checkpoints,
  }
}

export function orchestrationInstructions(plan:OrchestrationPlan) {
  return [
    'ORQUESTRAÇÃO ALTIV',
    'Intenção: ' + plan.intent,
    'Agentes: ' + plan.roles.join(' → '),
    'Skills: ' + plan.skills.map((skill)=>skill.label).join(', '),
    plan.requestedPalette.length ? 'Paleta pedida: ' + plan.requestedPalette.join(', ') : '',
    plan.needsMedia ? 'Mídia requerida: ' + plan.mediaKinds.join(', ') : '',
    'Checkpoints:',
    ...plan.checkpoints.map((item)=>'- ' + item),
  ].filter(Boolean).join('\n')
}
