export type SiteFile = { path: string; content: string }

function injectBefore(html:string, closing:string, payload:string) {
  return html.includes(closing) ? html.replace(closing, payload + closing) : html + payload
}

function normalizeEntry(files:SiteFile[], requested?:string) {
  const byPath = new Map(files.map((file)=>[file.path,file.content]))
  const candidates = [
    requested,
    'index.html',
    'public/index.html',
    'src/index.html',
  ].filter(Boolean) as string[]
  for (const candidate of candidates) {
    if (byPath.has(candidate)) return candidate
  }
  return files.find((file)=>/\.html$/i.test(file.path))?.path ?? ''
}

export function previewEntries(files:SiteFile[]) {
  return files
    .filter((file)=>/\.html$/i.test(file.path))
    .map((file)=>file.path)
    .sort((a,b)=>a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b))
}

export function renderStaticSite(files: SiteFile[], entryPath?:string): string {
  const byPath = new Map(files.map((file) => [file.path, file.content]))
  const entry = normalizeEntry(files, entryPath)
  let html = entry ? (byPath.get(entry) ?? '') : ''
  if (!html) return ''

  const dir = entry.includes('/') ? entry.slice(0,entry.lastIndexOf('/') + 1) : ''
  const cssCandidates = [
    dir + 'styles.css',
    dir + 'style.css',
    'styles.css',
    'style.css',
    'src/styles.css',
    'src/app.css',
    'app/styles.css',
  ]
  const jsCandidates = [
    dir + 'script.js',
    dir + 'main.js',
    'script.js',
    'main.js',
    'src/main.js',
  ]

  const css = cssCandidates.map((path)=>byPath.get(path)).find(Boolean) ?? ''
  const js = jsCandidates.map((path)=>byPath.get(path)).find(Boolean) ?? ''

  if (css) {
    const safeCss = css.replace(/<\/style/gi, '<\\/style')
    html = injectBefore(html, '</head>', '<style data-altiv="preview-css">' + safeCss + '</style>')
  }

  if (js) {
    const safeJs = js.replace(/<\/script/gi, '<\\/script')
    html = injectBefore(html, '</body>', '<script data-altiv="preview-js">' + safeJs + '</script>')
  }

  return html
}
