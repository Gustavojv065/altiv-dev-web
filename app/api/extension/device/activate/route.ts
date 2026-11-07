import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateSessionToken, hashAccessCode, sha256 } from '@/lib/extension-license'
import { extensionCorsHeaders, isAllowedExtensionOrigin } from '@/lib/extension-device-api'
export const dynamic = 'force-dynamic'

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {status:204,headers:extensionCorsHeaders(req.headers.get('origin'))})
}
export async function POST(req: NextRequest) {
  const origin=req.headers.get('origin')
  const headers=extensionCorsHeaders(origin)
  if(!isAllowedExtensionOrigin(origin))
    return NextResponse.json({error:'Origem não autorizada.'},{status:403,headers})
  const payload=await req.json().catch(()=>({}))
  const codeHash=hashAccessCode(typeof payload?.code==='string'?payload.code:'')
  if(!codeHash)return NextResponse.json({error:'Código inválido ou já utilizado.'},{status:400,headers})
  const token=generateSessionToken()
  const db=createAdminClient()
  // The existing service-role RPC atomically consumes a one-time license code
  // and inserts a session hash in a single transaction.
  const {data,error}=await db.rpc('redeem_altiv_extension_code',{
    p_code_hash:codeHash,p_session_hash:sha256(token),
  })
  const result=Array.isArray(data)?data[0]:null
  if(error || !result?.session_expires_at || !result?.session_account_id)
    return NextResponse.json({error:'Código inválido ou já utilizado.'},{status:400,headers})
  const {data:account}=await db.from('saas_accounts').select('name')
    .eq('id',result.session_account_id).maybeSingle()
  return NextResponse.json({
    token,accountName:account?.name||'Cliente ALTIVE',
    expiresAt:result.session_expires_at,
  },{headers})
}
