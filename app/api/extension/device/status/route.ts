import { NextRequest,NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sha256 } from '@/lib/extension-license'
import { extensionCorsHeaders, isAllowedExtensionOrigin, parseExtensionBearer } from '@/lib/extension-device-api'
export const dynamic='force-dynamic'

export async function OPTIONS(req:NextRequest) {
  return new NextResponse(null,{status:204,headers:extensionCorsHeaders(req.headers.get('origin'))})
}
export async function POST(req:NextRequest) {
  const origin=req.headers.get('origin')
  const headers=extensionCorsHeaders(origin)
  if(!isAllowedExtensionOrigin(origin))
    return NextResponse.json({error:'Origem não autorizada.'},{status:403,headers})
  const token=parseExtensionBearer(req.headers.get('authorization'))
  if(!token)return NextResponse.json({active:false},{status:401,headers})
  const db=createAdminClient()
  const now=new Date().toISOString()
  const {data:session}=await db.from('altiv_extension_sessions')
    .select('license_id,expires_at').eq('token_hash',sha256(token))
    .is('revoked_at',null).gt('expires_at',now).maybeSingle()
  if(!session)return NextResponse.json({active:false},{status:401,headers})
  const {data:license}=await db.from('altiv_extension_licenses')
    .select('account_id,expires_at').eq('id',session.license_id)
    .is('revoked_at',null).gt('expires_at',now).maybeSingle()
  if(!license)return NextResponse.json({active:false},{status:401,headers})
  const {data:account}=await db.from('saas_accounts')
    .select('name,status,trial_ends_at').eq('id',license.account_id).maybeSingle()
  if(!account || !['active','trial'].includes(account.status) ||
    (account.status==='trial' && (!account.trial_ends_at || account.trial_ends_at<=now)))
    return NextResponse.json({active:false},{status:401,headers})
  const expiresAt=[session.expires_at,license.expires_at,
    account.status==='trial'?account.trial_ends_at:null]
    .filter((v):v is string=>typeof v==='string').sort()[0]
  return NextResponse.json({active:true,accountName:account.name,expiresAt},{headers})
}
