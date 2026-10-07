// URL-driven configuration. Defaults are "everything off, deterministic".
// See README "Trap controls" for the full list.

export type PopupKind = 'cookie' | 'gotit' | 'promo' | 'survey'
export type BugKind = 'cartTotal' | 'savePersist' | 'toastText' | 'brokenLink' | 'api500' | 'consoleError'

export interface PlaygroundConfig {
  seed: number
  ns: string
  env: 'prod' | 'staging'
  unstableIds: boolean
  unstableClasses: boolean
  duplicateLabels: boolean
  overlay: boolean
  overlayMs: number
  popups: PopupKind[]
  popupDelay: number
  popupRandom: boolean
  renderDelay: number
  netDelay: number
  shuffle: boolean
  variant: 'a' | 'b'
  device: 'any' | 'mobile'
  stress: boolean
  now: string | null
  bugs: BugKind[]
}

export const DEFAULT_CONFIG: PlaygroundConfig = {
  seed: 1,
  ns: 'default',
  env: 'prod',
  unstableIds: false,
  unstableClasses: false,
  duplicateLabels: false,
  overlay: false,
  overlayMs: 1500,
  popups: [],
  popupDelay: 2000,
  popupRandom: false,
  renderDelay: 0,
  netDelay: 0,
  shuffle: false,
  variant: 'a',
  device: 'any',
  stress: false,
  now: null,
  bugs: [],
}

/** Query keys that belong to the playground config (everything else is left for the page). */
export const CONFIG_KEYS = [
  'seed', 'ns', 'env', 'unstableIds', 'unstableClasses', 'duplicateLabels', 'overlay', 'overlayMs',
  'popup', 'popupDelay', 'popupRandom', 'renderDelay', 'netDelay', 'shuffle', 'variant', 'device',
  'stress', 'now', 'bugs',
] as const

const truthy = (v: string | null) => v === 'true' || v === '1' || v === 'yes'
const num = (v: string | null, d: number) => (v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d)
const list = <T extends string>(v: string | null): T[] => (v ? (v.split(',').map((s) => s.trim()).filter(Boolean) as T[]) : [])

export function parseConfig(search: URLSearchParams, serverOverride?: Partial<PlaygroundConfig>): PlaygroundConfig {
  const c: PlaygroundConfig = {
    seed: num(search.get('seed'), DEFAULT_CONFIG.seed),
    ns: (search.get('ns') || DEFAULT_CONFIG.ns).replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48) || 'default',
    env: search.get('env') === 'staging' ? 'staging' : 'prod',
    unstableIds: truthy(search.get('unstableIds')),
    unstableClasses: truthy(search.get('unstableClasses')),
    duplicateLabels: truthy(search.get('duplicateLabels')),
    overlay: truthy(search.get('overlay')),
    overlayMs: num(search.get('overlayMs'), DEFAULT_CONFIG.overlayMs),
    popups: list<PopupKind>(search.get('popup')),
    popupDelay: num(search.get('popupDelay'), DEFAULT_CONFIG.popupDelay),
    popupRandom: truthy(search.get('popupRandom')),
    renderDelay: num(search.get('renderDelay'), 0),
    netDelay: num(search.get('netDelay'), 0),
    shuffle: truthy(search.get('shuffle')),
    variant: search.get('variant') === 'b' ? 'b' : 'a',
    device: search.get('device') === 'mobile' ? 'mobile' : 'any',
    stress: truthy(search.get('stress')),
    now: search.get('now'),
    bugs: list<BugKind>(search.get('bugs')),
  }
  // Server-side drift (per namespace) is applied on top of the URL so that a recorded test
  // can keep the same URL while the DOM changes underneath it.
  const merged = { ...c, ...(serverOverride ?? {}) }
  if (merged.stress) {
    merged.unstableIds = true
    merged.unstableClasses = true
    merged.duplicateLabels = true
    merged.overlay = true
    merged.shuffle = true
    merged.popups = merged.popups.length ? merged.popups : ['cookie', 'gotit']
    merged.renderDelay = merged.renderDelay || 1500
    merged.netDelay = merged.netDelay || 800
  }
  return merged
}

/** Serialise only the non-default values, for the repro URL and data attribute. */
export function configToQuery(c: PlaygroundConfig): string {
  const p = new URLSearchParams()
  const d = DEFAULT_CONFIG
  p.set('seed', String(c.seed))
  if (c.ns !== d.ns) p.set('ns', c.ns)
  if (c.env !== d.env) p.set('env', c.env)
  if (c.stress) p.set('stress', 'true')
  else {
    if (c.unstableIds) p.set('unstableIds', 'true')
    if (c.unstableClasses) p.set('unstableClasses', 'true')
    if (c.duplicateLabels) p.set('duplicateLabels', 'true')
    if (c.overlay) p.set('overlay', 'true')
    if (c.shuffle) p.set('shuffle', 'true')
    if (c.popups.length) p.set('popup', c.popups.join(','))
    if (c.renderDelay) p.set('renderDelay', String(c.renderDelay))
    if (c.netDelay) p.set('netDelay', String(c.netDelay))
  }
  if (c.overlay && c.overlayMs !== d.overlayMs) p.set('overlayMs', String(c.overlayMs))
  if (c.popups.length && c.popupDelay !== d.popupDelay) p.set('popupDelay', String(c.popupDelay))
  if (c.popupRandom) p.set('popupRandom', 'true')
  if (c.variant !== d.variant) p.set('variant', c.variant)
  if (c.device !== d.device) p.set('device', c.device)
  if (c.now) p.set('now', c.now)
  if (c.bugs.length) p.set('bugs', c.bugs.join(','))
  return p.toString()
}
