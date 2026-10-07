// Small helpers shared by the business scenario pages (Auth, Grid, Downloads, Windows, Api, Heavy, Parallel, Errors).
import { useCallback, useEffect, useRef } from 'react'
import { usePageState } from '../../../core/playground'
import type { PlaygroundConfig } from '../../../core/config'

/** Runs `fn` once after mount (guarded so StrictMode's double effect run does not repeat it). */
export function useAfterMount(fn: () => void) {
  const ref = useRef(fn)
  const done = useRef(false)
  ref.current = fn
  useEffect(() => {
    if (done.current) return
    done.current = true
    ref.current()
  }, [])
}

/** Appends items to a list kept in page state under `key` (safe for rapid successive calls). */
export function useStateLog<T>(key: string) {
  const { merge } = usePageState()
  const items = useRef<T[]>([])
  const append = useCallback(
    (item: T) => {
      items.current = [...items.current, item].slice(-30)
      merge({ [key]: items.current })
    },
    [key, merge],
  )
  const reset = useCallback(() => {
    items.current = []
    merge({ [key]: [] })
  }, [key, merge])
  return { append, reset, items }
}

/** Absolute URL of another playground route, keeping the namespace (and seed / variant) so child windows match. */
export function routeUrl(config: PlaygroundConfig, path: string, extra?: Record<string, string>): string {
  const q = new URLSearchParams()
  if (config.ns !== 'default') q.set('ns', config.ns)
  if (config.seed !== 1) q.set('seed', String(config.seed))
  if (config.variant !== 'a') q.set('variant', config.variant)
  if (config.now) q.set('now', config.now)
  for (const [k, v] of Object.entries(extra ?? {})) q.set(k, v)
  const qs = q.toString()
  return `${window.location.origin}${import.meta.env.BASE_URL}${path.replace(/^\//, '')}/${qs ? `?${qs}` : ''}`
}

/** yyyy-mm-dd (UTC) for a millisecond timestamp. */
export const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Triggers a browser download of in-memory text. */
export function downloadText(name: string, text: string, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

export async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
