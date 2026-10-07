import { useState } from 'react'
import { Card } from '../../components/ui'
import { API_BASE, backend } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PlaygroundConfig } from '../../core/config'
import type { PageMeta } from '../../core/registry'
import { CUSTOMERS } from '../../core/users'

export const meta: PageMeta = {
  path: '/steps/api',
  title: 'REST API and database checks',
  group: 'Step baselines',
  summary: 'The playground server endpoints with ready-made example requests, a small request playground that records the last response, and a known database row for database verification steps.',
  covers: [2, 595, 641],
  order: 29,
  samples: [
    {
      id: 'API1',
      title: 'List records',
      steps: ['REST_API: GET - {api}/records?ns=default&kind=demo'],
      expected: 'HTTP 200 with a JSON array (seed rows with "Seed demo records" first).',
    },
    {
      id: 'API2',
      title: 'Store a value from an API',
      steps: ['Gets the value of api "getRecords" and saves it to firstId'],
      expected: 'firstId = the id of the first demo record (shown on the page as "First record id").',
    },
    {
      id: 'API3',
      title: 'Send a request from the page',
      steps: ['Navigate to <base>/steps/api/', 'Select option by text "GET customers/1" in the list "Example request"', 'Click on "Send request"', 'Verify that the current page displays text "Status 200"'],
      expected: 'state.lastResponse = { status: 200, body: { id: 1, name: "Ada Lovelace", … } }.',
    },
    {
      id: 'API4',
      title: 'Database verification',
      steps: ['Database Verification: SELECT name FROM public.customers WHERE id=1'],
      expected: 'Returns "Ada Lovelace" (needs a database connection to the playground Postgres).',
    },
    {
      id: 'API5',
      title: 'Server error bug',
      query: 'bugs=api500',
      steps: ['Click on "Send request"', 'Verify that the current page displays text "Status 500"'],
      expected: 'state.lastResponse.status = 500.',
    },
  ],
}

const EXAMPLES = [
  { label: 'GET records', method: 'GET', path: '/records?ns={ns}&kind=demo', body: '' },
  { label: 'POST records', method: 'POST', path: '/records?ns={ns}&kind=demo', body: '{"title":"Demo record","owner":"ada@example.com"}' },
  { label: 'GET customers/1', method: 'GET', path: '/customers/1', body: '' },
  { label: 'GET health', method: 'GET', path: '/health', body: '' },
] as const

const ANON = import.meta.env.VITE_API_KEY as string | undefined

async function simulate(config: PlaygroundConfig, method: string, path: string, body: string): Promise<{ status: number; body: unknown }> {
  const url = new URL(path, 'http://local')
  const kind = url.searchParams.get('kind') || 'demo'
  const ns = url.searchParams.get('ns') || config.ns
  if (url.pathname === '/health') return { status: 200, body: { ok: true, version: 'local' } }
  if (url.pathname === '/customers') return { status: 200, body: CUSTOMERS }
  const cm = url.pathname.match(/^\/customers\/(\d+)$/)
  if (cm) {
    const c = CUSTOMERS.find((x) => x.id === Number(cm[1]))
    return c ? { status: 200, body: c } : { status: 404, body: { error: 'not found' } }
  }
  if (url.pathname === '/records') {
    if (method === 'GET') return { status: 200, body: await backend.list(ns, kind) }
    if (method === 'POST') {
      let data: Record<string, unknown> = {}
      try {
        data = body ? (JSON.parse(body) as Record<string, unknown>) : {}
      } catch {
        return { status: 400, body: { error: 'invalid JSON body' } }
      }
      return { status: 201, body: await backend.create(ns, kind, data) }
    }
  }
  const sm = url.pathname.match(/^\/status\/(\d{3})$/)
  if (sm) return { status: Number(sm[1]), body: { status: Number(sm[1]) } }
  return { status: 404, body: { error: `no local simulation for ${method} ${url.pathname}` } }
}

export default function ApiPage() {
  const t = useTraps('api')
  const config = useConfig()
  const { state, merge } = usePageState()
  const [example, setExample] = useState(0)
  const [method, setMethod] = useState<string>(EXAMPLES[0].method)
  const [path, setPath] = useState<string>(EXAMPLES[0].path.replace('{ns}', config.ns))
  const [body, setBody] = useState<string>(EXAMPLES[0].body)
  const [busy, setBusy] = useState(false)
  const last = state.lastResponse as { status: number; body: unknown; ms: number } | undefined

  const pick = (i: number) => {
    const ex = EXAMPLES[i]
    setExample(i)
    setMethod(ex.method)
    setPath(ex.path.replace('{ns}', config.ns))
    setBody(ex.body)
  }

  const send = async () => {
    setBusy(true)
    const started = performance.now()
    let res: { status: number; body: unknown }
    try {
      if (config.bugs.includes('api500')) res = { status: 500, body: { error: 'Internal Server Error (bugs=api500)' } }
      else if (API_BASE) {
        const r = await fetch(`${API_BASE}${path}`, {
          method,
          headers: { 'content-type': 'application/json', ...(ANON ? { apikey: ANON, authorization: `Bearer ${ANON}` } : {}) },
          body: method === 'GET' ? undefined : body || undefined,
        })
        const text = await r.text()
        let parsed: unknown = text
        try {
          parsed = JSON.parse(text)
        } catch {
          /* plain text */
        }
        res = { status: r.status, body: parsed }
      } else res = await simulate(config, method, path, body)
    } catch (e) {
      res = { status: 0, body: { error: String(e) } }
    }
    const json = JSON.stringify(res.body)
    const small = json.length > 1500 ? `${json.slice(0, 1500)}…` : res.body
    const patch: Record<string, unknown> = { lastResponse: { method, path, status: res.status, body: small, ms: Math.round(performance.now() - started) } }
    if (Array.isArray(res.body) && path.startsWith('/records')) patch.firstId = (res.body[0] as { id?: string } | undefined)?.id ?? null
    merge(patch)
    setBusy(false)
  }

  const seedRecords = async () => {
    const existing = await backend.list(config.ns, 'demo')
    if (existing.length < 3) for (let i = existing.length; i < 3; i++) await backend.create(config.ns, 'demo', { title: `Demo record ${i + 1}`, owner: 'ada@example.com' })
    const rows = await backend.list(config.ns, 'demo')
    merge({ firstId: rows[0]?.id ?? null, demoCount: rows.length })
  }

  const sendBtn = (
    <button id={t.id(t.v('send-request', 'api-send'))} className={t.cls('btn btn--send')} data-variant="primary" disabled={busy} onClick={() => void send()}>
      Send request
    </button>
  )

  return (
    <>
      <Card title="Server">
        {API_BASE ? (
          <p>
            API base: <code data-testid="api-base">{API_BASE}</code>
          </p>
        ) : (
          <p data-testid="api-base" data-ui="hint">
            Backend not configured – showing local simulation
          </p>
        )}
        <p data-ui="hint">
          Endpoints: GET /health, GET/POST /records?ns=&amp;kind=, GET /customers and /customers/:id, GET /status/:code, POST /echo, GET /openapi.json.
        </p>
        <h3>Example requests</h3>
        <ul>
          <li>
            <code>GET {'{api}'}/records?ns={config.ns}&amp;kind=demo</code> → 200 JSON array (named <code>getRecords</code>)
          </li>
          <li>
            <code>POST {'{api}'}/records?ns={config.ns}&amp;kind=demo</code> with a JSON body → the created record
          </li>
          <li>
            <code>GET {'{api}'}/customers/1</code> → Ada Lovelace
          </li>
        </ul>
        <div data-ui="inline">
          <button id={t.id('seed-demo')} className={t.cls('btn btn--seed')} onClick={() => void seedRecords()}>
            Seed demo records
          </button>
          <span>
            First record id: <code data-testid="first-id">{state.firstId === undefined ? '(not loaded)' : String(state.firstId)}</code>
          </span>
        </div>
      </Card>

      <Card title={t.v('Request playground', 'Try a request')}>
        <label data-ui="field">
          <span>Example request</span>
          <select id={t.id('example')} className={t.cls('select select--example')} value={example} onChange={(e) => pick(Number(e.target.value))}>
            {EXAMPLES.map((ex, i) => (
              <option key={ex.label} value={i}>
                {ex.label}
              </option>
            ))}
          </select>
        </label>
        <div data-ui="inline" data-wrapper={t.v(undefined, 'api-v2')}>
          <label data-ui="field" style={{ maxWidth: 110 }}>
            <span>Method</span>
            <select id={t.id('method')} value={method} onChange={(e) => setMethod(e.target.value)}>
              {['GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label data-ui="field" style={{ flex: 1 }}>
            <span>Path</span>
            <input id={t.id('path')} className={t.cls('input input--path')} value={path} onChange={(e) => setPath(e.target.value)} />
          </label>
        </div>
        <label data-ui="field">
          <span>Request body</span>
          <textarea id={t.id('body')} rows={3} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        {sendBtn}
        {last ? (
          <div data-testid="api-response">
            <p>
              <strong>Status {last.status}</strong> <span data-ui="hint">({last.ms} ms)</span>
            </p>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 240, overflow: 'auto' }}>{JSON.stringify(last.body, null, 2)}</pre>
          </div>
        ) : null}
      </Card>

      <Card title="Database verification">
        <p>The playground database has a read-only table of fictional customers. A database step can run:</p>
        <pre data-testid="db-sql">SELECT name FROM public.customers WHERE id=1</pre>
        <p>
          Expected result: <strong data-testid="db-expected">{CUSTOMERS.find((c) => c.id === 1)?.name}</strong>
        </p>
        <table style={{ maxWidth: 520 }}>
          <thead>
            <tr>
              <th>id</th>
              <th>name</th>
              <th>plan</th>
            </tr>
          </thead>
          <tbody>
            {CUSTOMERS.map((c) => (
              <tr key={c.id}>
                <td>{c.id}</td>
                <td>{c.name}</td>
                <td>{c.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p data-ui="hint">Needs a database connection from the test platform to the playground Postgres (read-only role).</p>
      </Card>
    </>
  )
}
