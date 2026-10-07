import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { delayParam } from './shared'

export const meta: PageMeta = {
  path: '/dynamic',
  title: 'Dynamic content lab',
  group: 'Scenarios',
  summary:
    'Timing problems in one place: late results, a button that stays disabled until a field is filled, overlays and popups, a node replaced right after load, a menu that closes under a double click, a form that is overwritten by late data, a short-lived toast, a sticky header, a moving target and paginated results.',
  covers: [348, 597, 549, 27, 589, 186],
  order: 5,
  samples: [
    {
      id: 'D1',
      title: 'Wait for late results',
      steps: ['Navigate to <base>/dynamic/', 'Wait until the text "Results ready" is present on the current page'],
      expected: 'The text appears renderDelay ms after load (2500 ms when the URL does not set renderDelay). state.resultsReadyAfterMs ≈ the delay.',
    },
    {
      id: 'D2',
      title: 'Disabled until filled',
      steps: ['Verify that the "Submit" is disabled or not clickable.', 'Enter Ada in the "Name" field', 'Wait untill "Submit" element is enabled', 'Click on "Submit"'],
      expected: 'state.submitted = "Ada".',
    },
    {
      id: 'D3',
      title: 'Save behind an overlay',
      query: 'overlay=true&overlayMs=2000',
      steps: ['Click on "Save"'],
      expected: 'An immediate click hits the transparent overlay (html[data-tp-intercepted-clicks] ≥ 1, state.saved unset); a click after 2 s gives state.saved = true.',
    },
    {
      id: 'D4',
      title: 'Works with a "Got it" popup',
      query: 'popup=gotit&popupDelay=1000',
      steps: ['Click on "Got it" if Present', 'Click on "Save"'],
      expected: 'state.saved = true once the popup is dismissed.',
    },
    {
      id: 'D5',
      title: 'Button replaced after load',
      steps: ['Wait until the text "Data refreshed" is present on the current page', 'Click on "Refresh data"'],
      expected: 'The button is a new DOM node 1 s after load (same label). state.refreshClicks = 1 exactly; state.refreshNodeVersion = 2.',
    },
    {
      id: 'D6',
      title: 'Double-click hazard',
      steps: ['Click on "Open menu"', 'Double click on "Close menu"'],
      expected:
        'The menu closes on mousedown, so the second click of the double click lands on "Save draft" underneath: state.saveDraftClicks ≥ 1 (a single click gives 0).',
    },
    {
      id: 'D7',
      title: 'Form overwritten by late data',
      query: 'renderDelay=3000',
      steps: ['Wait until the text "Address loaded" is present on the current page', 'Enter 12 Engine Street in the "Street" field'],
      expected: 'Typing before "Address loaded" is lost (state.addressOverwritten lists the fields); typing after it sticks: state.address.street = "12 Engine Street".',
    },
    {
      id: 'D8',
      title: 'Toast, sticky header, moving target, load more',
      steps: [
        'Click on "Show toast"',
        'Verify that the current page displays text "Changes applied"',
        'Click on "Covered button"',
        'Click on "Moving target"',
        'Click on "Load more results"',
        'Wait until the text "Result 10" is present on the current page',
      ],
      expected: 'The toast is gone after 2 s; state.coveredClicks = 1; state.movingClicks = 1 with state.movingPosition = "moved" when clicked after 1.5 s; state.results = 10 after netDelay.',
    },
  ],
}

const SERVER_ADDRESS = { street: '1 Analytical Way', city: 'Springfield', postal: '10101' }
type Addr = typeof SERVER_ADDRESS

export default function DynamicPage() {
  const t = useTraps('dynamic')
  const config = useConfig()
  const location = useLocation()
  const { merge } = usePageState()
  const toast = useToast()
  const resultsDelay = delayParam(location.search, 'renderDelay', config.renderDelay, 2500)
  const addressDelay = delayParam(location.search, 'renderDelay', config.renderDelay, 2000)
  const netDelay = delayParam(location.search, 'netDelay', config.netDelay, 800)

  const [ready, setReady] = useState(false)
  const [name, setName] = useState('')
  const [savedMsg, setSavedMsg] = useState<string | null>(null)
  const [nodeVersion, setNodeVersion] = useState(1)
  const refreshClicks = useRef(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuCloses = useRef(0)
  const saveDraftClicks = useRef(0)
  const [addr, setAddr] = useState<Addr>({ street: '', city: '', postal: '' })
  const [addrLoaded, setAddrLoaded] = useState(false)
  const typedBefore = useRef<Set<string>>(new Set())
  const [moved, setMoved] = useState(false)
  const movingClicks = useRef(0)
  const coveredClicks = useRef(0)
  const [results, setResults] = useState(5)
  const resultsRef = useRef(5)
  const [loadingMore, setLoadingMore] = useState(false)
  const coveredScroll = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const start = performance.now()
    merge({ ready: false, results: 5, refreshNodeVersion: 1, saveDraftClicks: 0, movingPosition: 'start' })
    const timers = [
      setTimeout(() => {
        setReady(true)
        merge({ ready: true, resultsReadyAfterMs: Math.round(performance.now() - start) })
      }, resultsDelay),
      setTimeout(() => {
        setNodeVersion(2)
        merge({ refreshNodeVersion: 2 })
      }, 1000),
      setTimeout(() => {
        setMoved(true)
        merge({ movingPosition: 'moved' })
      }, 1500),
      setTimeout(() => {
        setAddr(SERVER_ADDRESS)
        setAddrLoaded(true)
        merge({ address: SERVER_ADDRESS, addressLoaded: true, addressOverwritten: [...typedBefore.current] })
      }, addressDelay),
    ]
    if (coveredScroll.current) coveredScroll.current.scrollTop = 50
    return () => timers.forEach(clearTimeout)
  }, [merge, resultsDelay, addressDelay])

  const typeAddr = (k: keyof Addr, v: string) => {
    if (!addrLoaded) typedBefore.current.add(k)
    const next = { ...addr, [k]: v }
    setAddr(next)
    merge({ address: next })
  }

  return (
    <>
      <div data-ui="grid">
        <Card title="Late results (D1)" data-testid="d1">
          {ready ? (
            <p data-testid="results-ready">
              <strong>Results ready</strong>
            </p>
          ) : (
            <p data-ui="hint">Loading results…</p>
          )}
          <p data-ui="hint">Arrives after {resultsDelay} ms.</p>
        </Card>

        <Card title="Disabled until filled (D2)" data-testid="d2">
          <label data-ui="field">
            <span>Name</span>
            <input id={t.id('name')} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button
            data-variant="primary"
            id={t.id(t.v('submit', 'send'))}
            disabled={!name.trim()}
            onClick={() => {
              merge({ submitted: name.trim() })
              toast(`Submitted ${name.trim()}`)
            }}
          >
            {t.v('Submit', 'Send')}
          </button>
        </Card>

        <Card title="Save (D3, D4)" data-testid="d3">
          <p data-ui="hint">With overlay=true a transparent layer intercepts clicks for overlayMs (counted in html[data-tp-intercepted-clicks]).</p>
          <button
            data-variant="primary"
            id={t.id(t.v('save', 'save-changes'))}
            onClick={async () => {
              const persist = !config.bugs.includes('savePersist')
              setSavedMsg('Saved')
              merge({ saved: true, persisted: persist })
              if (persist) await backend.create(config.ns, 'dynamic-save', { savedAt: 'click' }).catch(() => undefined)
            }}
          >
            {t.v('Save', 'Save changes')}
          </button>
          {savedMsg ? <span data-testid="saved-msg"> {savedMsg}</span> : null}
        </Card>

        <Card title="Replaced node (D5)" data-testid="d5">
          <button
            key={nodeVersion}
            id={t.id(`refresh-v${nodeVersion}`)}
            data-node-version={nodeVersion}
            onClick={() => {
              refreshClicks.current++
              merge({ refreshClicks: refreshClicks.current, refreshClickedNode: nodeVersion })
            }}
          >
            {t.v('Refresh data', 'Reload data')}
          </button>
          {nodeVersion === 2 ? <span data-ui="hint"> Data refreshed</span> : null}
          <p data-ui="hint">One second after load the button is replaced by a new element with the same label.</p>
        </Card>

        <Card title="Double-click hazard (D6)" data-testid="d6">
          <div data-ui="inline" style={{ alignItems: 'flex-start' }}>
            <div style={{ position: 'relative' }}>
              <button
                id={t.id('save-draft')}
                style={{ width: 140, height: 40, justifyContent: 'center' }}
                onClick={() => {
                  saveDraftClicks.current++
                  merge({ saveDraftClicks: saveDraftClicks.current })
                }}
              >
                Save draft
              </button>
              {menuOpen ? (
                <div role="menu" data-testid="hazard-menu" style={{ position: 'absolute', top: 0, left: 0, zIndex: 5 }}>
                  <button
                    role="menuitem"
                    data-variant="primary"
                    style={{ width: 140, height: 40, justifyContent: 'center' }}
                    onMouseDown={() => {
                      menuCloses.current++
                      setMenuOpen(false)
                      merge({ menuClosed: menuCloses.current })
                    }}
                  >
                    Close menu
                  </button>
                </div>
              ) : null}
            </div>
            <button id={t.id('open-menu')} onClick={() => setMenuOpen(true)}>
              Open menu
            </button>
          </div>
          <p data-ui="hint">The menu item sits exactly on top of “Save draft” and closes on mousedown.</p>
        </Card>

        <Card title="Shipping address (D7)" data-testid="d7">
          <form aria-label="Shipping address" onSubmit={(e) => e.preventDefault()}>
            <label data-ui="field">
              <span>Street</span>
              <input id={t.id('street')} value={addr.street} onChange={(e) => typeAddr('street', e.target.value)} />
            </label>
            <label data-ui="field">
              <span>City</span>
              <input id={t.id('city')} value={addr.city} onChange={(e) => typeAddr('city', e.target.value)} />
            </label>
            <label data-ui="field">
              <span>{t.v('Postal code', 'ZIP / Postal code')}</span>
              <input id={t.id('postal')} value={addr.postal} onChange={(e) => typeAddr('postal', e.target.value)} />
            </label>
          </form>
          {addrLoaded ? <span data-testid="address-loaded">Address loaded</span> : <span data-ui="hint">Loading saved address…</span>}
        </Card>

        <Card title="Short toast" data-testid="d8">
          <button
            id={t.id('show-toast')}
            onClick={() => {
              toast(config.bugs.includes('toastText') ? 'Change applied' : 'Changes applied', { ms: 2000 })
              merge({ toastShown: true })
            }}
          >
            Show toast
          </button>
          <p data-ui="hint">The toast disappears after 2 seconds.</p>
        </Card>

        <Card title="Sticky header" data-testid="d9">
          <div ref={coveredScroll} data-testid="covered-scroll" style={{ height: 180, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8, position: 'relative' }}>
            <div style={{ position: 'sticky', top: 0, height: 60, zIndex: 3, background: 'var(--surface-2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 10px' }}>
              <strong>Sticky section header</strong>
            </div>
            <div style={{ padding: '0 10px' }}>
              <button
                id={t.id('covered')}
                style={{ height: 40 }}
                onClick={() => {
                  coveredClicks.current++
                  merge({ coveredClicks: coveredClicks.current })
                }}
              >
                Covered button
              </button>
              <div style={{ height: 300 }} data-ui="hint">
                The button above starts hidden under the sticky header.
              </div>
            </div>
          </div>
        </Card>

        <Card title="Moving target" data-testid="d10">
          <button
            id={t.id('moving')}
            style={{ marginLeft: moved ? 150 : 0 }}
            onClick={() => {
              movingClicks.current++
              merge({ movingClicks: movingClicks.current, movingPositionAtClick: moved ? 'moved' : 'start' })
            }}
          >
            Moving target
          </button>
          <p data-ui="hint">Moves 150 px to the right 1.5 s after load.</p>
        </Card>
      </div>

      <Card title="Load more" data-testid="d11">
        <ul data-testid="results-list">
          {Array.from({ length: results }, (_, i) => (
            <li key={i}>Result {i + 1}</li>
          ))}
        </ul>
        <button
          id={t.id(t.v('load-more', 'show-more'))}
          disabled={loadingMore}
          onClick={() => {
            setLoadingMore(true)
            setTimeout(() => {
              setLoadingMore(false)
              resultsRef.current += 5
              setResults(resultsRef.current)
              merge({ results: resultsRef.current })
            }, netDelay)
          }}
        >
          {loadingMore ? 'Loading…' : t.v('Load more results', 'Show more results')}
        </button>
      </Card>
    </>
  )
}
