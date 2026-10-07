import { useEffect, useRef, useState } from 'react'
import { Card, publicUrl } from '../../components/ui'
import { API_BASE } from '../../core/backend'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useAfterMount, useStateLog } from './business/util'

export const meta: PageMeta = {
  path: '/errors',
  title: 'Console and network evidence',
  group: 'Scenarios',
  summary:
    'Produces known console messages, failing and slow network requests, an uncaught error, an unhandled promise rejection, a broken image and a broken link, so run evidence (console and network logs) can be checked against an exact list.',
  covers: [26, 467, 115, 535, 452, 583],
  order: 17,
  samples: [
    {
      id: 'E1',
      title: 'Console messages on load',
      steps: ['Navigate to <base>/errors/', 'Wait until the current page is loaded completely'],
      expected: 'The run console log has exactly the four load messages listed on the page (log, info, warn, error); state.loadLogged = 4.',
    },
    {
      id: 'E2',
      title: '404 request',
      steps: ['Click on "Trigger 404 request"', 'Wait until the text "404 request finished" is present on the current page'],
      expected: 'The network log shows GET fixtures/does-not-exist.json → 404; state.events has { event: "404", status: 404 }.',
    },
    {
      id: 'E3',
      title: '500 and slow request',
      steps: ['Click on "Trigger 500"', 'Click on "Trigger slow request"', 'Wait until the text "Slow request finished" is present on the current page'],
      expected: 'With a backend: GET /status/500 → 500 and GET /slow?ms=3000 takes ≥ 3 s. In local mode the 500 is simulated and logged as console.error "[tp] simulated 500 from /status/500".',
    },
    {
      id: 'E4',
      title: 'Uncaught error and unhandled rejection',
      steps: ['Click on "Throw uncaught error"', 'Click on "Unhandled promise rejection"'],
      expected: 'Console shows "Uncaught Error: Deliberate uncaught error" and "Uncaught (in promise) Error: Deliberate unhandled rejection"; state.events records both.',
    },
  ],
}

const LOAD_MESSAGES: [keyof Console & ('log' | 'info' | 'warn' | 'error'), string][] = [
  ['log', '[tp] errors page loaded'],
  ['info', '[tp] info: 3 widgets initialised'],
  ['warn', '[tp] warning: legacyFormat() is deprecated'],
  ['error', '[tp] error: optional widget "news-feed" failed to load'],
]

interface EventEntry {
  event: string
  status?: number
  ms?: number
  console?: string
  network?: string
}

export default function ErrorsPage() {
  const t = useTraps('errors')
  const { merge } = usePageState()
  const log = useStateLog<EventEntry>('events')
  const logged = useRef(false)
  const [status404, setStatus404] = useStateFlag()
  const [status500, setStatus500] = useStateFlag()
  const [slowDone, setSlowDone] = useStateFlag()

  useEffect(() => {
    if (logged.current) return
    logged.current = true
    for (const [level, msg] of LOAD_MESSAGES) console[level](msg)
  }, [])
  useAfterMount(() => merge({ loadLogged: LOAD_MESSAGES.length, backend: API_BASE ? 'remote' : 'local' }))

  useEffect(() => {
    const onError = (e: ErrorEvent) => log.append({ event: 'uncaught-error', console: `Uncaught ${e.message}` })
    const onRejection = (e: PromiseRejectionEvent) =>
      log.append({ event: 'unhandled-rejection', console: `Uncaught (in promise) ${e.reason instanceof Error ? e.reason.message : String(e.reason)}` })
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [log])

  const trigger404 = async () => {
    const url = publicUrl('fixtures/does-not-exist.json')
    // An explicit JSON accept header makes the dev server answer 404 instead of the SPA fallback.
    const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' }).catch(() => null)
    const status = res?.status ?? 0
    setStatus404(status)
    log.append({ event: '404', status, network: `GET ${url} → ${status}` })
  }

  const trigger500 = async () => {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/status/500`).catch(() => null)
      const status = res?.status ?? 0
      setStatus500(status)
      log.append({ event: '500', status, network: `GET ${API_BASE}/status/500 → ${status}` })
    } else {
      console.error('[tp] simulated 500 from /status/500')
      setStatus500(500)
      log.append({ event: '500', status: 500, console: '[tp] simulated 500 from /status/500', network: 'none (local simulation)' })
    }
  }

  const triggerSlow = async () => {
    const t0 = performance.now()
    let network: string
    if (API_BASE) {
      await fetch(`${API_BASE}/slow?ms=3000`).catch(() => null)
      network = `GET ${API_BASE}/slow?ms=3000`
    } else {
      await new Promise((r) => setTimeout(r, 3000))
      await fetch(publicUrl('fixtures/notes.txt'), { cache: 'no-store' }).catch(() => null)
      network = 'GET fixtures/notes.txt after a 3 s client-side delay (local simulation)'
    }
    const ms = Math.round(performance.now() - t0)
    setSlowDone(ms)
    log.append({ event: 'slow', ms, network })
  }

  return (
    <>
      <Card title="Console messages on load">
        <p>Exactly these four messages are logged once when the page loads:</p>
        <ol data-testid="load-messages">
          {LOAD_MESSAGES.map(([level, msg]) => (
            <li key={msg}>
              <code>console.{level}</code>: {msg}
            </li>
          ))}
        </ol>
      </Card>

      <Card title="Triggers">
        <div data-ui="inline">
          <button id={t.id(t.v('trigger-404', 'req-404'))} className={t.cls('err__404')} onClick={trigger404}>
            {t.v('Trigger 404 request', 'Send 404 request')}
          </button>
          <button id={t.id('trigger-500')} onClick={trigger500}>
            Trigger 500
          </button>
          <button id={t.id('trigger-slow')} onClick={triggerSlow}>
            {t.v('Trigger slow request', 'Send slow request')}
          </button>
          <button
            id={t.id('throw-error')}
            data-variant="danger"
            onClick={() => {
              setTimeout(() => {
                throw new Error('Deliberate uncaught error')
              }, 0)
            }}
          >
            Throw uncaught error
          </button>
          <button
            id={t.id('reject-promise')}
            data-variant="danger"
            onClick={() => {
              void Promise.reject(new Error('Deliberate unhandled rejection'))
            }}
          >
            Unhandled promise rejection
          </button>
        </div>
        <ul data-testid="trigger-results">
          {status404 !== null ? <li>404 request finished (status {status404})</li> : null}
          {status500 !== null ? <li>500 request finished (status {status500})</li> : null}
          {slowDone !== null ? <li>Slow request finished after {slowDone} ms</li> : null}
        </ul>
        {!API_BASE ? <p data-ui="hint">Backend not configured – showing local simulation for the 500 and slow requests.</p> : null}
      </Card>

      <Card title="Broken resources">
        <img
          src={publicUrl('fixtures/missing-image.png')}
          alt="Broken image"
          data-testid="broken-image"
          width={120}
          height={80}
          onError={() => merge({ brokenImage: true })}
          onLoad={() => merge({ brokenImage: false })}
        />
        <p>
          <a href={publicUrl('fixtures/missing-page.html')} id={t.id('broken-link')} onClick={() => merge({ brokenLinkClicked: true })}>
            Broken link
          </a>{' '}
          <span data-ui="hint">(404 on the deployed site; the dev server shows the app’s not-found page)</span>
        </p>
      </Card>
    </>
  )
}

function useStateFlag() {
  return useState<number | null>(null)
}
