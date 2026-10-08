export type ProjectFileInfo = {
  path: string
  content: string
  revision: number
  language: string
}

export type FilePlan = {
  mode: 'targeted' | 'full'
  targets: string[]
  reason: string
}

const SOURCE_EXTENSIONS = /\.(html|css|scss|sass|less|js|jsx|ts|tsx|vue|svelte|astro)$/i
const STYLE_EXTENSIONS = /\.(css|scss|sass|less)$/i
const UI_EXTENSIONS = /\.(html|jsx|tsx|vue|svelte|astro)$/i
const SCRIPT_EXTENSIONS = /\.(js|jsx|ts|tsx)$/i

function uniqueTargets(items: string[]): string[] {
  return Array.from(new Set(items))
}

function scorePath(path:string, patterns:RegExp[]) {
  let score = 0
  for (const pattern of patterns) if (pattern.test(path)) score += 10
  if (/^(app|src|pages|components)\//i.test(path)) score += 3
  if (/(index|page|home|landing|app)\.(html|jsx|tsx|vue|svelte|astro)$/i.test(path)) score += 8
  if (/(global|globals|style|styles|theme|app)\.(css|scss|sass|less)$/i.test(path)) score += 8
  return score
}

function topFiles(files:ProjectFileInfo[], predicate:(file:ProjectFileInfo)=>boolean, patterns:RegExp[], limit:number) {
  return files
    .filter(predicate)
    .map((file)=>({ path:file.path, score:scorePath(file.path,patterns) }))
    .sort((a,b)=>b.score-a.score || a.path.localeCompare(b.path))
    .slice(0,limit)
    .map((item)=>item.path)
}

export function planFileTargets(prompt: string, files: ProjectFileInfo[]): FilePlan {
  const text = prompt.toLowerCase()
  const sourceFiles = files.filter((file)=>SOURCE_EXTENSIONS.test(file.path))
  const hasSite = sourceFiles.length > 0
  const broad = /(crie|criar|novo site|do zero|landing page nova|refaça tudo|refazer tudo|revisão completa|revisao completa|redesign completo)/i.test(text)

  if (!hasSite) {
    return { mode:'full', targets:[], reason:'Projeto sem arquivos web editáveis detectados' }
  }

  if (broad) {
    const targets = uniqueTargets([
      ...topFiles(sourceFiles,(file)=>UI_EXTENSIONS.test(file.path),[/page|home|index|landing|app|layout/i],5),
      ...topFiles(sourceFiles,(file)=>STYLE_EXTENSIONS.test(file.path),[/global|style|theme|app/i],3),
    ]).slice(0,8)
    return { mode:'full', targets, reason:'Criação ou reconstrução ampla do projeto' }
  }

  const targets:string[] = []
  const styleIntent = /(cor|paleta|tema|claro|clarear|azul|branco|preto|dourado|fonte|tipografia|espaçamento|layout|visual|design|responsiv|mobile|desktop|tablet|card|sombra|gradiente|css|estilo)/i.test(text)
  const structureIntent = /(texto|conteúdo|titulo|título|seção|secao|header|cabeçalho|footer|rodapé|menu|link|cta|formulário|formulario|imagem|estrutura|html|seo|meta|hero)/i.test(text)
  const scriptIntent = /(javascript|script|interação|interacao|animação|animacao|clique|modal|carrossel|slider|menu mobile|evento|contador)/i.test(text)
  const broadDesign = /(melhorar|redesign|profissional|premium|modernizar|bonito|mais claro|mais escuro)/i.test(text)

  if (styleIntent) {
    targets.push(...topFiles(sourceFiles,(file)=>STYLE_EXTENSIONS.test(file.path),[/global|style|theme|app/i],3))
    // Muitos projetos guardam cores inline em componentes/páginas.
    targets.push(...topFiles(sourceFiles,(file)=>UI_EXTENSIONS.test(file.path),[/page|home|index|landing|app|layout|hero/i],3))
  }

  if (structureIntent || broadDesign) {
    targets.push(...topFiles(sourceFiles,(file)=>UI_EXTENSIONS.test(file.path),[/page|home|index|landing|app|layout/i],4))
  }

  if (scriptIntent) {
    targets.push(...topFiles(sourceFiles,(file)=>SCRIPT_EXTENSIONS.test(file.path),[/page|app|main|script|component/i],3))
  }

  if (!targets.length) {
    targets.push(...topFiles(sourceFiles,()=>true,[/page|home|index|app|main/i],4))
  }

  const selected = uniqueTargets(targets).slice(0,8)
  return {
    mode:'targeted',
    targets:selected,
    reason:selected.length === 1
      ? 'Alteração concentrada em ' + selected[0]
      : 'Alteração coordenada em ' + selected.join(', '),
  }
}

export function buildProjectMap(files: ProjectFileInfo[]): string {
  return files
    .map((file) => '- ' + file.path + ' [' + file.language + '] r' + file.revision + ' (' + file.content.length + ' chars)')
    .join('\n')
}
