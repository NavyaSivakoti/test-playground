// Global traps driven by the URL config: click-intercepting overlay, timed popups,
// a floating help widget and the "consoleError" functional bug.
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useConfig } from '../core/playground'
import { randFor } from '../core/rng'
import type { PopupKind } from '../core/config'

function useAfter(ms: number, key: string) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    setOn(false)
    const t = setTimeout(() => setOn(true), ms)
    return () => clearTimeout(t)
  }, [ms, key])
  return on
}

function Overlay({ ms, routeKey }: { ms: number; routeKey: string }) {
  const [visible, setVisible] = useState(true)
  const [intercepted, setIntercepted] = useState(0)
  useEffect(() => {
    setVisible(true)
    const t = setTimeout(() => setVisible(false), ms)
    return () => clearTimeout(t)
  }, [ms, routeKey])
  useEffect(() => {
    document.documentElement.dataset.tpInterceptedClicks = String(intercepted)
  }, [intercepted])
  if (!visible) return null
  return (
    <div
      data-ui="trap-overlay"
      data-testid="trap-overlay"
      aria-hidden="true"
      onClick={() => setIntercepted((n) => n + 1)}
    />
  )
}

function Popup({ kind, delay, routeKey }: { kind: PopupKind; delay: number; routeKey: string }) {
  const show = useAfter(delay, routeKey)
  const [closed, setClosed] = useState(false)
  useEffect(() => setClosed(false), [routeKey])
  if (!show || closed) return null
  const close = (choice: string) => {
    setClosed(true)
    document.documentElement.dataset[`tpPopup${kind[0].toUpperCase()}${kind.slice(1)}`] = choice
  }
  if (kind === 'cookie')
    return (
      <div data-ui="cookie-banner" role="region" aria-label="Cookie consent" data-testid="cookie-banner">
        <div style={{ flex: 1, minWidth: 220 }}>
          <strong>We value your privacy</strong>
          <div data-ui="hint">We use cookies to improve your experience. Choose which cookies you allow.</div>
        </div>
        <button onClick={() => close('rejected')}>Reject non-essential</button>
        <button onClick={() => close('settings')}>Cookie settings</button>
        <button data-variant="primary" onClick={() => close('accepted')}>Accept all</button>
      </div>
    )
  if (kind === 'gotit')
    return (
      <>
        <div data-ui="backdrop" />
        <div data-ui="modal" role="dialog" aria-modal="true" aria-labelledby="gotit-title" data-testid="gotit-popup">
          <h2 id="gotit-title" style={{ marginTop: 0 }}>New: smarter search</h2>
          <p>Search now understands natural language. Try “orders from last week”.</p>
          <button data-variant="primary" onClick={() => close('gotit')}>Got it</button>
        </div>
      </>
    )
  if (kind === 'promo')
    return (
      <>
        <div data-ui="backdrop" />
        <div data-ui="modal" role="dialog" aria-modal="true" aria-labelledby="promo-title" data-testid="promo-popup">
          <button aria-label="Close" data-variant="ghost" style={{ position: 'absolute', right: 8, top: 8 }} onClick={() => close('x')}>
            ✕
          </button>
          <h2 id="promo-title" style={{ marginTop: 0 }}>Get 20% off today</h2>
          <p>Upgrade to the annual plan before midnight.</p>
          <div data-ui="inline">
            <button onClick={() => close('nothanks')}>No thanks</button>
            <button data-variant="primary" onClick={() => close('upgrade')}>Upgrade</button>
          </div>
        </div>
      </>
    )
  return (
    <div data-ui="card" role="dialog" aria-label="Quick survey" data-testid="survey-popup" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 955, width: 300 }}>
      <strong>How are we doing?</strong>
      <div data-ui="inline" style={{ marginTop: 8 }}>
        <button onClick={() => close('later')}>Maybe later</button>
        <button data-variant="primary" onClick={() => close('rate')}>Rate us</button>
      </div>
    </div>
  )
}

export function GlobalTraps() {
  const config = useConfig()
  const location = useLocation()
  const routeKey = location.pathname + location.search

  useEffect(() => {
    if (config.bugs.includes('consoleError')) {
      // Deliberate functional bug: an uncaught-looking error on every page.
      console.error('TypeError: Cannot read properties of undefined (reading "total") at renderSummary (summary.ts:42)')
    }
  }, [config.bugs, routeKey])

  return (
    <>
      {config.overlay ? <Overlay ms={config.overlayMs} routeKey={routeKey} /> : null}
      {config.popups.map((kind) => {
        const delay = config.popupRandom
          ? 500 + Math.floor(randFor(config.seed, `popup:${kind}:${location.pathname}`) * 4500)
          : config.popupDelay
        return <Popup key={kind} kind={kind} delay={delay} routeKey={routeKey} />
      })}
      {config.stress ? (
        <div data-ui="help-widget" data-testid="help-widget" title="Help">
          ?
        </div>
      ) : null}
    </>
  )
}
