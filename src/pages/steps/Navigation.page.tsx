import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Card, publicUrl } from '../../components/ui'
import { nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/navigation',
  title: 'Navigation',
  group: 'Step baselines',
  summary:
    'Page load states, URL and title checks, delayed title and URL changes, browser history (back, forward, refresh) and a long page for full-page screenshots.',
  covers: [1, 11, 33, 123, 127, 131, 156, 163, 192, 320, 372, 425, 455, 495, 537, 538, 565, 591, 592],
  order: 1,
  samples: [
    {
      id: 'N1',
      title: 'Wait for a slow page',
      query: 'slow=3000',
      steps: ['Navigate to <base>/steps/navigation/?slow=3000', 'Wait until the current page is loaded completely', 'Verify that the current page displays text "Navigation page loaded"'],
      expected: 'The heading "Navigation page loaded" appears about 3 s after load; state.loadedAfterMs = 3000.',
    },
    {
      id: 'N2',
      title: 'Title checks',
      steps: [
        'Navigate to <base>/steps/navigation/',
        'Verify that the current page title is Navigation | Test Playground',
        'Store the title of current page in a variable pageTitle',
        'Click on "Change title in 2s"',
        'Wait until the current page title changes to Title changed',
      ],
      expected: 'pageTitle = "Navigation | Test Playground"; document.title becomes "Title changed" 2 s after the click; state.titleChanged = true.',
    },
    {
      id: 'N3',
      title: 'Delayed URL change',
      steps: ['Navigate to <base>/steps/navigation/', 'Click on "Go to step two in 2s"', 'Wait until the current page has url containing step=2'],
      expected: 'URL becomes <base>/steps/navigation/?step=2 after 2 s; state.step = "2".',
    },
    {
      id: 'N4',
      title: 'Back and forward',
      steps: ['Click on "Push history entry"', 'Click on the Back button in the browser', 'Verify that the current page displays text "Entry 0"', 'Click on the Forward button in the browser', 'Verify that the current page displays text "Entry 1"'],
      expected: 'state.historyIndex goes 1 -> 0 -> 1.',
    },
    {
      id: 'N5',
      title: 'Refresh keeps session data',
      steps: ['Click on "Reload counter"', 'Click on the Refresh button in the browser'],
      expected: 'state.reloads grows by 1 on every refresh and state.counter (clicks) survives the refresh (sessionStorage).',
    },
    {
      id: 'N6',
      title: 'Full page screenshot',
      steps: ['Navigate to <base>/steps/navigation/', 'Take full page screenshot with URL'],
      expected: 'The screenshot shows the footer marker at the very bottom.',
    },
  ],
}

/** One id per real page load (survives StrictMode double effects, changes on refresh). */
const LOAD_ID = typeof performance !== 'undefined' ? String(Math.round(performance.timeOrigin)) : '0'

export default function NavigationPage() {
  const t = useTraps('navigation')
  const config = useConfig()
  const { merge } = usePageState()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const slow = Number(params.get('slow') ?? 0) || 0
  const [loaded, setLoaded] = useState(slow <= 0)
  const [titlePending, setTitlePending] = useState(false)
  const [urlPending, setUrlPending] = useState(false)
  const [reloads, setReloads] = useState(0)
  const [counter, setCounter] = useState(0)
  const [lateImgSrc, setLateImgSrc] = useState<string | null>(null)
  const [lateFetches, setLateFetches] = useState(0)
  const started = useRef(false)
  const lateDone = useRef(0)
  const locRef = useRef(location)
  useEffect(() => {
    locRef.current = location
  }, [location])

  const entry = ((location.state as { entry?: number } | null)?.entry ?? 0) as number
  const step = params.get('step')

  // slow heading
  useEffect(() => {
    if (slow <= 0) return
    const timer = setTimeout(() => {
      setLoaded(true)
      merge({ loadedAfterMs: slow })
    }, slow)
    return () => clearTimeout(timer)
  }, [slow, merge])

  // history entry -> state
  useEffect(() => {
    merge({ historyIndex: entry })
  }, [entry, merge])

  useEffect(() => {
    if (step) merge({ step })
  }, [step, merge])

  // reload counter (sessionStorage, namespaced)
  useEffect(() => {
    const kLoads = nsKey(config, 'nav_reloads')
    const kLast = nsKey(config, 'nav_last_load')
    const kCounter = nsKey(config, 'nav_counter')
    let loads = Number(sessionStorage.getItem(kLoads) ?? 0)
    if (sessionStorage.getItem(kLast) !== LOAD_ID) {
      loads += 1
      sessionStorage.setItem(kLoads, String(loads))
      sessionStorage.setItem(kLast, LOAD_ID)
    }
    const c = Number(sessionStorage.getItem(kCounter) ?? 0)
    setReloads(loads)
    setCounter(c)
    merge({ reloads: loads, counter: c })
  }, [config, merge])

  // late network activity: requests every 400 ms until 2 s, image src at 3 s
  useEffect(() => {
    if (started.current) return
    started.current = true
    const timers: ReturnType<typeof setTimeout>[] = []
    ;[0, 400, 800, 1200, 1600, 2000].forEach((ms, i) => {
      timers.push(
        setTimeout(() => {
          fetch(publicUrl(`fixtures/notes.txt?late=${i}&t=${LOAD_ID}`), { cache: 'no-store' })
            .then((r) => r.text())
            .then(() => {
              lateDone.current += 1
              setLateFetches(lateDone.current)
              merge({ lateRequestsDone: lateDone.current })
            })
            .catch(() => merge({ lateRequestError: true }))
        }, ms),
      )
    })
    timers.push(setTimeout(() => setLateImgSrc(publicUrl(`fixtures/heavy.png?late=${LOAD_ID}`)), 3000))
    // timers are intentionally not cleared: the late activity belongs to the page load
  }, [merge])

  const pushEntry = () => {
    const next = entry + 1
    navigate({ pathname: location.pathname, search: location.search }, { state: { entry: next } })
  }

  return (
    <>
      <Card title="Load state">
        {loaded ? (
          <h2 id={t.id('loaded-heading')} data-testid="loaded-heading">
            Navigation page loaded
          </h2>
        ) : (
          <p data-ui="hint" data-testid="loading-hint">
            Loading… (slow={slow} ms)
          </p>
        )}
        <p data-ui="hint">
          Add <code>?slow=3000</code> to delay the heading. Six small requests run during the first 2 s and a large image starts
          loading at 3 s, so DOMContentLoaded, load and network idle resolve at different times.
        </p>
        <p data-testid="late-status">
          Late requests done: {lateFetches} / 6 · Late image: {lateImgSrc ? 'requested' : 'not yet requested'}
        </p>
        <div style={{ width: 160, height: 90, background: 'var(--muted, #eee)', overflow: 'hidden' }}>
          {lateImgSrc ? (
            <img
              src={lateImgSrc}
              alt="Late image"
              data-testid="late-image"
              width={160}
              height={90}
              style={{ objectFit: 'cover' }}
              onLoad={() => merge({ lateImageLoaded: true })}
            />
          ) : null}
        </div>
      </Card>

      <Card title={t.v('Title and URL', 'URL and title')}>
        <div data-ui="inline">
          <button
            id={t.id(t.v('change-title', 'change-title-b'))}
            className={t.cls('btn nav__title')}
            data-testid="change-title"
            disabled={titlePending}
            onClick={() => {
              setTitlePending(true)
              setTimeout(() => {
                document.title = 'Title changed'
                setTitlePending(false)
                merge({ titleChanged: true, title: 'Title changed' })
              }, 2000)
            }}
          >
            Change title in 2s
          </button>
          <button
            id={t.id(t.v('go-step-two', 'go-step-two-b'))}
            className={t.cls('btn nav__url')}
            data-testid="go-step-two"
            disabled={urlPending}
            onClick={() => {
              setUrlPending(true)
              setTimeout(() => {
                const cur = locRef.current
                const next = new URLSearchParams(cur.search)
                next.set('step', '2')
                navigate({ pathname: cur.pathname, search: `?${next.toString()}` }, { state: cur.state })
                setUrlPending(false)
              }, 2000)
            }}
          >
            Go to step two in 2s
          </button>
        </div>
        <p data-testid="current-step">Current step: {step ?? '1'}</p>
      </Card>

      <Card title="History">
        <h2 data-testid="history-entry" id={t.id('history-entry')}>
          Entry {entry}
        </h2>
        <div data-ui="inline">
          <button id={t.id('push-entry')} className={t.cls('btn nav__push')} data-testid="push-entry" onClick={pushEntry}>
            Push history entry
          </button>
        </div>
        <p data-ui="hint">Each click adds a browser history entry. Back and Forward restore the entry number from the history state.</p>
      </Card>

      <Card title="Refresh">
        {t.v(null, <p data-ui="hint">Session counters (variant b)</p>)}
        <p data-testid="reload-count">Page loads in this session: {reloads}</p>
        <button
          id={t.id(t.v('reload-counter', 'reload-counter-b'))}
          className={t.cls('btn nav__counter')}
          data-testid="reload-counter"
          onClick={() => {
            const next = counter + 1
            sessionStorage.setItem(nsKey(config, 'nav_counter'), String(next))
            setCounter(next)
            merge({ counter: next })
          }}
        >
          Reload counter
        </button>{' '}
        <span data-testid="counter-value">Clicks kept across refresh: {counter}</span>
      </Card>

      <Card title="Long content">
        <p data-ui="hint">Tall content so that a full-page screenshot differs from a viewport screenshot.</p>
        {Array.from({ length: 12 }, (_, i) => (
          <div key={i} data-ui="card" style={{ height: 160 }}>
            Section {i + 1}
          </div>
        ))}
      </Card>
      <footer id={t.id('nav-footer')} className={t.cls('nav__footer')} data-testid="nav-footer" style={{ padding: '2rem 0', textAlign: 'center' }}>
        End of navigation page
      </footer>
    </>
  )
}
