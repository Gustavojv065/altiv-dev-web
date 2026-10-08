'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type Operation =
  | 'image-generate'
  | 'image-edit'
  | 'remove-background'
  | 'inpaint'
  | 'upscale'
  | 'face-restore'
  | 'video-generate'
  | 'video-interpolate'
  | 'transcribe'
  | 'tts'
  | 'music-generate'
  | 'generate-3d'

type Status = {
  configured: boolean
  worker: boolean
  comfyui: boolean
  image: boolean
  video: boolean
  note: string
}

const operations: Array<{ id:Operation; label:string; hint:string; needsPrompt?:boolean }> = [
  { id:'image-generate', label:'Gerar imagem', hint:'Texto → imagem profissional', needsPrompt:true },
  { id:'image-edit', label:'Editar imagem', hint:'Editar foto/imagem por instrução', needsPrompt:true },
  { id:'remove-background', label:'Remover fundo', hint:'Recorte automático de fundo' },
  { id:'inpaint', label:'Remover/Substituir objeto', hint:'Inpainting e outpainting', needsPrompt:true },
  { id:'upscale', label:'Melhorar resolução', hint:'Upscale com IA' },
  { id:'face-restore', label:'Restaurar rosto', hint:'Recuperação facial' },
  { id:'video-generate', label:'Gerar vídeo', hint:'Texto ou imagem → vídeo', needsPrompt:true },
  { id:'video-interpolate', label:'Suavizar vídeo', hint:'Aumentar FPS/interpolar frames' },
  { id:'transcribe', label:'Transcrever áudio', hint:'Áudio → texto' },
  { id:'tts', label:'Gerar voz', hint:'Texto → voz', needsPrompt:true },
  { id:'music-generate', label:'Gerar música', hint:'Prompt → trilha/áudio', needsPrompt:true },
  { id:'generate-3d', label:'Gerar 3D', hint:'Imagem/prompt → objeto 3D', needsPrompt:true },
]

export default function MediaStudioClient({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [operation, setOperation] = useState<Operation>('image-generate')
  const [prompt, setPrompt] = useState('')
  const [inputUrl, setInputUrl] = useState('')
  const [maskUrl, setMaskUrl] = useState('')
  const [durationSeconds, setDurationSeconds] = useState(5)
  const [running, setRunning] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const [result, setResult] = useState<any>(null)

  const selected = useMemo(() => operations.find((item) => item.id === operation)!, [operation])
  const isVideo = operation.startsWith('video-')
  const needsInput = !['image-generate','video-generate','tts','music-generate'].includes(operation)

  useEffect(() => {
    fetch('/api/media/status', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (selected.needsPrompt && !prompt.trim()) return
    if (needsInput && !inputUrl.trim()) {
      setResult({ ok:false, error:'Informe a URL do arquivo de entrada para esta operação.' })
      return
    }

    setRunning(true)
    setResult(null)
    try {
      const response = await fetch('/api/media/run', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({
          operation,
          prompt,
          projectId,
          inputUrl:inputUrl || undefined,
          referenceImageUrl:inputUrl || undefined,
          maskUrl:maskUrl || undefined,
          durationSeconds:isVideo ? durationSeconds : undefined,
        }),
      })
      setResult(await response.json())
    } catch {
      setResult({ ok:false, error:'Falha de rede ao chamar o motor de mídia.' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <main style={{minHeight:'100vh',background:'#0b0d12',color:'#f5f7fb',padding:'28px'}}>
      <div style={{maxWidth:1180,margin:'0 auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',gap:16,alignItems:'center',marginBottom:24,flexWrap:'wrap'}}>
          <div>
            <div style={{fontSize:13,opacity:.65}}>ALTIV DEV · {projectName}</div>
            <h1 style={{margin:'6px 0 0'}}>AI Media Studio</h1>
            <p style={{margin:'8px 0 0',opacity:.7}}>Imagem, vídeo, áudio, restauração e 3D em uma única área.</p>
          </div>
          <a href={'/studio/' + projectId} style={{color:'inherit',textDecoration:'none',border:'1px solid #2b3240',padding:'10px 14px',borderRadius:12}}>← Voltar ao Studio</a>
        </div>

        <section style={{border:'1px solid #232a36',borderRadius:18,padding:18,background:'#11151d',marginBottom:18}}>
          <strong>Status do motor</strong>
          <p style={{marginBottom:0,opacity:.8}}>{status ? status.note : 'Verificando configuração…'}</p>
        </section>

        <div style={{display:'grid',gridTemplateColumns:'280px minmax(0,1fr) minmax(300px,.85fr)',gap:18,alignItems:'start'}}>
          <aside style={{border:'1px solid #232a36',borderRadius:18,padding:12,background:'#11151d'}}>
            <strong style={{display:'block',padding:'8px 8px 12px'}}>Ferramentas</strong>
            <div style={{display:'grid',gap:8}}>
              {operations.map((item) => (
                <button key={item.id} type="button" onClick={() => { setOperation(item.id); setResult(null) }}
                  style={{textAlign:'left',padding:'12px',borderRadius:12,border:'1px solid #30394a',background:operation===item.id?'#fff':'#0c1017',color:operation===item.id?'#111':'#fff'}}>
                  <strong style={{display:'block'}}>{item.label}</strong>
                  <small style={{opacity:.65}}>{item.hint}</small>
                </button>
              ))}
            </div>
          </aside>

          <form onSubmit={submit} style={{border:'1px solid #232a36',borderRadius:18,padding:20,background:'#11151d'}}>
            <h2 style={{marginTop:0}}>{selected.label}</h2>
            <p style={{opacity:.7}}>{selected.hint}</p>

            {selected.needsPrompt && <>
              <label style={{display:'block',fontWeight:600,marginBottom:8}}>Instrução</label>
              <textarea value={prompt} onChange={(e)=>setPrompt(e.target.value)}
                placeholder="Descreva o resultado profissional que deseja…"
                style={{width:'100%',minHeight:150,resize:'vertical',boxSizing:'border-box',borderRadius:14,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:14}} />
            </>}

            <label style={{display:'block',fontWeight:600,margin:'16px 0 8px'}}>Arquivo de entrada (URL, quando aplicável)</label>
            <input value={inputUrl} onChange={(e)=>setInputUrl(e.target.value)} placeholder="https://…"
              style={{width:'100%',boxSizing:'border-box',borderRadius:12,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:12}} />

            {operation === 'inpaint' && <>
              <label style={{display:'block',fontWeight:600,margin:'16px 0 8px'}}>Máscara (URL, opcional)</label>
              <input value={maskUrl} onChange={(e)=>setMaskUrl(e.target.value)} placeholder="https://…"
                style={{width:'100%',boxSizing:'border-box',borderRadius:12,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:12}} />
            </>}

            {isVideo && <>
              <label style={{display:'block',fontWeight:600,margin:'16px 0 8px'}}>Duração</label>
              <select value={durationSeconds} onChange={(e)=>setDurationSeconds(Number(e.target.value))}
                style={{borderRadius:12,border:'1px solid #30394a',background:'#0c1017',color:'#fff',padding:12}}>
                <option value={5}>5 segundos</option>
                <option value={8}>8 segundos</option>
                <option value={10}>10 segundos</option>
              </select>
            </>}

            <button disabled={running || (selected.needsPrompt && !prompt.trim())}
              style={{display:'block',width:'100%',marginTop:20,padding:'13px 16px',border:0,borderRadius:13,fontWeight:700}}>
              {running ? 'Processando…' : 'Executar com IA'}
            </button>
          </form>

          <section style={{border:'1px solid #232a36',borderRadius:18,padding:20,background:'#11151d'}}>
            <h2 style={{marginTop:0}}>Resultado</h2>
            {!result && <p style={{opacity:.65}}>O resultado e o status da fila aparecerão aqui.</p>}
            {result?.error && <p style={{color:'#ffb4b4'}}>{result.error}</p>}
            {result?.jobId && <p><strong>Job:</strong> {result.jobId}</p>}
            {result?.provider && <p><strong>Motor:</strong> {result.provider}</p>}
            {result?.status && <p><strong>Status:</strong> {result.status}</p>}
            {result?.outputUrl && (
              result?.kind === 'video'
                ? <video src={result.outputUrl} controls style={{width:'100%',borderRadius:14}} />
                : result?.kind === 'image'
                  ? <img src={result.outputUrl} alt="Resultado gerado pela ALTIV" style={{width:'100%',borderRadius:14}} />
                  : <a href={result.outputUrl} target="_blank" rel="noreferrer" style={{color:'#fff'}}>Abrir resultado</a>
            )}
            {result?.ok && !result?.outputUrl && <p style={{opacity:.8}}>Tarefa enviada. O worker ainda não informou a URL final.</p>}
          </section>
        </div>
      </div>
    </main>
  )
}
