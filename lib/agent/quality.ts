export type QualityReport = {
  score: number
  issues: string[]
  checks: Record<string, boolean>
}

export function analyzeHtmlQuality(html: string): QualityReport {
  const text = html.toLowerCase()
  const issues: string[] = []
  const checks: Record<string, boolean> = {}

  function check(name: string, ok: boolean, issue: string, penalty: number) {
    checks[name] = ok
    if (!ok) issues.push(issue + ' (-' + penalty + ')')
    return ok ? 0 : penalty
  }

  let penalty = 0

  penalty += check('doctype', /<!doctype html>/i.test(html), 'Falta <!doctype html>', 4)
  penalty += check('lang', /<html[^>]+lang=/i.test(html), 'Defina o idioma do documento', 3)
  penalty += check('viewport', /name=["']viewport["']/i.test(html), 'Falta viewport responsivo', 8)
  penalty += check('title', /<title>[^<]{3,}</title>/i.test(html), 'Título da página ausente ou fraco', 4)
  penalty += check('description', /name=["']description["']/i.test(html), 'Falta meta description', 4)
  penalty += check('header', /<header[s>]/i.test(html), 'Falta header semântico', 4)
  penalty += check('main', /<main[s>]/i.test(html), 'Falta conteúdo principal semântico', 4)
  penalty += check('footer', /<footer[s>]/i.test(html), 'Falta footer semântico', 3)
  penalty += check('h1', (html.match(/<h1[s>]/gi) ?? []).length === 1, 'Use exatamente um H1 principal', 5)
  penalty += check('sections', (html.match(/<section[s>]/gi) ?? []).length >= 4, 'Poucas seções para uma página comercial completa', 6)
  penalty += check('cta', /(whatsapp|agendar|contato|fale conosco|começar|solicitar|reservar|comprar)/i.test(html), 'CTA comercial pouco claro', 5)
  penalty += check('responsiveCss', /@medias*(/i.test(html), 'Faltam breakpoints responsivos', 10)
  penalty += check('focus', /:focus|:focus-visible/i.test(html), 'Faltam estados de foco acessíveis', 5)
  penalty += check('hover', /:hover/i.test(html), 'Faltam microinterações/hover', 3)
  penalty += check('cssVars', /:roots*{[sS]*--[a-z0-9-]+:/i.test(html), 'Use tokens CSS para consistência visual', 4)
  penalty += check('buttonsLinks', /<a[^>]+href=/i.test(html), 'Links/ações não parecem funcionais', 4)
  penalty += check('mobileWidth', /max-widths*:s*(?:480|520|600|640|768)px/i.test(html), 'Inclua ajustes específicos para telas pequenas', 5)

  const darkHexMatches = text.match(/#[0-1][0-9a-f][0-9a-f][0-1][0-9a-f][0-9a-f]/g) ?? []
  const lightHexMatches = text.match(/#f[0-9a-f]{5}|#e[8-9a-f][0-9a-f]{4}|#fff(?:fff)?/g) ?? []
  const tonalVariety = darkHexMatches.length === 0 || lightHexMatches.length > 0
  penalty += check('tonalVariety', tonalVariety, 'Página excessivamente escura sem contraste tonal', 8)

  const emojiCount = (html.match(/[🌀-🫿]/gu) ?? []).length
  penalty += check('limitedEmoji', emojiCount <= 3, 'Excesso de emojis deixa o design menos profissional', 4)

  const inlineStyleCount = (html.match(/sstyle=/gi) ?? []).length
  penalty += check('limitedInlineStyles', inlineStyleCount <= 8, 'Muitos estilos inline dificultam consistência e manutenção', 3)

  const score = Math.max(0, Math.min(100, 100 - penalty))
  return { score, issues, checks }
}
