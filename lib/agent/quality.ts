import type { NicheProfile } from '@/lib/agent/niche'

export type QualityReport = {
  score: number
  issues: string[]
  checks: Record<string, boolean>
}

export function analyzeHtmlQuality(html: string): QualityReport {
  const issues: string[] = []
  const checks: Record<string, boolean> = {}

  function check(name: string, ok: boolean, issue: string, penalty: number): number {
    checks[name] = ok
    if (!ok) issues.push(issue)
    return ok ? 0 : penalty
  }

  let penalty = 0
  penalty += check('doctype', /<!doctype html>/i.test(html), 'DOCTYPE HTML ausente', 4)
  penalty += check('lang', /<html[^>]+lang=/i.test(html), 'Idioma da página ausente', 3)
  penalty += check('viewport', /name=["']viewport["']/i.test(html), 'Falta viewport responsivo', 8)
  penalty += check('title', /<title[^>]*>[^<]{3,}<\/title>/i.test(html), 'Título da página ausente', 4)
  penalty += check('description', /name=["']description["']/i.test(html), 'Falta meta description', 4)
  penalty += check('header', /<header[\s>]/i.test(html), 'Falta header semântico', 4)
  penalty += check('main', /<main[\s>]/i.test(html), 'Falta main semântico', 4)
  penalty += check('footer', /<footer[\s>]/i.test(html), 'Falta footer semântico', 3)
  penalty += check('h1', (html.match(/<h1[\s>]/gi) ?? []).length === 1, 'Use um único H1 principal', 5)
  penalty += check('sections', (html.match(/<section[\s>]/gi) ?? []).length >= 4, 'Poucas seções na página comercial', 6)
  penalty += check('cta', /(whatsapp|agendar|contato|começar|solicitar|reservar|comprar)/i.test(html), 'CTA pouco claro', 5)
  penalty += check('responsiveCss', /@media\s*\(/i.test(html), 'Faltam breakpoints responsivos', 10)
  penalty += check('focus', /:focus(?:-visible)?/i.test(html), 'Faltam estilos de foco acessíveis', 5)
  penalty += check('hover', /:hover/i.test(html), 'Faltam estados hover', 3)
  penalty += check('cssVars', /--[a-z][a-z0-9-]*\s*:/i.test(html), 'Faltam tokens CSS', 4)
  penalty += check('buttonsLinks', /<a[^>]+href=/i.test(html), 'Não foram encontrados links funcionais', 4)
  penalty += check('mobileWidth', /max-width\s*:\s*(?:480|520|600|640|768)px/i.test(html), 'Faltam regras de layout mobile', 5)

  const colors = (html.toLowerCase().match(/#[0-9a-f]{6}/g) ?? []).slice(0, 200)
  const nearBlack = colors.filter((color) => Number.parseInt(color.slice(1), 16) < 0x252525).length
  const light = colors.filter((color) => Number.parseInt(color.slice(1), 16) > 0xe0d9c9).length
  penalty += check('tonalVariety', nearBlack < 3 || light > 0, 'Confira contraste entre seções claras e escuras', 8)

  const inlineStyles = (html.match(/\sstyle=/gi) ?? []).length
  penalty += check('limitedInlineStyles', inlineStyles <= 8, 'Evite excesso de estilos inline', 3)

  return { score: Math.max(0, Math.min(100, 100 - penalty)), issues, checks }
}


export type RequestAlignmentReport = {
  score:number
  issues:string[]
  checks:Record<string,boolean>
}

function countMatches(text:string, pattern:RegExp) {
  return (text.match(pattern) ?? []).length
}

export function analyzeRequestAlignment(
  html:string,
  prompt:string,
  niche:NicheProfile,
  mediaJobs:Array<{kind:string;status?:string;outputUrl?:string}> = []
):RequestAlignmentReport {
  const issues:string[]=[]
  const checks:Record<string,boolean>={}
  let penalty=0

  function check(name:string, ok:boolean, issue:string, weight:number) {
    checks[name]=ok
    if (!ok) {
      issues.push(issue)
      penalty += weight
    }
  }

  const lower=html.toLowerCase()
  const promptLower=prompt.toLowerCase()
  const textOnly=lower.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ')
  const wantsImage=/(imagem|imagens|foto|fotos|galeria|fotografia)/i.test(promptLower)
  const wantsVideo=/(vídeo|video|reel|clipe)/i.test(promptLower)

  const imageCount=countMatches(lower,/<img\b/gi) + countMatches(lower,/background-image\s*:/gi)
  const videoCount=countMatches(lower,/<video[^>]+src=["'][^"']+["']/gi) + countMatches(lower,/<source[^>]+src=["'][^"']+["']/gi) + countMatches(lower,/<iframe[^>]+(?:youtube|vimeo)/gi)
  const hasHero=/(class=["'][^"']*hero|id=["']hero|<section[^>]*>[^<]*(?:<[^>]+>)*[^<]*(?:agendar|explorar|saiba mais))/i.test(lower)
  const heroVisual=/(hero[\s\S]{0,5000}(<img\b|<video\b|background-image\s*:))/i.test(lower)
  const ctaCount=countMatches(lower,/(agendar|reservar|whatsapp|explorar serviços|explorar servicos|fale conosco|entrar em contato)/gi)

  check('niche-specific', niche.id === 'generic' || niche.preferredContent.some((item)=>textOnly.includes(item.toLowerCase())),
    'O conteúdo ainda está genérico e pouco específico para '+niche.label+'.', 18)

  const forbiddenHits=niche.forbiddenContent.filter((item)=>textOnly.includes(item.toLowerCase()))
  check('niche-consistency', forbiddenHits.length === 0,
    'Conteúdo fora do nicho encontrado: '+forbiddenHits.join(', ')+'.', 28)

  check('hero-structure', hasHero, 'O topo precisa de um hero claro com proposta de valor e CTA.', 12)
  check('hero-visual', !wantsImage || heroVisual, 'O hero está visualmente fraco; use imagem/vídeo coerente em destaque.', 14)
  check('cta-strength', ctaCount >= 2, 'Poucos CTAs claros para uma página comercial.', 8)
  check('image-request', !wantsImage || imageCount >= 3, 'O pedido solicitou imagens, mas há poucas imagens integradas ao layout.', 14)

  const successfulVideoJob=mediaJobs.some((job)=>job.kind==='video' && Boolean(job.outputUrl) && job.status !== 'failed')
  check('video-request', !wantsVideo || videoCount > 0 || successfulVideoJob,
    'O pedido solicitou vídeo, mas nenhum vídeo real foi inserido ou retornado pelo motor de mídia.', 18)

  const looksVerySparse = html.length < 8000 || (imageCount === 0 && countMatches(lower,/<section\b/gi) < 5)
  check('content-density', !looksVerySparse,
    'A página está simples ou vazia demais para o nível premium solicitado.', 12)

  return { score:Math.max(0,Math.min(100,100-penalty)), issues, checks }
}
