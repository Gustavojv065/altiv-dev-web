import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteCredential, listCredentialStates, saveCredential, type CredentialKind } from '@/lib/integrations/user-credentials'

const allowed = new Set<CredentialKind>(['openrouter','opencode-zen','openai','gemini','nvidia','github'])

async function ownerId() {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  if (error || !data?.claims) return null
  return String(data.claims.sub)
}

export async function GET() {
  const id = await ownerId()
  if (!id) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  try {
    const states = await listCredentialStates(id)
    return NextResponse.json({ ok:true, credentials:states })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao carregar credenciais.' }, { status:500 })
  }
}

export async function POST(req: NextRequest) {
  const id = await ownerId()
  if (!id) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  const body = await req.json().catch(() => ({}))
  const kind = String(body?.kind ?? '') as CredentialKind
  const secret = String(body?.secret ?? '').trim()
  if (!allowed.has(kind) || !secret) return NextResponse.json({ ok:false, error:'Credencial inválida.' }, { status:400 })
  try {
    await saveCredential(id, kind, secret, body?.label, body?.metadata)
    return NextResponse.json({ ok:true })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao salvar credencial.' }, { status:500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = await ownerId()
  if (!id) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  const kind = String(new URL(req.url).searchParams.get('kind') ?? '') as CredentialKind
  if (!allowed.has(kind)) return NextResponse.json({ ok:false, error:'Integração inválida.' }, { status:400 })
  try {
    await deleteCredential(id, kind)
    return NextResponse.json({ ok:true })
  } catch (error) {
    return NextResponse.json({ ok:false, error:error instanceof Error ? error.message : 'Falha ao remover credencial.' }, { status:500 })
  }
}
