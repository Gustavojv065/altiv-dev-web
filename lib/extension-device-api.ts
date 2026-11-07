/** Strict CORS allowlist for browser-extension bearer-token requests; no cookies. */
export function extensionCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
  }
  if (origin && /^chrome-extension:\/\/[a-p]{32}$/.test(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
    headers['Access-Control-Allow-Headers'] = 'authorization, content-type'
    headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS'
  }
  return headers
}
export function isAllowedExtensionOrigin(origin: string | null) {
  return !origin || /^chrome-extension:\/\/[a-p]{32}$/.test(origin)
}
export function parseExtensionBearer(header: string | null) {
  const token = header?.startsWith('Bearer ') ? header.slice(7) : ''
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null
}
