export type RuntimeKind = 'static' | 'next' | 'vite' | 'react' | 'vue' | 'svelte' | 'astro' | 'unknown'

export type RuntimeInfo = {
  kind: RuntimeKind
  label: string
  previewMode: 'static' | 'runtime'
  entry?: string
  reason: string
}

type FileLike = { path:string; content?:string }

function has(files:FileLike[], pattern:RegExp) {
  return files.some((file)=>pattern.test(file.path))
}

function packageJson(files:FileLike[]) {
  const file = files.find((item)=>item.path === 'package.json')
  if (!file?.content) return null
  try { return JSON.parse(file.content) as Record<string,unknown> } catch { return null }
}

export function detectProjectRuntime(files:FileLike[]):RuntimeInfo {
  const pkg = packageJson(files)
  const deps = JSON.stringify({
    ...((pkg?.dependencies as Record<string,unknown> | undefined) ?? {}),
    ...((pkg?.devDependencies as Record<string,unknown> | undefined) ?? {}),
  })

  if (has(files,/^(next\.config\.|app\/.*\.(tsx|jsx)|pages\/.*\.(tsx|jsx))/i) || /"next"/.test(deps)) {
    return { kind:'next', label:'Next.js', previewMode:'runtime', reason:'Projeto Next.js requer build/runtime para preview fiel.' }
  }
  if (has(files,/astro\.config\./i) || /"astro"/.test(deps)) {
    return { kind:'astro', label:'Astro', previewMode:'runtime', reason:'Projeto Astro requer build/runtime.' }
  }
  if (has(files,/svelte\.config\./i) || /"svelte"/.test(deps)) {
    return { kind:'svelte', label:'Svelte', previewMode:'runtime', reason:'Projeto Svelte requer build/runtime.' }
  }
  if (has(files,/vite\.config\./i) || /"vite"/.test(deps)) {
    const label = /"vue"/.test(deps) ? 'Vue + Vite' : /"react"/.test(deps) ? 'React + Vite' : 'Vite'
    return { kind:'vite', label, previewMode:'runtime', reason:'Projeto Vite requer dev/build runtime para preview fiel.' }
  }
  if (/"react"/.test(deps) || has(files,/src\/.*\.(jsx|tsx)$/i)) {
    return { kind:'react', label:'React', previewMode:'runtime', reason:'Projeto React requer runtime/bundle.' }
  }
  if (has(files,/\.vue$/i) || /"vue"/.test(deps)) {
    return { kind:'vue', label:'Vue', previewMode:'runtime', reason:'Projeto Vue requer runtime/bundle.' }
  }

  const entry = files.find((file)=>file.path === 'index.html')?.path
    ?? files.find((file)=>/\.html$/i.test(file.path))?.path
  if (entry) return { kind:'static', label:'HTML estático', previewMode:'static', entry, reason:'Preview direto no navegador disponível.' }

  return { kind:'unknown', label:'Projeto', previewMode:'runtime', reason:'Stack não identificada; requer runtime isolado para preview.' }
}
