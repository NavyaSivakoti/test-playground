// Helpers shared by the scenario pages (not a page: no .page.tsx suffix).
import { CONFIG_KEYS } from '../../core/config'

/** URL of a bare embed page that keeps the parent's playground config (except the device gate). */
export function embedSrc(path: string, search: string, extra?: Record<string, string>): string {
  const cur = new URLSearchParams(search)
  const next = new URLSearchParams()
  cur.forEach((v, k) => {
    if ((CONFIG_KEYS as readonly string[]).includes(k) && k !== 'device' && k !== 'popup' && k !== 'overlay' && k !== 'stress') next.set(k, v)
  })
  if (extra) for (const [k, v] of Object.entries(extra)) next.set(k, v)
  const q = next.toString()
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}/${q ? `?${q}` : ''}`
}

/** Message envelope posted by embed pages to their parent/top window. */
export interface EmbedMessage {
  source: 'tp-embed'
  frame: string
  type: string
  [k: string]: unknown
}

export function postToParent(msg: Omit<EmbedMessage, 'source'>, target: 'parent' | 'top' = 'parent') {
  const w = target === 'top' ? window.top : window.parent
  if (w && w !== window) w.postMessage({ source: 'tp-embed', ...msg }, '*')
}

/** Reads a cookie by exact name. */
export function readCookie(name: string): string | null {
  for (const part of document.cookie.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}

export function writeCookie(name: string, value: string | null) {
  const path = import.meta.env.BASE_URL
  if (value === null) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=${path}`
  else document.cookie = `${name}=${encodeURIComponent(value)}; path=${path}; max-age=86400; SameSite=Lax`
}

/** Default for a timing param that should be non-zero when the URL doesn't set it. */
export function delayParam(search: string, key: 'renderDelay' | 'netDelay', configured: number, fallback: number): number {
  return new URLSearchParams(search).has(key) ? configured : fallback
}
