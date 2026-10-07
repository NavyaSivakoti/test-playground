// Backend adapter. Uses the playground API (backend/api) when VITE_API_URL is set,
// otherwise a localStorage fallback ("local mode") so every page still works offline.
// All calls are keyed by namespace (ns) so parallel runs never see each other's data.

import type { PlaygroundConfig } from './config'

/** Full base URL of the API function, e.g. https://api.example.com/api */
const API_URL = import.meta.env.VITE_API_URL as string | undefined
/** Optional public key some hosts require on every request. */
const API_KEY = import.meta.env.VITE_API_KEY as string | undefined

export const API_BASE = API_URL ? API_URL.replace(/\/$/, '') : null
export const backendMode: 'remote' | 'local' = API_BASE ? 'remote' : 'local'

let netDelay = 0
export function setNetDelay(ms: number) {
  netDelay = ms
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface RecordRow {
  id: string
  kind: string
  data: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ResetReport {
  records: number
  keys: number
  frames: number
}

async function remote<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(API_KEY ? { apikey: API_KEY, authorization: `Bearer ${API_KEY}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
  return (await res.json()) as T
}

// ---------- local fallback ----------
const LKEY = (ns: string, part: string) => `tp:srv:${ns}:${part}`
function lget<T>(key: string, d: T): T {
  try {
    const v = localStorage.getItem(key)
    return v ? (JSON.parse(v) as T) : d
  } catch {
    return d
  }
}
function lset(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    /* storage unavailable */
  }
}
const nowIso = () => new Date().toISOString()
let localCounter = 0
const localId = () => `r${Date.now().toString(36)}${(localCounter++).toString(36)}`

// ---------- public API ----------
export const backend = {
  async getConfig(ns: string): Promise<Partial<PlaygroundConfig>> {
    if (API_BASE) return remote<Partial<PlaygroundConfig>>(`/config?ns=${encodeURIComponent(ns)}`).catch(() => ({}))
    return lget(LKEY(ns, 'config'), {})
  },

  async setConfig(ns: string, cfg: Partial<PlaygroundConfig>): Promise<void> {
    if (API_BASE) {
      await remote(`/config?ns=${encodeURIComponent(ns)}`, { method: 'POST', body: JSON.stringify(cfg) })
      return
    }
    lset(LKEY(ns, 'config'), cfg)
  },

  async saveState(ns: string, page: string, state: unknown): Promise<void> {
    if (API_BASE) {
      await remote(`/state?ns=${encodeURIComponent(ns)}&page=${encodeURIComponent(page)}`, {
        method: 'POST',
        body: JSON.stringify(state),
      }).catch(() => undefined)
      return
    }
    const all = lget<Record<string, unknown>>(LKEY(ns, 'state'), {})
    all[page] = state
    lset(LKEY(ns, 'state'), all)
  },

  async getState(ns: string, page?: string): Promise<unknown> {
    if (API_BASE) {
      const q = `/state?ns=${encodeURIComponent(ns)}${page ? `&page=${encodeURIComponent(page)}` : ''}`
      return remote(q)
    }
    const all = lget<Record<string, unknown>>(LKEY(ns, 'state'), {})
    return page ? (all[page] ?? null) : all
  },

  async list(ns: string, kind: string): Promise<RecordRow[]> {
    await sleep(netDelay)
    if (API_BASE) return remote(`/records?ns=${encodeURIComponent(ns)}&kind=${encodeURIComponent(kind)}`)
    return lget<RecordRow[]>(LKEY(ns, `rec:${kind}`), [])
  },

  async create(ns: string, kind: string, data: Record<string, unknown>): Promise<RecordRow> {
    await sleep(netDelay)
    if (API_BASE)
      return remote(`/records?ns=${encodeURIComponent(ns)}&kind=${encodeURIComponent(kind)}`, {
        method: 'POST',
        body: JSON.stringify(data),
      })
    const rows = lget<RecordRow[]>(LKEY(ns, `rec:${kind}`), [])
    const row: RecordRow = { id: localId(), kind, data, created_at: nowIso(), updated_at: nowIso() }
    rows.push(row)
    lset(LKEY(ns, `rec:${kind}`), rows)
    return row
  },

  async update(ns: string, kind: string, id: string, data: Record<string, unknown>): Promise<RecordRow> {
    await sleep(netDelay)
    if (API_BASE)
      return remote(`/records/${encodeURIComponent(id)}?ns=${encodeURIComponent(ns)}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      })
    const rows = lget<RecordRow[]>(LKEY(ns, `rec:${kind}`), [])
    const row = rows.find((r) => r.id === id)
    if (!row) throw new Error('not found')
    row.data = { ...row.data, ...data }
    row.updated_at = nowIso()
    lset(LKEY(ns, `rec:${kind}`), rows)
    return row
  },

  async remove(ns: string, kind: string, id: string): Promise<void> {
    await sleep(netDelay)
    if (API_BASE) {
      await remote(`/records/${encodeURIComponent(id)}?ns=${encodeURIComponent(ns)}`, { method: 'DELETE' })
      return
    }
    const rows = lget<RecordRow[]>(LKEY(ns, `rec:${kind}`), [])
    lset(
      LKEY(ns, `rec:${kind}`),
      rows.filter((r) => r.id !== id),
    )
  },

  /** Sends a (mock or real) email. Real delivery happens only when the server has an email key. */
  async sendEmail(ns: string, to: string, subject: string, body: string): Promise<{ delivered: 'mock' | 'real' }> {
    if (API_BASE)
      return remote(`/inbox/send?ns=${encodeURIComponent(ns)}`, {
        method: 'POST',
        body: JSON.stringify({ to, subject, body }),
      })
    const rows = lget<{ to: string; subject: string; body: string; at: string }[]>(LKEY(ns, 'inbox'), [])
    rows.unshift({ to, subject, body, at: nowIso() })
    lset(LKEY(ns, 'inbox'), rows)
    return { delivered: 'mock' }
  },

  async inbox(ns: string): Promise<{ to: string; subject: string; body: string; at: string }[]> {
    if (API_BASE) return remote(`/inbox?ns=${encodeURIComponent(ns)}`)
    return lget(LKEY(ns, 'inbox'), [])
  },

  /** Clears server-side data for a namespace. Browser storage and frames are cleared by the reset page. */
  async reset(ns: string): Promise<{ records: number }> {
    if (API_BASE) return remote(`/reset?ns=${encodeURIComponent(ns)}`, { method: 'POST' })
    let records = 0
    const prefix = `tp:srv:${ns}:`
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefix)) {
        const v = lget<unknown>(k, null)
        records += Array.isArray(v) ? v.length : 1
        localStorage.removeItem(k)
      }
    }
    return { records }
  },
}
