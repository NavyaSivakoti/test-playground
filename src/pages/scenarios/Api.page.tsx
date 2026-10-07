import { useState } from 'react'
import { Card, Field, useToast } from '../../components/ui'
import { API_BASE } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { simulate } from './business/localApi'

export const meta: PageMeta = {
  path: '/api',
  title: 'REST API explorer',
  group: 'Scenarios',
  summary:
    'Documents every endpoint of the playground API and lets you send requests from the browser (to the backend when configured, otherwise to an in-browser simulation), with status, timing, body and a cURL command.',
  covers: [2, 595, 432, 70, 26, 596, 138, 467],
  order: 14,
  samples: [
    {
      id: 'P1',
      title: 'Health check',
      steps: ['Navigate to <base>/api/', 'Click on "Try GET /health"', 'Click on "Send request"', 'Verify that the "Response status" displays text "200"'],
      expected: 'state.lastResponse.status = 200 and the body contains "ok": true.',
    },
    {
      id: 'P2',
      title: 'Login and call /me',
      steps: [
        'Select option by text "POST" in the list "Method"',
        'Enter /auth/login in the "Path" field',
        'Enter {"username":"viewer@example.com","password":"Playground!1"} in the "Request body (JSON)" field',
        'Click on "Send request"',
        'Store the text of "Response body" in a variable name loginBody',
      ],
      expected: 'state.lastResponse.status = 200; the body has a token. Then GET /me with "Authorization" = Bearer <token> returns the viewer.',
    },
    {
      id: 'P3',
      title: 'Error status and cURL',
      steps: ['Enter /status/500 in the "Path" field', 'Click on "Send request"', 'Click on "Copy as cURL" and store copied value on curl'],
      expected: 'state.lastResponse.status = 500; state.curl starts with "curl -X GET".',
    },
    {
      id: 'P4',
      title: 'REST API step against the backend',
      steps: ['REST_API: GET - Health', 'Gets the value of api Health and saves it to health'],
      expected: 'Run against <API_BASE>/health (shown on this page). In local mode there is no server; use the in-page explorer instead.',
    },
  ],
}

const ENDPOINTS: [string, string, string][] = [
  ['GET', '/health', '{ ok: true, version }'],
  ['GET', '/records?ns=default&kind=item', 'List records'],
  ['POST', '/records?ns=default&kind=item', 'Create a record (JSON body = data)'],
  ['PATCH', '/records/:id?ns=default', 'Update a record'],
  ['DELETE', '/records/:id?ns=default', 'Delete a record'],
  ['GET', '/state?ns=default&page=/steps/click', 'Observable page state'],
  ['POST', '/state?ns=default&page=/steps/click', 'Save page state'],
  ['GET', '/config?ns=default', 'Server-side drift override'],
  ['POST', '/config?ns=default', 'Set drift override'],
  ['POST', '/reset?ns=default', 'Delete everything for the namespace, returns { records }'],
  ['GET', '/inbox?ns=default', 'Mock inbox'],
  ['POST', '/inbox/send?ns=default', 'Send a (mock) email { to, subject, body }'],
  ['GET', '/basic', 'HTTP Basic Auth (tester / playground)'],
  ['GET', '/slow?ms=3000', 'Responds after ms (max 15000)'],
  ['GET', '/status/500', 'Responds with that HTTP status'],
  ['POST', '/echo', 'Echoes body, headers subset and query'],
  ['GET', '/customers', 'Seeded customers'],
  ['GET', '/customers/1', 'One customer'],
  ['POST', '/auth/login', '{ username, password } → { token }'],
  ['GET', '/me', 'Current user (Authorization: Bearer)'],
  ['GET', '/openapi.json', 'OpenAPI 3 spec'],
]
const SAMPLE_BODY: Record<string, string> = {
  '/records': '{"title":"First record"}',
  '/auth/login': '{"username":"viewer@example.com","password":"Playground!1"}',
  '/echo': '{"hello":"world"}',
  '/inbox/send': '{"to":"ada@example.com","subject":"Hello","body":"Test message"}',
  '/config': '{"variant":"b"}',
  '/state': '{"checked":true}',
}

export default function ApiPage() {
  const t = useTraps('api')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [method, setMethod] = useState('GET')
  const [path, setPath] = useState('/health')
  const [body, setBody] = useState('')
  const [auth, setAuth] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<{ status: number; ms: number; body: string; mode: string } | null>(null)
  const [count, setCount] = useState(0)
  const mode = API_BASE ? 'remote' : 'local'

  const withNs = (p: string) => (config.ns !== 'default' ? p.replace('ns=default', `ns=${config.ns}`) : p)
  const curl = () => {
    const parts = [`curl -X ${method} '${API_BASE ?? 'https://api.example.com/api'}${path}'`]
    if (auth) parts.push(`-H 'Authorization: ${auth}'`)
    if (body.trim() && method !== 'GET') parts.push(`-H 'Content-Type: application/json' -d '${body.trim()}'`)
    return parts.join(' ')
  }

  const send = async () => {
    let parsed: unknown = undefined
    if (body.trim() && method !== 'GET') {
      try {
        parsed = JSON.parse(body)
      } catch {
        setRes({ status: 0, ms: 0, body: 'Invalid JSON body', mode })
        merge({ lastResponse: { status: 0, error: 'Invalid JSON body' } })
        return
      }
    }
    setBusy(true)
    const started = performance.now()
    let status = 0
    let text = ''
    try {
      if (API_BASE) {
        const key = import.meta.env.VITE_API_KEY as string | undefined
        const r = await fetch(`${API_BASE}${path}`, {
          method,
          headers: {
            'content-type': 'application/json',
            ...(key ? { apikey: key } : {}),
            ...(auth ? { authorization: auth } : key ? { authorization: `Bearer ${key}` } : {}),
          },
          body: parsed === undefined ? undefined : JSON.stringify(parsed),
        })
        status = r.status
        text = await r.text()
        try {
          text = JSON.stringify(JSON.parse(text), null, 2)
        } catch {
          /* plain text */
        }
      } else {
        const out = await simulate(method, path, parsed, auth)
        status = out.status
        text = typeof out.body === 'string' ? out.body : JSON.stringify(out.body, null, 2)
      }
    } catch (e) {
      text = String(e)
    }
    const ms = Math.round(performance.now() - started)
    setBusy(false)
    setRes({ status, ms, body: text, mode })
    const n = count + 1
    setCount(n)
    merge({ requests: n, lastRequest: { method, path, mode }, lastResponse: { status, ms, bodyPreview: text.slice(0, 300) } })
  }

  return (
    <>
      <Card title="Backend">
        {API_BASE ? (
          <p data-testid="api-base">
            API base: <code>{API_BASE}</code>
          </p>
        ) : (
          <p data-testid="api-base" role="note">
            Backend not configured – showing local simulation. Requests below run in the browser against local storage; the real server URL looks like{' '}
            <code>https://api.example.com/api</code>.
          </p>
        )}
        <p>
          OpenAPI spec: <a href={`${import.meta.env.BASE_URL}openapi.json`}>openapi.json</a>
        </p>
      </Card>

      <Card title="Endpoints">
        <table data-testid="endpoints">
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Purpose</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {ENDPOINTS.map(([m, p, d]) => (
              <tr key={`${m} ${p}`}>
                <td>
                  <code>{m}</code>
                </td>
                <td>
                  <code>{p}</code>
                </td>
                <td>{d}</td>
                <td>
                  <button
                    aria-label={`Try ${m} ${p.split('?')[0]}`}
                    style={{ padding: '0.15rem 0.5rem' }}
                    onClick={() => {
                      setMethod(m)
                      setPath(withNs(p))
                      setBody(m === 'GET' || m === 'DELETE' ? '' : (SAMPLE_BODY[p.split('?')[0]] ?? '{}'))
                      merge({ preset: `${m} ${p}` })
                    }}
                  >
                    Try
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Request builder">
        <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
          <Field label="Method">
            <select id={t.id('method')} value={method} onChange={(e) => setMethod(e.target.value)}>
              {['GET', 'POST', 'PATCH', 'DELETE'].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
          <Field label="Path">
            <input id={t.id(t.v('path', 'request-path'))} className={t.cls('api__path')} value={path} onChange={(e) => setPath(e.target.value)} />
          </Field>
        </div>
        <Field label="Authorization" hint="e.g. Bearer <token> or Basic dGVzdGVyOnBsYXlncm91bmQ=">
          <input id={t.id('auth')} value={auth} onChange={(e) => setAuth(e.target.value)} />
        </Field>
        <Field label="Request body (JSON)">
          <textarea id={t.id('body')} rows={4} value={body} onChange={(e) => setBody(e.target.value)} style={{ fontFamily: 'monospace' }} />
        </Field>
        <div data-ui="inline">
          <button data-variant="primary" id={t.id(t.v('send', 'send-request'))} className={t.cls('api__send')} disabled={busy} onClick={send}>
            {busy ? 'Sending…' : t.v('Send request', 'Send')}
          </button>
          <button
            id={t.id('copy-curl')}
            onClick={async () => {
              const c = curl()
              try {
                await navigator.clipboard.writeText(c)
                toast('cURL copied')
              } catch {
                /* clipboard denied: still record it */
              }
              merge({ curl: c })
            }}
          >
            Copy as cURL
          </button>
        </div>
        <pre data-testid="curl-preview" style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem' }}>
          {curl()}
        </pre>
      </Card>

      <Card title="Response" data-testid="response">
        {res ? (
          <>
            <p>
              Status: <strong aria-label="Response status" data-testid="response-status">{res.status}</strong> · Time: <span data-testid="response-time">{res.ms} ms</span> ·
              Mode: {res.mode}
            </p>
            <pre aria-label="Response body" data-testid="response-body" style={{ whiteSpace: 'pre-wrap', maxHeight: 320, overflow: 'auto' }}>
              {res.body}
            </pre>
          </>
        ) : (
          <p data-ui="hint">No request sent yet.</p>
        )}
      </Card>
    </>
  )
}
