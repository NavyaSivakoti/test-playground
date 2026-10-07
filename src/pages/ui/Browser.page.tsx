import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Badge, Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useSyncedState } from './part2State'

export const meta: PageMeta = {
  path: '/ui/browser',
  title: 'Browser APIs',
  group: 'General UI',
  summary:
    'Geolocation, notifications, clipboard, print, fullscreen, document title, hash routing, history, online/offline and page visibility, each with a non-blocking fallback and its result in the observable state.',
  order: 11,
  samples: [
    {
      id: 'B1',
      title: 'Location with fallback',
      steps: [
        'Navigate to <base>/ui/browser/',
        'Click on "Get my location"',
        'Select option by text "Lisbon" in the list "Fallback city"',
      ],
      expected: 'state.geo.status is "granted" (coords shown) or "denied" ("Location permission denied" shown); state.city = "Lisbon" either way.',
    },
    {
      id: 'B2',
      title: 'Copy and paste through the clipboard',
      steps: ['Enter Hello Ada in the "Text to copy" field', 'Click on "Copy text"', 'Click on "Paste from clipboard"', 'Verify that the "Pasted text" displays text "Hello Ada"'],
      expected: 'state.clipboard = {written:"Hello Ada", read:"Hello Ada"} (needs clipboard permission).',
    },
    {
      id: 'B3',
      title: 'Update the document title',
      steps: ['Enter Release notes in the "New page title" field', 'Click on "Update title"', 'Verify that the page title is "Release notes"'],
      expected: 'state.documentTitle = "Release notes" and document.title matches.',
    },
    {
      id: 'B4',
      title: 'Hash router section',
      steps: ['Click on "Go to section 2"', 'Verify that the current page displays text "Section 2 content"'],
      expected: 'URL ends with #section-2 and state.hash = "#section-2".',
    },
    {
      id: 'B5',
      title: 'Simulated offline banner',
      steps: ['Click on "Simulate offline"', 'Verify that the current page displays text "You are offline"'],
      expected: 'state.simulatedOffline = true and state.effectiveOnline = false.',
    },
    {
      id: 'B6',
      title: 'Print records the request',
      steps: ['Click on "Print page"'],
      expected: 'state.printed = 1 (the print dialog itself is outside the page).',
    },
  ],
}

const CITIES = ['Lisbon', 'Nairobi', 'Oslo', 'Montreal', 'Kyoto']

export default function BrowserPage() {
  const t = useTraps('browser')
  const { state, merge } = usePageState()
  const location = useLocation()

  // ---------- geolocation ----------
  const [geo, setGeo] = useState<{ status: string; lat?: number; lon?: number; message?: string } | null>(null)
  const getLocation = () => {
    if (!('geolocation' in navigator)) {
      const g = { status: 'unsupported', message: 'Geolocation is not supported' }
      setGeo(g)
      merge({ geo: g })
      return
    }
    setGeo({ status: 'pending' })
    merge({ geo: { status: 'pending' } })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const g = { status: 'granted', lat: Number(pos.coords.latitude.toFixed(4)), lon: Number(pos.coords.longitude.toFixed(4)), accuracy: Math.round(pos.coords.accuracy) }
        setGeo(g)
        merge({ geo: g })
      },
      (err) => {
        const g = { status: err.code === err.PERMISSION_DENIED ? 'denied' : 'error', code: err.code, message: err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Location unavailable' }
        setGeo(g)
        merge({ geo: g })
      },
      { timeout: 5000 },
    )
  }

  // ---------- notifications ----------
  const supportsNotif = typeof Notification !== 'undefined'
  const [notifPerm, setNotifPerm] = useState<string>(supportsNotif ? Notification.permission : 'unsupported')
  const requestNotif = async () => {
    if (!supportsNotif) {
      merge({ notificationPermission: 'unsupported' })
      return
    }
    try {
      const p = await Notification.requestPermission()
      setNotifPerm(p)
      merge({ notificationPermission: p })
    } catch {
      merge({ notificationPermission: 'error' })
    }
  }
  const sendNotif = () => {
    if (!supportsNotif || Notification.permission !== 'granted') {
      merge({ notificationSent: false, notificationBlockedReason: supportsNotif ? Notification.permission : 'unsupported' })
      return
    }
    try {
      new Notification('Test Playground', { body: 'This is a test notification' })
      merge({ notificationSent: true, notificationBlockedReason: null })
    } catch (e) {
      merge({ notificationSent: false, notificationBlockedReason: String(e).slice(0, 80) })
    }
  }

  // ---------- clipboard ----------
  const [copyText, setCopyText] = useState('Hello from Test Playground')
  const [pasted, setPasted] = useState<string | null>(null)
  const clip = (state.clipboard as Record<string, unknown> | undefined) ?? {}

  // ---------- fullscreen ----------
  const fsRef = useRef<HTMLDivElement>(null)
  const [isFs, setIsFs] = useState(false)
  useEffect(() => {
    const on = () => {
      const fs = document.fullscreenElement === fsRef.current && !!fsRef.current
      setIsFs(fs)
      merge({ fullscreen: fs })
    }
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [merge])
  const toggleFs = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen()
      else await fsRef.current?.requestFullscreen()
      merge({ fullscreenError: null })
    } catch (e) {
      merge({ fullscreenError: String(e).slice(0, 80) })
    }
  }

  // ---------- document title ----------
  const [title, setTitle] = useState('')
  useEffect(() => {
    const original = document.title
    return () => {
      document.title = original
    }
  }, [])

  // ---------- hash router ----------
  const [hash, setHash] = useState(typeof window !== 'undefined' ? window.location.hash : '')
  useEffect(() => {
    const on = () => {
      setHash(window.location.hash)
      merge({ hash: window.location.hash })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [merge])
  useEffect(() => {
    // react-router also notices fragment navigation
    if (location.hash !== hash) {
      setHash(location.hash)
      if (location.hash) merge({ hash: location.hash })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash])

  // ---------- history ----------
  const [histLen, setHistLen] = useState(window.history.length)
  useEffect(() => {
    const on = (e: PopStateEvent) => {
      const step = (e.state as { demoStep?: number } | null)?.demoStep ?? null
      setHistLen(window.history.length)
      merge({ history: { lastEvent: 'popstate', step, length: window.history.length } })
    }
    window.addEventListener('popstate', on)
    return () => window.removeEventListener('popstate', on)
  }, [merge])
  const pushStep = () => {
    const step = (((state.history as { pushes?: number } | undefined)?.pushes ?? 0) as number) + 1
    const url = new URL(window.location.href)
    url.searchParams.set('demoStep', String(step))
    // keep react-router's own history entry fields so back/forward still works
    window.history.pushState({ ...(window.history.state ?? {}), demoStep: step }, '', url.toString())
    setHistLen(window.history.length)
    merge({ history: { lastEvent: 'pushState', step, pushes: step, length: window.history.length, url: url.pathname + url.search } })
  }

  // ---------- online / offline ----------
  const [online, setOnline] = useState(navigator.onLine)
  const [simOffline, setSimOffline] = useState(false)
  useEffect(() => {
    const on = () => {
      setOnline(navigator.onLine)
      merge({ online: navigator.onLine, lastNetworkEvent: navigator.onLine ? 'online' : 'offline' })
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [merge])
  const effectiveOnline = online && !simOffline
  useSyncedState({ online, effectiveOnline, visibility: document.visibilityState })

  // ---------- visibility ----------
  const [visibility, setVisibility] = useState(document.visibilityState)
  const visChanges = useRef(0)
  useEffect(() => {
    const on = () => {
      visChanges.current += 1
      setVisibility(document.visibilityState)
      merge({ visibility: document.visibilityState, visibilityChanges: visChanges.current })
    }
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [merge])

  // ---------- print ----------
  useEffect(() => {
    const before = () => merge({ printEvent: 'beforeprint' })
    const after = () => merge({ printEvent: 'afterprint' })
    window.addEventListener('beforeprint', before)
    window.addEventListener('afterprint', after)
    return () => {
      window.removeEventListener('beforeprint', before)
      window.removeEventListener('afterprint', after)
    }
  }, [merge])

  const city = (state.city as string | undefined) ?? ''

  return (
    <>
      {!effectiveOnline ? (
        <div data-ui="card" data-tone="warning" role="alert" data-testid="offline-banner">
          You are offline. Changes will sync when the connection returns.
        </div>
      ) : null}

      <Card title="Geolocation">
        <p data-ui="hint">Never blocks: if permission is denied, pick a city instead.</p>
        <button id={t.id('get-location')} className={t.cls('btn btn--geo')} data-testid="get-location" onClick={getLocation}>
          {t.v('Get my location', 'Use my current location')}
        </button>
        <div data-testid="geo-result" style={{ marginTop: 6 }}>
          {geo?.status === 'granted' ? `Latitude ${geo.lat}, Longitude ${geo.lon}` : null}
          {geo?.status === 'pending' ? 'Locating…' : null}
          {geo && geo.status !== 'granted' && geo.status !== 'pending' ? <span data-ui="error">{geo.message}</span> : null}
        </div>
        <label data-ui="field" style={{ maxWidth: 260 }}>
          <span>Fallback city</span>
          <select id={t.id('fallback-city')} value={city} onChange={(e) => merge({ city: e.target.value })}>
            <option value="">Choose a city…</option>
            {t.shuffle(CITIES, 'cities').map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      </Card>

      <Card title="Notifications">
        <div data-ui="inline">
          <button id={t.id('request-notification')} className={t.cls('btn')} onClick={requestNotif}>
            Request notification permission
          </button>
          <button id={t.id('send-notification')} className={t.cls('btn')} onClick={sendNotif}>
            Send test notification
          </button>
          <Badge tone={notifPerm === 'granted' ? 'success' : notifPerm === 'denied' ? 'danger' : 'info'} data-testid="notification-permission">
            Permission: {notifPerm}
          </Badge>
        </div>
        {state.notificationSent === false ? <p data-ui="hint">Notification not shown ({String(state.notificationBlockedReason)}).</p> : null}
        {state.notificationSent === true ? <p data-ui="hint">Notification sent.</p> : null}
      </Card>

      <Card title="Clipboard">
        <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
          <label data-ui="field">
            <span>Text to copy</span>
            <input id={t.id('copy-source')} value={copyText} onChange={(e) => setCopyText(e.target.value)} />
          </label>
          <button
            id={t.id('copy-text')}
            className={t.cls('btn btn--copy')}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(copyText)
                merge({ clipboard: { ...clip, written: copyText, writeError: null } })
              } catch (e) {
                merge({ clipboard: { ...clip, writeError: String(e).slice(0, 80) } })
              }
            }}
          >
            {t.v('Copy text', 'Copy')}
          </button>
          <button
            id={t.id('paste-text')}
            className={t.cls('btn btn--paste')}
            onClick={async () => {
              try {
                const txt = await navigator.clipboard.readText()
                setPasted(txt)
                merge({ clipboard: { ...clip, read: txt, readError: null } })
              } catch (e) {
                setPasted(null)
                merge({ clipboard: { ...clip, readError: String(e).slice(0, 80) } })
              }
            }}
          >
            Paste from clipboard
          </button>
        </div>
        <div style={{ marginTop: 6 }}>
          Pasted text: <output aria-label="Pasted text" data-testid="pasted-text">{pasted ?? ''}</output>
        </div>
        {clip.readError ? <p data-ui="error">Clipboard read blocked: {String(clip.readError)}</p> : null}
      </Card>

      <Card title="Print and fullscreen">
        <div data-ui="inline">
          <button
            id={t.id('print-page')}
            className={t.cls('btn btn--print')}
            onClick={() => {
              merge({ printed: ((state.printed as number) ?? 0) + 1 })
              setTimeout(() => window.print(), 50)
            }}
          >
            Print page
          </button>
          <button id={t.id('toggle-fullscreen')} className={t.cls('btn btn--fullscreen')} onClick={toggleFs}>
            {isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
          </button>
        </div>
        <div ref={fsRef} data-testid="fullscreen-box" style={{ marginTop: 8, padding: 12, border: '1px dashed currentColor', background: 'var(--bg, #fff)' }}>
          {isFs ? (
            <>
              <strong>Fullscreen mode</strong>
              <div>
                <button onClick={toggleFs}>Leave fullscreen</button>
              </div>
            </>
          ) : (
            'This box goes fullscreen.'
          )}
        </div>
      </Card>

      <Card title="Document title">
        <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
          <label data-ui="field">
            <span>New page title</span>
            <input id={t.id('new-title')} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <button
            id={t.id('update-title')}
            className={t.cls('btn btn--title')}
            onClick={() => {
              document.title = title
              merge({ documentTitle: document.title })
            }}
          >
            Update title
          </button>
        </div>
      </Card>

      <Card title="Hash router">
        <nav data-ui="inline" aria-label="Hash sections">
          <a href="#section-1" id={t.id('hash-1')} className={t.cls('link link--hash')}>
            Go to section 1
          </a>
          <a href="#section-2" id={t.id('hash-2')} className={t.cls('link link--hash')}>
            Go to section 2
          </a>
        </nav>
        <div data-testid="hash-view" style={{ marginTop: 6 }}>
          {hash === '#section-1' ? 'Section 1 content' : hash === '#section-2' ? 'Section 2 content' : 'No section selected'}
        </div>
      </Card>

      <Card title="History API">
        <div data-ui="inline">
          <button id={t.id('push-state')} className={t.cls('btn btn--push')} onClick={pushStep}>
            {t.v('Push history entry', 'Add history entry')}
          </button>
          <button id={t.id('history-back')} className={t.cls('btn')} onClick={() => window.history.back()}>
            History back
          </button>
          <span data-testid="history-length">History length: {histLen}</span>
        </div>
      </Card>

      <Card title="Connection and visibility">
        <div data-ui="inline">
          <Badge tone={effectiveOnline ? 'success' : 'danger'} data-testid="online-status">
            {effectiveOnline ? 'Online' : 'Offline'}
          </Badge>
          <label>
            <input
              type="checkbox"
              id={t.id('simulate-offline')}
              checked={simOffline}
              onChange={(e) => {
                setSimOffline(e.target.checked)
                merge({ simulatedOffline: e.target.checked })
              }}
            />{' '}
            Simulate offline
          </label>
          <span data-testid="visibility-state">Page visibility: {visibility}</span>
        </div>
      </Card>
    </>
  )
}
