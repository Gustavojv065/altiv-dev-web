export type ProjectFileInfo = {
  path: string
  content: string
  revision: number
  language: string
}

export type FilePlan = {
  mode: 'targeted' | 'full'
  targets: Array<'index.html' | 'styles.css' | 'script.js'>
  reason: string
}

const ALL_FILES: FilePlan['targets'] = ['index.html', 'styles.css', 'script.js']

function uniqueTargets(items: FilePlan['targets']): FilePlan['targets'] {
  return Array.from(new Set(items))
}

export function planFileTargets(prompt: string, files: ProjectFileInfo[]): FilePlan {
  const text = prompt.toLowerCase()
  const hasSite = files.some((file) => file.path === 'index.html' && file.content.trim().length > 100)

  if (!hasSite || /(crie|criar|novo site|do zero|landing page nova|refaça tudo|refazer tudo)/i.test(text)) {
    return { mode: 'full', targets: ALL_FILES, reason: 'Criação ou reconstrução ampla do projeto' }
  }

  const targets: FilePlan['targets'] = []

  if (/(cor|paleta|fonte|tipografia|espaçamento|layout|visual|design|responsiv|mobile|desktop|tablet|card|sombra|gradiente|css|estilo)/i.test(text)) {
    targets.push('styles.css')
  }

  if (/(texto|conteúdo|titulo|título|seção|secao|header|cabeçalho|footer|rodapé|menu|link|cta|formulário|formulario|imagem|estrutura|html|seo|meta)/i.test(text)) {
    targets.push('index.html')
  }

  if (/(javascript|script|interação|interacao|animação|animacao|clique|modal|carrossel|slider|menu mobile|formulário funciona|formulario funciona|evento|contador)/i.test(text)) {
    targets.push('script.js')
  }

  if (/(melhorar|redesign|profissional|premium|modernizar|revisão completa|revisao completa)/i.test(text)) {
    targets.push('index.html', 'styles.css')
  }

  const selected = uniqueTargets(targets)
  if (!selected.length) selected.push('index.html')

  return {
    mode: 'targeted',
    targets: selected,
    reason: selected.length === 1
      ? 'Alteração concentrada em ' + selected[0]
      : 'Alteração coordenada em ' + selected.join(', '),
  }
}

export function buildProjectMap(files: ProjectFileInfo[]): string {
  return files
    .map((file) => '- ' + file.path + ' [' + file.language + '] r' + file.revision + ' (' + file.content.length + ' chars)')
    .join('\n')
}
