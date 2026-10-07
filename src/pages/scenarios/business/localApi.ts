// In-browser simulation of the playground REST API, used by the API explorer when no backend is configured.
import { backend } from '../../../core/backend'
import { CUSTOMERS, TEST_PASSWORD, USERS } from '../../../core/users'

export interface ApiResult {
  status: number
  body: unknown
  headers?: Record<string, string>
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)))
const unb64 = (s: string) => decodeURIComponent(escape(atob(s)))

export async function simulate(method: string, rawPath: string, body: unknown, auth: string): Promise<ApiResult> {
  const url = new URL(rawPath.startsWith('/') ? rawPath : `/${rawPath}`, 'http://local')
  const p = url.pathname.replace(/\/+$/, '') || '/'
  const q = url.searchParams
  const ns = q.get('ns') || 'default'
  const M = method.toUpperCase()
  const data = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>

  if (p === '/health' && M === 'GET') return { status: 200, body: { ok: true, version: 'local-simulation' } }
  if (p === '/records') {
    const kind = q.get('kind') || 'item'
    if (M === 'GET') return { status: 200, body: await backend.list(ns, kind) }
    if (M === 'POST') return { status: 201, body: await backend.create(ns, kind, data) }
  }
  const rec = p.match(/^\/records\/([^/]+)$/)
  if (rec) {
    const kind = q.get('kind') || 'item'
    try {
      if (M === 'PATCH') return { status: 200, body: await backend.update(ns, kind, rec[1], data) }
      if (M === 'DELETE') {
        await backend.remove(ns, kind, rec[1])
        return { status: 200, body: { deleted: rec[1] } }
      }
    } catch {
      return { status: 404, body: { error: 'record not found (local simulation needs &kind= for PATCH)' } }
    }
  }
  if (p === '/state') {
    const page = q.get('page') ?? undefined
    if (M === 'GET') return { status: 200, body: await backend.getState(ns, page) }
    if (M === 'POST' && page) {
      await backend.saveState(ns, page, data)
      return { status: 200, body: { ok: true } }
    }
  }
  if (p === '/config') {
    if (M === 'GET') return { status: 200, body: await backend.getConfig(ns) }
    if (M === 'POST') {
      await backend.setConfig(ns, data)
      return { status: 200, body: { ok: true } }
    }
  }
  if (p === '/reset' && M === 'POST') return { status: 200, body: await backend.reset(ns) }
  if (p === '/inbox' && M === 'GET') return { status: 200, body: await backend.inbox(ns) }
  if (p === '/inbox/send' && M === 'POST')
    return { status: 200, body: await backend.sendEmail(ns, String(data.to ?? ''), String(data.subject ?? ''), String(data.body ?? '')) }
  if (p === '/basic' && M === 'GET') {
    if (auth === `Basic ${btoa('tester:playground')}`) return { status: 200, body: 'Authenticated as tester' }
    return { status: 401, body: { error: 'Basic authentication required' }, headers: { 'www-authenticate': 'Basic realm="playground"' } }
  }
  if (p === '/slow' && M === 'GET') {
    const ms = Math.min(15000, Math.max(0, Number(q.get('ms') ?? 3000)))
    await sleep(ms)
    return { status: 200, body: { waitedMs: ms } }
  }
  const st = p.match(/^\/status\/(\d{3})$/)
  if (st) return { status: Number(st[1]), body: { status: Number(st[1]) } }
  if (p === '/echo' && M === 'POST') return { status: 200, body: { body, query: Object.fromEntries(q), headers: auth ? { authorization: auth } : {} } }
  if (p === '/customers' && M === 'GET') return { status: 200, body: CUSTOMERS }
  const cu = p.match(/^\/customers\/(\d+)$/)
  if (cu && M === 'GET') {
    const c = CUSTOMERS.find((x) => x.id === Number(cu[1]))
    return c ? { status: 200, body: c } : { status: 404, body: { error: 'customer not found' } }
  }
  if (p === '/auth/login' && M === 'POST') {
    const u = USERS.find((x) => x.email === data.username)
    if (!u || data.password !== TEST_PASSWORD) return { status: 401, body: { error: 'Invalid email or password' } }
    return { status: 200, body: { token: `local.${b64(u.email)}` } }
  }
  if (p === '/me' && M === 'GET') {
    const m = auth.match(/^Bearer local\.(.+)$/)
    const email = m ? (() => { try { return unb64(m[1]) } catch { return '' } })() : ''
    const u = USERS.find((x) => x.email === email)
    return u ? { status: 200, body: u } : { status: 401, body: { error: 'missing or invalid bearer token' } }
  }
  if (p === '/openapi.json' && M === 'GET') {
    const res = await fetch(`${import.meta.env.BASE_URL}openapi.json`, { headers: { accept: 'application/json' } })
    return { status: res.status, body: res.ok ? await res.json() : null }
  }
  return { status: 404, body: { error: `no route for ${M} ${p}` } }
}
