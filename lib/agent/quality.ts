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
