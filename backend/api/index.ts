// Test Playground public test API (Deno, any Postgres via DATABASE_URL).
// Runs on any Deno-compatible serverless host. Every write is scoped by namespace (?ns=).
// See docs/PAGE_CONTRACT.md for the endpoint table.
import postgres from 'npm:postgres@3'

const VERSION = '1.0.0'
const sql = postgres(Deno.env.get('DATABASE_URL')!, { max: 3, prepare: false })

const USERS: Record<string, { name: string; role: string }> = {
  'admin@example.com': { name: 'Ada Admin', role: 'admin' },
  'approver@example.com': { name: 'Grace Approver', role: 'approver' },
  'viewer@example.com': { name: 'Alan Viewer', role: 'viewer' },
}
const TEST_PASSWORD = 'Playground!1'
const BASIC_USER = 'tester'
const BASIC_PASS = 'playground'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS, ...extra } })
const text = (body: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...CORS, ...extra } })

// --- very small per-instance rate limiter (public endpoint) ---
const hits = new Map<string, { n: number; reset: number }>()
function limited(ip: string): boolean {
  const now = Date.now()
  const h = hits.get(ip)
  if (!h || h.reset < now) {
    hits.set(ip, { n: 1, reset: now + 60_000 })
    return false
  }
  h.n++
  return h.n > 300
}

const nsOf = (url: URL) => (url.searchParams.get('ns') || 'default').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'default'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function token(email: string) {
  return btoa(JSON.stringify({ email, iat: Date.now() })).replace(/=+$/, '')
}
function userFromAuth(req: Request) {
  const h = req.headers.get('authorization') ?? ''
  if (!h.startsWith('Bearer ')) return null
  try {
    const p = JSON.parse(atob(h.slice(7)))
    return USERS[p.email] ? { email: p.email, ...USERS[p.email] } : null
  } catch {
    return null
  }
}

async function sendRealEmail(to: string, subject: string, body: string): Promise<boolean> {
  // Optional real delivery through any HTTP email API that accepts {from,to,subject,text}.
  const endpoint = Deno.env.get('EMAIL_API_URL')
  const key = Deno.env.get('EMAIL_API_KEY')
  const from = Deno.env.get('EMAIL_FROM')
  if (!endpoint || !key || !from) return false
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from, to: [to], subject, text: body }),
  })
  return res.ok
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  const url = new URL(req.url)
  // Path after the function mount point (…/api)
  const path = url.pathname.replace(/^.*?\/api(?=\/|$)/, '') || '/'
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (limited(ip)) return json({ error: 'rate limited' }, 429)
  const ns = nsOf(url)
  const body = async () => {
    try {
      return await req.json()
    } catch {
      return {}
    }
  }

  try {
    // ---------- meta ----------
    if (path === '/' || path === '/health') return json({ ok: true, version: VERSION })
    if (path === '/openapi.json') {
      const site = Deno.env.get('SITE_URL')
      return site ? Response.redirect(`${site.replace(/\/$/, '')}/openapi.json`, 302) : json({ error: 'SITE_URL not set' }, 404)
    }

    // ---------- records ----------
    if (path === '/records') {
      const kind = url.searchParams.get('kind') ?? 'default'
      if (req.method === 'GET') {
        return json(await sql`select * from records where ns = ${ns} and kind = ${kind} order by created_at`)
      }
      if (req.method === 'POST') {
        const [row] = await sql`insert into records (ns, kind, data) values (${ns}, ${kind}, ${sql.json(await body())}) returning *`
        return json(row, 201)
      }
    }
    const rec = path.match(/^\/records\/([0-9a-f-]{36})$/)
    if (rec) {
      if (req.method === 'PATCH') {
        const [row] = await sql`update records set data = data || ${sql.json(await body())}, updated_at = now()
          where id = ${rec[1]} and ns = ${ns} returning *`
        return row ? json(row) : json({ error: 'not found' }, 404)
      }
      if (req.method === 'DELETE') {
        await sql`delete from records where id = ${rec[1]} and ns = ${ns}`
        return json({ deleted: rec[1] })
      }
    }

    // ---------- observable state ----------
    if (path === '/state') {
      const page = url.searchParams.get('page')
      if (req.method === 'POST' && page) {
        await sql`insert into page_state (ns, page, state) values (${ns}, ${page}, ${sql.json(await body())})
          on conflict (ns, page) do update set state = excluded.state, updated_at = now()`
        return json({ ok: true })
      }
      const rows = page
        ? await sql`select page, state from page_state where ns = ${ns} and page = ${page}`
        : await sql`select page, state from page_state where ns = ${ns}`
      return json(page ? (rows[0]?.state ?? null) : Object.fromEntries(rows.map((r) => [r.page, r.state])))
    }

    // ---------- server-side drift ----------
    if (path === '/config') {
      if (req.method === 'POST') {
        const cfg = await body()
        await sql`insert into ns_config (ns, config) values (${ns}, ${sql.json(cfg)})
          on conflict (ns) do update set config = excluded.config, updated_at = now()`
        return json(cfg)
      }
      const [row] = await sql`select config from ns_config where ns = ${ns}`
      return json(row?.config ?? {})
    }

    // ---------- reset ----------
    if (path === '/reset' && req.method === 'POST') {
      const counts = await Promise.all([
        sql`delete from records where ns = ${ns}`,
        sql`delete from page_state where ns = ${ns}`,
        sql`delete from ns_config where ns = ${ns}`,
        sql`delete from inbox where ns = ${ns}`,
      ])
      return json({ records: counts.reduce((n, r) => n + r.count, 0) })
    }

    // ---------- inbox / email ----------
    if (path === '/inbox' && req.method === 'GET') {
      const rows = await sql`select to_addr, subject, body, delivered, created_at from inbox where ns = ${ns} order by created_at desc limit 50`
      return json(rows.map((r) => ({ to: r.to_addr, subject: r.subject, body: r.body, delivered: r.delivered, at: r.created_at })))
    }
    if (path === '/inbox/send' && req.method === 'POST') {
      const { to, subject, body: content } = await body()
      if (!to || !subject) return json({ error: 'to and subject are required' }, 400)
      const real = await sendRealEmail(String(to), String(subject), String(content ?? ''))
      const delivered = real ? 'real' : 'mock'
      await sql`insert into inbox (ns, to_addr, subject, body, delivered) values (${ns}, ${String(to)}, ${String(subject)}, ${String(content ?? '')}, ${delivered})`
      return json({ delivered })
    }

    // ---------- HTTP Basic Auth ----------
    if (path === '/basic') {
      const h = req.headers.get('authorization') ?? ''
      if (h.startsWith('Basic ')) {
        const [u, p] = atob(h.slice(6)).split(':')
        if (u === BASIC_USER && p === BASIC_PASS) return text(`Authenticated as ${u}`)
      }
      return text('Authentication required', 401, { 'www-authenticate': 'Basic realm="Test Playground", charset="UTF-8"' })
    }

    // ---------- timing / status / echo ----------
    if (path === '/slow') {
      const ms = Math.min(Math.max(Number(url.searchParams.get('ms') ?? 3000), 0), 15000)
      await sleep(ms)
      return json({ ok: true, waitedMs: ms })
    }
    const status = path.match(/^\/status\/(\d{3})$/)
    if (status) {
      const code = Number(status[1])
      if (code < 200 || code > 599) return json({ error: 'status must be 200-599' }, 400)
      return json({ status: code, message: `Deliberate ${code} response` }, code)
    }
    if (path === '/echo') {
      return json({
        method: req.method,
        query: Object.fromEntries(url.searchParams),
        headers: { 'content-type': req.headers.get('content-type'), 'user-agent': req.headers.get('user-agent') },
        body: req.method === 'GET' ? null : await body(),
      })
    }

    // ---------- reference data ----------
    if (path === '/customers') return json(await sql`select * from customers order by id`)
    const cust = path.match(/^\/customers\/(\d+)$/)
    if (cust) {
      const [row] = await sql`select * from customers where id = ${Number(cust[1])}`
      return row ? json(row) : json({ error: 'not found' }, 404)
    }

    // ---------- auth ----------
    if (path === '/auth/login' && req.method === 'POST') {
      const { username, password } = await body()
      const u = USERS[String(username ?? '').toLowerCase()]
      if (!u || password !== TEST_PASSWORD) return json({ error: 'Invalid email or password' }, 401)
      return json({ token: token(String(username).toLowerCase()), user: { email: username, ...u } })
    }
    if (path === '/me') {
      const u = userFromAuth(req)
      return u ? json(u) : json({ error: 'unauthorized' }, 401)
    }

    return json({ error: 'not found', path }, 404)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
