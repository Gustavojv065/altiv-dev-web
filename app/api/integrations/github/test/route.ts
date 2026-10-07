import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req:NextRequest) {
  const supabase = await createClient()
  const { data: claimsData, error: authError } = await supabase.auth.getClaims()
  if (authError || !claimsData?.claims) return NextResponse.json({ ok:false, error:'Não autenticado.' }, { status:401 })
  const body = await req.json().catch(() => ({}))
  const token = String(body?.token ?? '').trim()
  if (!token) return NextResponse.json({ ok:false, error:'Token obrigatório.' }, { status:400 })

  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        accept:'application/vnd.github+json',
        authorization:'Bearer ' + token,
        'x-github-api-version':'2022-11-28',
      },
      cache:'no-store',
    })
    if (!response.ok) return NextResponse.json({ ok:false, error:'Token recusado pelo GitHub (' + response.status + ').' }, { status:400 })
    const user = await response.json()
    return NextResponse.json({ ok:true, login:user.login, avatar:user.avatar_url })
  } catch {
    return NextResponse.json({ ok:false, error:'Não foi possível testar a conexão com GitHub.' }, { status:500 })
  }
}
