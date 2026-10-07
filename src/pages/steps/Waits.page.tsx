import { useEffect, useRef, useState } from 'react'
import { Card, publicUrl } from '../../components/ui'
import { useConfig, useDelayed, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/waits',
  title: 'Waits',
  group: 'Step baselines',
  summary: 'Late text, a late button, a delayed image and staggered background requests for wait steps (fixed waits, element states, images loaded, network idle).',
  covers: [115, 116, 185, 348, 535, 597],
  order: 8,
  samples: [
    {
      id: 'W1',
      title: 'Wait for late text',
      steps: ['Navigate to <base>/steps/waits/', 'Wait until the text "Results ready" is present on the current page'],
      expected: 'The text appears after 2.5 s (or after renderDelay ms when set); state.resultsReady = true.',
    },
    {
      id: 'W2',
      title: 'Wait for a late button',
      steps: ['Wait untill "Late button" element is enabled', 'Click on "Late button"'],
      expected: 'Visible at 2 s, enabled at 4 s; state.lateButtonClicked = true.',
    },
    {
      id: 'W3',
      title: 'Fixed wait',
      steps: ['Wait for 3 seconds', 'Verify that the "Elapsed" text contains "s"'],
      expected: 'The elapsed clock shows at least 3 s.',
    },
    {
      id: 'W4',
      title: 'Images and network idle',
      steps: ['Wait until all images are loaded in the current page', 'Click on "Start background requests"', 'Wait until the current page network idle'],
      expected: 'state.imagesLoaded = 6 and state.requestsDone = 5.',
    },
  ],
}

const IMAGES = ['fixtures/avatar.png', 'fixtures/receipt.png', 'fixtures/front.png', 'fixtures/back.png', 'fixtures/avatar.png?copy=2', 'fixtures/receipt.png?delayed=1']
const REQUEST_DELAYS = [300, 800, 1300, 1900, 2500]

export default function WaitsPage() {
  const t = useTraps('waits')
  const config = useConfig()
  const { merge } = usePageState()
  const resultsReady = useDelayed(config.renderDelay > 0 ? config.renderDelay : 2500)
  const lateVisible = useDelayed(2000)
  const lateEnabled = useDelayed(4000)
  const delayedSrcReady = useDelayed(3000)
  const [elapsed, setElapsed] = useState(0)
  const [loadedSet, setLoadedSet] = useState<number[]>([])
  const [requests, setRequests] = useState({ started: 0, done: 0 })
  const startedAt = useRef(performance.now())

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Math.floor((performance.now() - startedAt.current) / 1000)), 250)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (resultsReady) merge({ resultsReady: true })
  }, [resultsReady, merge])

  const loadedRef = useRef<number[]>([])
  const markLoaded = (i: number) => {
    if (loadedRef.current.includes(i)) return
    loadedRef.current = [...loadedRef.current, i]
    setLoadedSet(loadedRef.current)
    merge({ imagesLoaded: loadedRef.current.length })
  }
  const doneRef = useRef(0)

  const startRequests = () => {
    doneRef.current = 0
    merge({ requestsStarted: REQUEST_DELAYS.length, requestsDone: 0 })
    setRequests({ started: REQUEST_DELAYS.length, done: 0 })
    REQUEST_DELAYS.forEach((ms, n) => {
      setTimeout(() => {
        const file = n % 2 ? 'fixtures/sample.csv' : 'fixtures/notes.txt'
        fetch(publicUrl(`${file}?r=${n + 1}`), { cache: 'no-store' })
          .then((r) => r.text())
          .then(() => {
            doneRef.current += 1
            setRequests({ started: REQUEST_DELAYS.length, done: doneRef.current })
            merge({ requestsDone: doneRef.current })
          })
          .catch(() => merge({ requestError: true }))
      }, ms)
    })
  }

  return (
    <>
      <Card title="Late content">
        <p data-testid="elapsed">
          <span id={t.id('elapsed-label')}>Elapsed</span>: <span aria-labelledby={t.id('elapsed-label')} data-testid="elapsed-value">{elapsed} s</span>
        </p>
        {resultsReady ? (
          <p data-testid="results-ready" id={t.id('results-ready')} className={t.cls('results')}>
            <strong>Results ready</strong>
          </p>
        ) : (
          <p data-ui="hint">Loading results…</p>
        )}
        <div data-ui="inline" style={{ minHeight: 40 }}>
          {t.v(null, <span data-ui="hint">Late control:</span>)}
          {lateVisible ? (
            <button
              id={t.id(t.v('late-button', 'late-button-b'))}
              className={t.cls('btn btn--late')}
              data-testid="late-button"
              disabled={!lateEnabled}
              onClick={() => merge({ lateButtonClicked: true })}
            >
              Late button
            </button>
          ) : null}
        </div>
        <p data-ui="hint">The button appears at 2 s and becomes enabled at 4 s.</p>
      </Card>

      <Card title={t.v('Images', 'Image gallery')}>
        <p data-testid="images-loaded">
          Images loaded: {loadedSet.length} / {IMAGES.length}
        </p>
        <div data-ui="inline">
          {IMAGES.map((src, i) => {
            const delayed = i === IMAGES.length - 1
            return (
              <img
                key={src}
                data-testid={`wait-image-${i + 1}`}
                alt={`Sample image ${i + 1}`}
                width={96}
                height={64}
                style={{ objectFit: 'cover', background: '#ccc' }}
                src={delayed && !delayedSrcReady ? undefined : publicUrl(src)}
                ref={(el) => {
                  if (el && el.getAttribute('src') && el.complete && el.naturalWidth > 0) markLoaded(i)
                }}
                onLoad={() => markLoaded(i)}
              />
            )
          })}
        </div>
        <p data-ui="hint">The last image gets its source after 3 s.</p>
      </Card>

      <Card title="Background requests">
        <button id={t.id('start-requests')} className={t.cls('btn btn--requests')} data-testid="start-requests" onClick={startRequests}>
          Start background requests
        </button>
        <p data-testid="requests-status">
          Requests done: {requests.done} / {requests.started}
        </p>
      </Card>
    </>
  )
}
