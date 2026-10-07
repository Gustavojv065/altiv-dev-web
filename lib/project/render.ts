export type SiteFile = { path: string; content: string }

export function renderStaticSite(files: SiteFile[]): string {
  const byPath = new Map(files.map((file) => [file.path, file.content]))
  let html = byPath.get('index.html') ?? ''
  if (!html) return ''

  const css = byPath.get('styles.css') ?? ''
  const js = byPath.get('script.js') ?? ''

  if (css && html.includes('</head>')) {
    const safeCss = css.replace(/<\/style/gi, '<\\/style')
    html = html.replace('</head>', '<style data-altiv="styles.css">' + safeCss + '</style></head>')
  }

  if (js && html.includes('</body>')) {
    const safeJs = js.replace(/<\/script/gi, '<\\/script')
    html = html.replace('</body>', '<script data-altiv="script.js">' + safeJs + '</script></body>')
  }

  return html
}
