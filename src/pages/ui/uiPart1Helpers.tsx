/* eslint-disable react-refresh/only-export-components */
// Small helpers shared by the General UI pages (forms, toggles, layout, navigation, lists, crud, booking, media).
import { useEffect, useState } from 'react'
import { backendMode } from '../../core/backend'
import { useConfig } from '../../core/playground'

/** Visible hint shown on backend-backed pages in local mode. */
export function LocalHint() {
  if (backendMode !== 'local') return null
  return (
    <p data-ui="hint" data-testid="local-hint">
      Backend not configured – showing local simulation (records are kept in this browser, per namespace).
    </p>
  )
}

/** Builds an in-app link that keeps the current namespace (and the variant, so drift survives navigation). */
export function useNsLink() {
  const config = useConfig()
  return (path: string, extra?: Record<string, string>) => {
    const q = new URLSearchParams(extra)
    if (config.ns !== 'default') q.set('ns', config.ns)
    if (config.variant === 'b') q.set('variant', 'b')
    const s = q.toString()
    return s ? `${path}?${s}` : path
  }
}

/** true while the media query matches. */
export function useMedia(query: string): boolean {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [m, setM] = useState(get)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setM(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return m
}

/** A visual switch track (presentation only; styling uses inline styles, never class names). */
export function SwitchTrack({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: 38,
        height: 22,
        borderRadius: 999,
        background: on ? 'var(--accent)' : 'var(--border)',
        position: 'relative',
        opacity: disabled ? 0.5 : 1,
        transition: 'background 120ms',
        flex: 'none',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 3,
          left: on ? 19 : 3,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          transition: 'left 120ms',
        }}
      />
    </span>
  )
}
