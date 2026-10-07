import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, useToast } from '../../components/ui'
import { nowMs, nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PlaygroundConfig } from '../../core/config'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/storage',
  title: 'Cookies and browser storage',
  group: 'Step baselines',
  summary: 'Seeds a namespaced cookie, localStorage key, sessionStorage key and IndexedDB entry, re-reads them on demand and probes on every load which of them survived (for session upload / restore).',
  covers: [67, 68, 141, 143, 170, 562, 563, 587, 588, 637],
  order: 23,
  samples: [
    {
      id: 'S1',
      title: 'Read a cookie',
      steps: ['Navigate to <base>/steps/storage/', 'Store cookie named "default_session" in variable sessionCookie', 'Verify that the "Cookie value" displays text "abc123"'],
      expected: 'sessionCookie = "abc123"; state.cookie = "abc123".',
    },
    {
      id: 'S2',
      title: 'Delete a cookie',
      steps: ['Delete cookie with name "default_session"', 'Click on "Re-read"', 'Verify that the "Cookie value" displays text "(none)"'],
      expected: 'state.cookie = null.',
    },
    {
      id: 'S3',
      title: 'Delete all cookies and local storage',
      steps: ['Delete all cookies from the current session', 'Delete all local storage cookies from the current session', 'Click on "Re-read"'],
      expected: 'state.cookies = {} and state.local = null.',
    },
    {
      id: 'S4',
      title: 'Read storage keys',
      steps: ['Gets the local storage value for key "default_token" and saves it to token', 'Gets the session storage value for key "default_step" and saves it to step'],
      expected: 'token = "tok-123", step = "3".',
    },
    {
      id: 'S5',
      title: 'Upload and restore a session',
      steps: ['Click on "Sign in (sets session)"', 'Upload Session', 'Restore Session', 'Navigate to <base>/steps/storage/'],
      expected: 'In the new run the "Session probe" table and state.probe show which of cookie / local / session survived the restore.',
    },
    {
      id: 'S6',
      title: 'Add a cookie',
      steps: ['Add cookies', 'Click on "Re-read"'],
      expected: 'The added cookie appears in state.cookies.',
    },
  ],
}

function readCookies(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const part of document.cookie.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const name = part.slice(0, i).trim()
    if (name) out[name] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function safe<T>(fn: () => T, d: T): T {
  try {
    return fn()
  } catch {
    return d
  }
}

const setCookie = (name: string, value: string) => {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`
}

function idbOpen(name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(name, 1)
    req.onupgradeneeded = () => req.result.createObjectStore('kv')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function idbPut(name: string, key: string, value: unknown) {
  const db = await idbOpen(name)
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('kv', 'readwrite')
    tx.objectStore('kv').put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  db.close()
}
async function idbGet(name: string, key: string): Promise<unknown> {
  const idb = indexedDB as IDBFactory & { databases?: () => Promise<{ name?: string }[]> }
  if (idb.databases) {
    const dbs = await idb.databases()
    if (!dbs.some((d) => d.name === name)) return null
  }
  const db = await idbOpen(name)
  const v = await new Promise<unknown>((resolve) => {
    const tx = db.transaction('kv', 'readonly')
    const req = tx.objectStore('kv').get(key)
    req.onsuccess = () => resolve(req.result ?? null)
    req.onerror = () => resolve(null)
  })
  db.close()
  return v
}

function snapshot(config: PlaygroundConfig) {
  const cookies = readCookies()
  return {
    cookie: cookies[nsKey(config, 'session')] ?? null,
    cookies,
    local: safe(() => localStorage.getItem(nsKey(config, 'token')), null),
    session: safe(() => sessionStorage.getItem(nsKey(config, 'step')), null),
  }
}

function seed(config: PlaygroundConfig, signedInAt?: string) {
  setCookie(nsKey(config, 'session'), 'abc123')
  localStorage.setItem(nsKey(config, 'token'), 'tok-123')
  sessionStorage.setItem(nsKey(config, 'step'), '3')
  if (signedInAt) {
    setCookie(nsKey(config, 'signedInAt'), signedInAt)
    localStorage.setItem(nsKey(config, 'signedInAt'), signedInAt)
    sessionStorage.setItem(nsKey(config, 'signedInAt'), signedInAt)
  }
}

export default function StoragePage() {
  const t = useTraps('storage')
  const config = useConfig()
  const toast = useToast()
  const { state, merge } = usePageState()
  const probed = useRef(false)
  const [probe, setProbe] = useState<{ cookie: boolean; local: boolean; session: boolean } | null>(null)
  const [cookieName, setCookieName] = useState('')
  const [cookieValue, setCookieValue] = useState('')
  const dbName = nsKey(config, 'db')

  const reread = useCallback(async () => {
    const snap = snapshot(config)
    const idb = await idbGet(dbName, 'token').catch(() => null)
    merge({ ...snap, idb, rereadAt: new Date(nowMs(config)).toISOString() })
  }, [config, dbName, merge])

  // Session probe: runs once per load, BEFORE anything is seeded, so it shows what a restored session brought along.
  useEffect(() => {
    if (probed.current) return
    probed.current = true
    // read synchronously (before any seeding), report after the state provider's mount reset
    const snap = snapshot(config)
    const p = { cookie: snap.cookie !== null, local: snap.local !== null, session: snap.session !== null }
    setProbe(p)
    const firstLoad = !p.cookie && !p.local && !p.session
    void (async () => {
      await new Promise((r) => setTimeout(r, 0))
      merge({ probe: p })
      if (firstLoad) {
        seed(config)
        await idbPut(dbName, 'token', 'tok-123').catch(() => undefined)
        merge({ autoSeeded: true })
      } else merge({ autoSeeded: false })
      await reread()
    })()
  }, [config, dbName, merge, reread])

  const v = state as { cookie?: string | null; local?: string | null; session?: string | null; idb?: unknown; cookies?: Record<string, string> }
  const show = (x: unknown) => (x === null || x === undefined ? '(none)' : String(x))

  const rereadBtn = (
    <button id={t.id('reread')} className={t.cls('btn btn--reread')} data-testid="reread" onClick={() => void reread()}>
      Re-read
    </button>
  )
  const seedBtn = (
    <button
      id={t.id(t.v('seed-storage', 'storage-seed'))}
      className={t.cls('btn btn--seed')}
      onClick={async () => {
        seed(config)
        await idbPut(dbName, 'token', 'tok-123').catch(() => undefined)
        await reread()
        toast('Storage seeded')
      }}
    >
      Seed storage
    </button>
  )

  return (
    <>
      <Card title="Session probe">
        <p data-ui="hint">Checked once when the page loaded, before anything was seeded. After “Restore Session” this shows which stores survived.</p>
        <table style={{ maxWidth: 420 }} data-testid="session-probe">
          <thead>
            <tr>
              <th>Store</th>
              <th>Present on load</th>
            </tr>
          </thead>
          <tbody>
            {(['cookie', 'local', 'session'] as const).map((k) => (
              <tr key={k}>
                <td>{k === 'cookie' ? `Cookie ${nsKey(config, 'session')}` : k === 'local' ? `localStorage ${nsKey(config, 'token')}` : `sessionStorage ${nsKey(config, 'step')}`}</td>
                <td data-testid={`probe-${k}`}>{probe ? (probe[k] ? 'yes' : 'no') : '…'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card title="Current values">
        {t.v(
          <div data-ui="inline">
            {seedBtn}
            {rereadBtn}
          </div>,
          <div data-ui="inline" data-wrapper="storage-v2">
            {rereadBtn}
            <span>{seedBtn}</span>
          </div>,
        )}
        <dl data-testid="storage-values">
          <dt>Cookie value</dt>
          <dd aria-label="Cookie value" data-testid="cookie-value">{show(v.cookie)}</dd>
          <dt>Local storage value</dt>
          <dd aria-label="Local storage value" data-testid="local-value">{show(v.local)}</dd>
          <dt>Session storage value</dt>
          <dd aria-label="Session storage value" data-testid="session-value">{show(v.session)}</dd>
          <dt>IndexedDB value</dt>
          <dd aria-label="IndexedDB value" data-testid="idb-value">{show(v.idb)}</dd>
          <dt>All cookies</dt>
          <dd data-testid="all-cookies">{v.cookies && Object.keys(v.cookies).length ? Object.keys(v.cookies).join(', ') : '(none)'}</dd>
        </dl>
        <p data-ui="hint">
          Keys: cookie <code>{nsKey(config, 'session')}</code>, localStorage <code>{nsKey(config, 'token')}</code>, sessionStorage <code>{nsKey(config, 'step')}</code>, IndexedDB <code>{dbName}</code>.
        </p>
      </Card>

      <Card title="Sign in">
        <button
          id={t.id('sign-in')}
          className={t.cls('btn btn--signin')}
          data-variant="primary"
          onClick={async () => {
            const at = new Date(nowMs(config)).toISOString()
            seed(config, at)
            await idbPut(dbName, 'token', 'tok-123').catch(() => undefined)
            merge({ signedInAt: at })
            await reread()
            toast('Signed in', { tone: 'success' })
          }}
        >
          Sign in (sets session)
        </button>
        {state.signedInAt ? <p data-testid="signed-in">Signed in at {String(state.signedInAt)}</p> : null}
      </Card>

      <Card title={t.v('Add a cookie', 'Add cookie manually')}>
        <div data-ui="inline">
          <label data-ui="field">
            <span>New cookie name</span>
            <input id={t.id('cookie-name')} value={cookieName} onChange={(e) => setCookieName(e.target.value)} />
          </label>
          <label data-ui="field">
            <span>New cookie value</span>
            <input id={t.id('cookie-value-input')} value={cookieValue} onChange={(e) => setCookieValue(e.target.value)} />
          </label>
        </div>
        <button
          id={t.id('add-cookie')}
          className={t.cls('btn btn--add-cookie')}
          disabled={!cookieName.trim()}
          onClick={async () => {
            setCookie(cookieName.trim(), cookieValue)
            await reread()
          }}
        >
          Add cookie
        </button>
      </Card>
    </>
  )
}
