// Small helpers shared by the advanced scenario pages (approvals, shop, shadow, chat, visual, a11y).
import { useEffect, useRef, type ReactNode } from 'react'
import { usePageState, useTraps } from '../../../core/playground'

/** Merge initial facts into the observable state once after mount. */
export function useMountMerge(patch: () => Record<string, unknown>, deps: unknown[] = []) {
  const { merge } = usePageState()
  const fn = useRef(patch)
  fn.current = patch
  useEffect(() => {
    merge(fn.current())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [merge, ...deps])
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function relTime(atMs: number, nowMs: number): string {
  const s = Math.max(0, Math.round((nowMs - atMs) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`
  const d = Math.round(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

/** cents -> "$1,234.50" */
export function money(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const v = Math.abs(cents) / 100
  return `${sign}$${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Wraps children in `depth` auto-generated wrapper divs (CSS-in-JS style class names derived from the
 * seed), like component libraries do. No styling depends on them.
 */
export function Wrappers({ scope, k, depth = 4, children }: { scope: string; k: string; depth?: number; children: ReactNode }) {
  const t = useTraps(scope)
  let node: ReactNode = children
  for (let i = depth - 1; i >= 0; i--) {
    const token = t.uuid(`wrap:${k}:${i}`).replace(/-/g, '').slice(0, 10)
    node = (
      <div className={t.cls(`sc-${token} css-${token.slice(0, 6)}-FormItem${i}`)} data-gen={`${token.slice(0, 6)}`}>
        {node}
      </div>
    )
  }
  return <>{node}</>
}

/** URL of one of our bare embed pages, keeping the playground config params of the current page. */
export function frameSrc(path: string, search: string): string {
  const cur = new URLSearchParams(search)
  const keep = ['seed', 'ns', 'variant', 'unstableIds', 'unstableClasses', 'netDelay', 'bugs', 'now']
  const next = new URLSearchParams()
  cur.forEach((v, k) => {
    if (keep.includes(k)) next.set(k, v)
  })
  const q = next.toString()
  return `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}/${q ? `?${q}` : ''}`
}

/** postMessage to the parent window (same origin only). */
export function toParent(msg: Record<string, unknown>) {
  if (window.parent && window.parent !== window) window.parent.postMessage(msg, window.location.origin)
}
