'use client'

import { FormEvent, useEffect, useState } from 'react'

type Kind = 'image' | 'video'
type Status = {
  configured: boolean
  worker: boolean
  comfyui: boolean
  image: boolean
  video: boolean
  note: string
}

export default function MediaStudioClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [kind, setKind] = useState<Kind>('image')
  const [prompt, setPrompt] = useState('')
  const [referenceImageUrl, setReferenceImageUrl] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(5)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [result, setResult] = useState<any>(null)

  useEffect(() => {
    fetch('/api/media/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!prompt.trim() || running) return
    setRunning(true)
    setResult(null)
    try {
      const response = await fetch(kind === 'image' ? '/api/media/generate-image' : '/api/media/generate-video', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          prompt,
          projectId,
          referenceImageUrl: referenceImageUrl || undefined,
          durationSeconds: kind === 'video' ? durationSeconds : undefined,
        }),
      })
      setResult(await response.json())
    } catch {
      setResult({ ok: false, error: 'Falha de rede ao chamar o motor de mídia.' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <main style={{minHeight:'100vh',background:'#0b0d12',color:'#f5f7fb',padding:'28px'}}>
      <div style={{maxWidth:1100,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',marginBottom:24}}>
          <div>
            <div style={{fontSize:13,opacity:.65}}>ALTIV DEV · {projectName}</div>
            <h1 style={{margin:'6px 0 0'}}>AI Media Studio</h1>
          </div>
          <a href={'/studio/' + projectId} style={{color:'inherit',textDecoration:'none',border:'1px solid #2b3240',padding:'10px 14px',borderRadius:12}}>← Voltar ao Studio</a>
        </div>

        <section style={{border:'1px solid #232a36',borderRadius:18,padding:18,background:'#11151d',marginBottom:18}}>
          <strong>Status do motor</strong>
          <p style={{marginBottom:0,opacity:.8}}>
            {status ? status.note : 'Verificando configuração…'}
          </p>
        </section>

        <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) minmax(300px,.8fr)',gap:18}}>
          <form onSubmit={submit} style={{border:'1px solid #232a36',borderRadius:18,padding:20,background:'#11151d'}}>
            <div style={{display:'flex',gap:8,marginBottom:18}}>
              <button type="button" onClick={() => setKind('image')} style={{padding:'10px 14px',borderRadius:12,border:'1px solid #30394a',background:kind==='image'?'#fff':'transparent',color:kind==='image'?'#111':'#fff'}}>Imagem</button>
              <button type="button" onClick={() => setKind('video')} style={{padding:'10px 14px',borderRadius:12,border:'1px solid #30394a',background:kind==='video'?'#fff':'transparent',color:kind==='video'?'#111':'#fff'}}>Vídeo</button>
            </div>

            <label style={{display:'block',fontWeight:600,marginBottom:8}}>Descreva o que deseja gerar</label>
            <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)} placeholder={kind==='image'?'Ex.: hero premium para site de arquitetura, iluminação cinematográfica…':'Ex.: vídeo de 5 segundos para hero de um site premium…'} style={{width:'100%',minHeight:160,resize:'vertical',boxSizing:'border-box',borderRadius:14,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:14}} />

            <label style={{display:'block',fontWeight:600,margin:'16px 0 8px'}}>Imagem de referência (URL, opcional)</label>
            <input value={referenceImageUrl} onChange={(e)=>setReferenceImageUrl(e.target.value)} placeholder="https://…" style={{width:'100%',boxSizing:'border-box',borderRadius:12,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:12}} />

            {kind === 'video' && <>
              <label style={{display:'block',fontWeight:600,margin:'16px 0 8px'}}>Duração</label>
              <select value={durationSeconds} onChange={(e)=>setDurationSeconds(Number(e.target.value))} style={{borderRadius:12,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:12}}>
                <option value={5}>5 segundos</option>
                <option value={8}>8 segundos</option>
                <option value={10}>10 segundos</option>
              </select>
            </>}

            <button disabled={running || !prompt.trim()} style={{display:'block',width:'100%',marginTop:20,padding:'13px 16px',border:0,borderRadius:13,fontWeight:700}}>
              {running ? 'Gerando…' : kind === 'image' ? 'Gerar imagem' : 'Gerar vídeo'}
            </button>
          </form>

          <section style={{border:'1px solid #232a36',borderRadius:18,padding:20,background:'#11151d'}}>
            <h2 style={{marginTop:0}}>Resultado</h2>
            {!result && <p style={{opacity:.65}}>A mídia gerada e o status da fila aparecerão aqui.</p>}
            {result?.error && <p style={{color:'#ffb4b4'}}>{result.error}</p>}
            {result?.jobId && <p><strong>Job:</strong> {result.jobId}</p>}
            {result?.status && <p><strong>Status:</strong> {result.status}</p>}
            {result?.outputUrl && (
              kind === 'image'
                ? <img src={result.outputUrl} alt="Imagem gerada pela ALTIV" style={{width:'100%',borderRadius:14}} />
                : <video src={result.outputUrl} controls style={{width:'100%',borderRadius:14}} />
            )}
            {result?.ok && !result?.outputUrl && (
              <p style={{opacity:.8}}>Geração enviada para a fila. O worker retornou o job, mas ainda não informou a URL final.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
