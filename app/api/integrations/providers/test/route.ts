import { NextRequest, NextResponse } from 'next/server'
import type { ProviderId } from '@/lib/ai/provider-catalog'

async function testOpenAI(key:string) {
  return fetch('https://api.openai.com/v1/models', { headers:{ authorization:'Bearer ' + key }, signal:AbortSignal.timeout(12000) })
}
async function testOpenRouter(key:string) {
  return fetch('https://openrouter.ai/api/v1/models', { headers:{ authorization:'Bearer ' + key }, signal:AbortSignal.timeout(12000) })
}
async function testGemini(key:string) {
  return fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(key), { signal:AbortSignal.timeout(12000) })
}
async function testNvidia(key:string) {
  return fetch('https://integrate.api.nvidia.com/v1/models', { headers:{ authorization:'Bearer ' + key }, signal:AbortSignal.timeout(12000) })
}
async function testZen(key:string) {
  return fetch('https://opencode.ai/zen/v1/models', { headers:{ authorization:'Bearer ' + key }, signal:AbortSignal.timeout(12000) })
}

export async function POST(req:NextRequest) {
  const body = await req.json().catch(() => ({}))
  const provider = String(body?.provider ?? '') as ProviderId
  const key = String(body?.key ?? '').trim()
  if (!key) return NextResponse.json({ ok:false, error:'Chave obrigatória.' }, { status:400 })

  try {
    const response =
      provider === 'openrouter' ? await testOpenRouter(key) :
      provider === 'opencode-zen' ? await testZen(key) :
      provider === 'openai' ? await testOpenAI(key) :
      provider === 'gemini' ? await testGemini(key) :
      provider === 'nvidia' ? await testNvidia(key) :
      null

    if (!response) return NextResponse.json({ ok:false, error:'Provider inválido.' }, { status:400 })
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      return NextResponse.json({ ok:false, error:'Conexão recusada (' + response.status + '). ' + detail.slice(0,120) }, { status:400 })
    }
    return NextResponse.json({ ok:true })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao testar provider.' }, { status:500 })
  }
}
