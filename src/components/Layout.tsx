import { useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { backendMode } from '../core/backend'
import { configToQuery, DEFAULT_CONFIG, type BugKind, type PlaygroundConfig, type PopupKind } from '../core/config'
import { usePlayground } from '../core/playground'
import { GlobalTraps } from './GlobalTraps'

const POPUPS: PopupKind[] = ['cookie', 'gotit', 'promo', 'survey']
const BUGS: BugKind[] = ['cartTotal', 'savePersist', 'toastText', 'brokenLink', 'api500', 'consoleError']

function SettingsDrawer({ onClose }: { onClose: () => void }) {
  const { config } = usePlayground()
  const navigate = useNavigate()
  const location = useLocation()
  const [draft, setDraft] = useState<PlaygroundConfig>(config)
  const set = <K extends keyof PlaygroundConfig>(k: K, v: PlaygroundConfig[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const toggleIn = <T extends string>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const apply = (c: PlaygroundConfig) => {
    // keep page-specific params, replace config params
    const current = new URLSearchParams(location.search)
    const next = new URLSearchParams(configToQuery(c))
    current.forEach((v, k) => {
      if (!['seed', 'ns', 'env', 'unstableIds', 'unstableClasses', 'duplicateLabels', 'overlay', 'overlayMs', 'popup', 'popupDelay', 'popupRandom', 'renderDelay', 'netDelay', 'shuffle', 'variant', 'device', 'stress', 'now', 'bugs'].includes(k)) next.set(k, v)
    })
    navigate(`${location.pathname}?${next.toString()}`)
    onClose()
  }

  const check = (k: 'unstableIds' | 'unstableClasses' | 'duplicateLabels' | 'overlay' | 'shuffle' | 'popupRandom' | 'stress', label: string) => (
    <label data-ui="inline">
      <input type="checkbox" checked={draft[k]} onChange={(e) => set(k, e.target.checked)} /> {label} <code>{k}</code>
    </label>
  )
  const numberField = (k: 'seed' | 'overlayMs' | 'popupDelay' | 'renderDelay' | 'netDelay', label: string) => (
    <label data-ui="field">
      <span>
        {label} <code>{k}</code>
      </span>
      <input type="number" value={draft[k]} onChange={(e) => set(k, Number(e.target.value))} />
    </label>
  )

  return (
    <>
      <div data-ui="backdrop" onClick={onClose} />
      <aside data-ui="drawer" role="dialog" aria-label="Trap settings" data-testid="settings-drawer">
        <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0 }}>Trap settings</h2>
          <button aria-label="Close settings" onClick={onClose}>
            ✕
          </button>
        </div>
        <p data-ui="hint">Every setting is a URL parameter, so the same URL always reproduces the same page.</p>
        {numberField('seed', 'Seed')}
        <label data-ui="field">
          <span>
            Namespace <code>ns</code>
          </span>
          <input value={draft.ns} onChange={(e) => set('ns', e.target.value)} />
        </label>
        <h3>Locator traps</h3>
        {check('unstableIds', 'Unstable ids')}
        {check('unstableClasses', 'Unstable class names')}
        {check('duplicateLabels', 'Duplicate labels')}
        {check('shuffle', 'Shuffle lists')}
        <label data-ui="field">
          <span>
            Variant <code>variant</code>
          </span>
          <select value={draft.variant} onChange={(e) => set('variant', e.target.value as 'a' | 'b')}>
            <option value="a">a (recorded)</option>
            <option value="b">b (drifted layout and labels)</option>
          </select>
        </label>
        <h3>Timing traps</h3>
        {check('overlay', 'Click-intercepting overlay')}
        {numberField('overlayMs', 'Overlay duration (ms)')}
        {numberField('renderDelay', 'Render delay (ms)')}
        {numberField('netDelay', 'Network delay (ms)')}
        <h3>Popups</h3>
        <div data-ui="inline">
          {POPUPS.map((p) => (
            <label key={p} data-ui="inline">
              <input type="checkbox" checked={draft.popups.includes(p)} onChange={() => set('popups', toggleIn(draft.popups, p))} /> {p}
            </label>
          ))}
        </div>
        {numberField('popupDelay', 'Popup delay (ms)')}
        {check('popupRandom', 'Random (seeded) popup timing')}
        <h3>Deliberate app bugs</h3>
        <div data-ui="inline">
          {BUGS.map((b) => (
            <label key={b} data-ui="inline">
              <input type="checkbox" checked={draft.bugs.includes(b)} onChange={() => set('bugs', toggleIn(draft.bugs, b))} /> {b}
            </label>
          ))}
        </div>
        <h3>Other</h3>
        <label data-ui="field">
          <span>
            Device gate <code>device</code>
          </span>
          <select value={draft.device} onChange={(e) => set('device', e.target.value as 'any' | 'mobile')}>
            <option value="any">any</option>
            <option value="mobile">mobile only</option>
          </select>
        </label>
        <label data-ui="field">
          <span>
            Frozen clock <code>now</code>
          </span>
          <input placeholder="2026-10-06T10:00:00Z" value={draft.now ?? ''} onChange={(e) => set('now', e.target.value || null)} />
        </label>
        <label data-ui="field">
          <span>
            Environment <code>env</code>
          </span>
          <select value={draft.env} onChange={(e) => set('env', e.target.value as 'prod' | 'staging')}>
            <option value="prod">prod</option>
            <option value="staging">staging</option>
          </select>
        </label>
        {check('stress', 'Stress mode (all traps)')}
        <div data-ui="inline" style={{ marginTop: 16 }}>
          <button data-variant="primary" onClick={() => apply(draft)}>
            Apply
          </button>
          <button onClick={() => apply({ ...DEFAULT_CONFIG, ns: draft.ns })}>Reset to defaults</button>
        </div>
      </aside>
    </>
  )
}

function ReproFooter() {
  const { config } = usePlayground()
  const location = useLocation()
  const [copied, setCopied] = useState(false)
  const pageParams = new URLSearchParams(location.search)
  const merged = new URLSearchParams(configToQuery(config))
  pageParams.forEach((v, k) => {
    if (!merged.has(k)) merged.set(k, v)
  })
  const url = `${window.location.origin}${import.meta.env.BASE_URL.replace(/\/$/, '')}${location.pathname}?${merged.toString()}`
  return (
    <footer data-ui="footer">
      <span>Repro URL:</span>
      <code id="tp-repro-url" data-testid="repro-url">
        {url}
      </code>
      <button
        onClick={() => {
          void navigator.clipboard?.writeText(url).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy repro URL'}
      </button>
      <span>Backend: {backendMode}</span>
    </footer>
  )
}

export function Layout({ children }: { children: ReactNode }) {
  const { config } = usePlayground()
  const [settings, setSettings] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const nsQuery = config.ns !== 'default' ? `?ns=${config.ns}` : ''
  return (
    <div data-ui="app">
      {config.env === 'staging' ? <div data-ui="env-banner">STAGING ENVIRONMENT</div> : null}
      {backendMode === 'local' ? (
        <div data-ui="local-banner">Local mode: server-backed features use browser storage (no backend configured).</div>
      ) : null}
      <header data-ui="header" style={{ position: 'sticky' }}>
        <Link data-ui="brand" to={`/${nsQuery}`}>
          Test Playground
        </Link>
        <button data-ui="hamburger" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)}>
          ☰
        </button>
        <nav data-collapsible="true" data-open={menuOpen} aria-label="Main" onClick={() => setMenuOpen(false)}>
          <Link to={`/${nsQuery}`}>All pages</Link>
          <Link to={`/coverage${nsQuery}`}>Step coverage</Link>
          <Link to={`/system/reset${nsQuery}`}>Reset</Link>
          <button onClick={() => setSettings(true)} aria-label="Trap settings">
            ⚙ Settings
          </button>
        </nav>
      </header>
      <main data-ui="main" id="main">
        {children}
      </main>
      <ReproFooter />
      <GlobalTraps />
      {settings ? <SettingsDrawer onClose={() => setSettings(false)} /> : null}
    </div>
  )
}
