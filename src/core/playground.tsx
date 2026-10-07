/* eslint-disable react-refresh/only-export-components */
// The playground context: config, deterministic helpers and the observable state store.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { backend, setNetDelay } from './backend'
import { parseConfig, type PlaygroundConfig } from './config'
import { randFor, shuffled, tokenFor, uuidFor } from './rng'

interface PlaygroundCtx {
  config: PlaygroundConfig
  /** true once server-side (per-namespace) overrides have been fetched */
  serverLoaded: boolean
  reloadServerConfig: () => void
}

const Ctx = createContext<PlaygroundCtx | null>(null)
const loadedAt = typeof performance !== 'undefined' ? performance.now() : 0

export function PlaygroundProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const search = useMemo(() => new URLSearchParams(location.search), [location.search])
  const ns = search.get('ns') || 'default'
  const [override, setOverride] = useState<Partial<PlaygroundConfig> | undefined>(undefined)
  const [serverLoaded, setServerLoaded] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let alive = true
    backend
      .getConfig(ns)
      .then((o) => alive && setOverride(o && Object.keys(o).length ? o : undefined))
      .catch(() => undefined)
      .finally(() => alive && setServerLoaded(true))
    return () => {
      alive = false
    }
  }, [ns, tick])

  const config = useMemo(() => parseConfig(search, override), [search, override])

  useEffect(() => {
    setNetDelay(config.netDelay)
    document.documentElement.dataset.tpConfig = JSON.stringify(config)
  }, [config])

  const value = useMemo(
    () => ({ config, serverLoaded, reloadServerConfig: () => setTick((t) => t + 1) }),
    [config, serverLoaded],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function usePlayground(): PlaygroundCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('usePlayground outside PlaygroundProvider')
  return c
}

export function useConfig(): PlaygroundConfig {
  return usePlayground().config
}

/** Current time, honouring the frozen clock (`now=`). The frozen clock still ticks forward from the given instant. */
export function nowMs(config: PlaygroundConfig): number {
  if (config.now) {
    const base = Date.parse(config.now)
    if (!Number.isNaN(base)) return base + (performance.now() - loadedAt)
  }
  return Date.now()
}

/**
 * Locator helpers for a component. Use them for every id / className / test id so that the
 * trap switches (unstableIds, unstableClasses, duplicateLabels, variant) apply consistently.
 */
export function useTraps(scope: string) {
  const config = useConfig()
  const renders = useRef(0)
  renders.current += 1
  const r = renders.current
  return useMemo(() => {
    const seed = config.seed
    return {
      config,
      /** id attribute: stable by default, changes per render with unstableIds (same sequence for the same seed). */
      id: (base: string) => (config.unstableIds ? `${base}-${tokenFor(seed, `${scope}:${base}:${r}`, 5)}` : base),
      /** className: stable BEM names by default, random per render with unstableClasses. Styling never depends on classes. */
      cls: (base: string) =>
        config.unstableClasses
          ? base
              .split(/\s+/)
              .map((b) => `c${tokenFor(seed, `${scope}:${b}:${r}`, 6)}`)
              .join(' ')
          : base,
      /** CRM-style numeric id, e.g. input-1234 (always "dynamic looking", but seeded). */
      numericId: (base: string) => `${base}-${1000 + Math.floor(randFor(seed, `${scope}:${base}:${config.unstableIds ? r : 0}`) * 9000)}`,
      /** UUID-like name attribute, e.g. root_6b05… */
      uuid: (base: string) => uuidFor(seed, `${scope}:${base}:${config.unstableIds ? r : 0}`),
      /** choose a value by variant (a = recorded, b = drifted) */
      v: <T,>(a: T, b: T): T => (config.variant === 'b' ? b : a),
      shuffle: <T,>(items: readonly T[], key: string): T[] => (config.shuffle ? shuffled(items, seed, `${scope}:${key}`) : items.slice()),
      rand: (key: string) => randFor(seed, `${scope}:${key}`),
      dup: config.duplicateLabels,
    }
  }, [config, scope, r])
}

/** true after `ms` (defaults to the global renderDelay). */
export function useDelayed(ms?: number): boolean {
  const config = useConfig()
  const wait = ms ?? config.renderDelay
  const [ready, setReady] = useState(wait <= 0)
  useEffect(() => {
    if (wait <= 0) {
      setReady(true)
      return
    }
    setReady(false)
    const t = setTimeout(() => setReady(true), wait)
    return () => clearTimeout(t)
  }, [wait])
  return ready
}

// ---------------- Observable state ----------------
type StateMap = Record<string, unknown>
interface StateCtx {
  page: string
  state: StateMap
  set: (key: string, value: unknown) => void
  merge: (patch: StateMap) => void
  clear: () => void
}
const StateContext = createContext<StateCtx | null>(null)

export function PageStateProvider({ page, children }: { page: string; children: ReactNode }) {
  const config = useConfig()
  const [state, setState] = useState<StateMap>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // No reset-on-page effect: each route renders its own provider (keyed by path in App.tsx), so state
  // starts empty per page and merges made in a page's mount effects are never wiped.

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      void backend.saveState(config.ns, page, state)
    }, 300)
  }, [state, config.ns, page])

  const set = useCallback((key: string, value: unknown) => setState((s) => ({ ...s, [key]: value })), [])
  const merge = useCallback((patch: StateMap) => setState((s) => ({ ...s, ...patch })), [])
  const clear = useCallback(() => setState({}), [])
  const value = useMemo(() => ({ page, state, set, merge, clear }), [page, state, set, merge, clear])
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>
}

/** Read/write the page's observable state (rendered in #tp-state and saved to the backend). */
export function usePageState() {
  const c = useContext(StateContext)
  if (!c) throw new Error('usePageState outside PageStateProvider')
  return c
}

/** Namespaced browser-storage key helper, e.g. nsKey(config, 'token') -> "default_token". */
export function nsKey(config: PlaygroundConfig, key: string): string {
  return `${config.ns}_${key}`
}
