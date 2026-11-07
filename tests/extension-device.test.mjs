import test from 'node:test'
import assert from 'node:assert/strict'
import {extensionCorsHeaders,isAllowedExtensionOrigin,parseExtensionBearer} from '../lib/extension-device-api.ts'

test('valid extension origin is allowed with explicit CORS',()=>{
  const origin='chrome-extension://'+'a'.repeat(32)
  assert.equal(isAllowedExtensionOrigin(origin),true)
  const h=extensionCorsHeaders(origin)
  assert.equal(h['Access-Control-Allow-Origin'],origin)
  assert.equal(h['Access-Control-Allow-Credentials'],undefined)
  assert.equal(h['Cache-Control'],'no-store')
})
test('web origin cannot activate licenses from browser',()=>{
  for(const origin of ['https://example.com','null','chrome-extension://evil','chrome-extension://'+'z'.repeat(32)]){
    assert.equal(isAllowedExtensionOrigin(origin),false)
    assert.equal(extensionCorsHeaders(origin)['Access-Control-Allow-Origin'],undefined)
  }
})
test('bearer token syntax rejects invalid and short values',()=>{
  const token='A'.repeat(43)
  assert.equal(parseExtensionBearer('Bearer '+token),token)
  for(const input of [null,'','Bearer short','Basic '+token,'Bearer '+token+'x','Bearer '+token+'<'])
    assert.equal(parseExtensionBearer(input),null)
})
