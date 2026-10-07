import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, publicUrl } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useAfterMount } from './business/util'

export const meta: PageMeta = {
  path: '/heavy',
  title: 'Heavy and slow pages',
  group: 'Scenarios',
  summary:
    'A very large DOM table, a multi-megabyte image, a section that appears only after ten seconds and a long-polling request that answers after eight seconds. Useful to tune waits and timeouts.',
  covers: [1, 115, 116, 185, 348, 535, 538, 565, 537, 186, 523],
  order: 15,
  samples: [
    {
      id: 'H1',
      title: 'Render a 10k-row table',
      steps: ['Navigate to <base>/heavy/', 'Click on "Render 10k rows"', 'Wait until the text "Row 10000" is present on the current page'],
      expected: 'state.renderedRows = 10000, state.domNodes > 40000 and state.renderMs is recorded.',
    },
    {
      id: 'H2',
      title: 'Autoload the table',
      query: 'autoload=1',
      steps: ['Wait until the current page is loaded completely', 'Scroll to bottom', 'Verify that the current page displays text "Row 10000"'],
      expected: 'state.autoload = true and state.renderedRows = 10000.',
    },
    {
      id: 'H3',
      title: 'Slow section',
      steps: ['Wait until the text "Slow section loaded" is present on the current page'],
      expected: 'Appears 10 s after load; with a default 5 s wait the step fails. state.slowSectionMs ≥ 10000.',
    },
    {
      id: 'H4',
      title: 'Long poll and heavy image',
      steps: ['Wait until all images are loaded in the current page', 'Wait until the text "Long poll returned 10 rows" is present on the current page'],
      expected: 'state.image.loaded = true (naturalWidth > 0); state.longPoll = { status: "done", rows: 10, ms ≥ 8000 }.',
    },
  ],
}

const ROWS = 10000

export default function HeavyPage() {
  const t = useTraps('heavy')
  const { merge } = usePageState()
  const [params] = useSearchParams()
  const autoload = params.get('autoload') === '1'
  const [show, setShow] = useState(false)
  const [slow, setSlow] = useState(false)
  const [poll, setPoll] = useState<'idle' | 'waiting' | 'done' | 'error'>('idle')
  const [pollRows, setPollRows] = useState(0)
  const started = useRef(0)
  const tableRef = useRef<HTMLTableElement>(null)
  const loadT0 = useRef(performance.now())
  const pollRun = useRef(0)
  const imgRef = useRef<HTMLImageElement>(null)

  const render = () => {
    started.current = performance.now()
    setShow(true)
  }

  useLayoutEffect(() => {
    if (!show || !tableRef.current) return
    const table = tableRef.current
    requestAnimationFrame(() => {
      const renderMs = Math.round(performance.now() - started.current)
      merge({ renderedRows: table.tBodies[0]?.rows.length ?? 0, domNodes: table.getElementsByTagName('*').length, renderMs })
    })
  }, [show, merge])

  const longPoll = () => {
    const run = ++pollRun.current
    const t0 = performance.now()
    setPoll('waiting')
    merge({ longPoll: { status: 'waiting' } })
    // The server holds the request for 8 s; simulated by delaying a fixture fetch.
    new Promise((r) => setTimeout(r, 8000))
      .then(() => fetch(publicUrl('fixtures/sample.csv'), { cache: 'no-store' }))
      .then((r) => r.text())
      .then((text) => {
        if (run !== pollRun.current) return
        const rows = text.trim().split('\n').length - 1
        setPollRows(rows)
        setPoll('done')
        merge({ longPoll: { status: 'done', rows, ms: Math.round(performance.now() - t0) } })
      })
      .catch(() => {
        setPoll('error')
        merge({ longPoll: { status: 'error' } })
      })
  }

  useAfterMount(() => {
    merge({ autoload, renderedRows: 0 })
    const img = imgRef.current
    if (img?.complete && img.naturalWidth > 0) merge({ image: { loaded: true, naturalWidth: img.naturalWidth, ms: 0, cached: true } })
    if (autoload) render()
    longPoll()
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlow(true)
      merge({ slowSectionMs: Math.round(performance.now() - loadT0.current) })
    }, 10000)
    return () => clearTimeout(timer)
  }, [merge])

  return (
    <>
      <Card title="Large table">
        <div data-ui="inline">
          <button id={t.id(t.v('render-rows', 'render-10k'))} className={t.cls('heavy__render')} disabled={show} onClick={render}>
            {t.v('Render 10k rows', 'Render 10,000 rows')}
          </button>
          <button
            id={t.id('clear-rows')}
            disabled={!show}
            onClick={() => {
              setShow(false)
              merge({ renderedRows: 0, domNodes: 0 })
            }}
          >
            Clear table
          </button>
        </div>
        <p data-ui="hint">Renders 10,000 rows × 4 cells (over 50,000 DOM nodes). Also rendered on load with autoload=1.</p>
        {show ? (
          <div style={{ maxHeight: 360, overflow: 'auto' }} data-testid="heavy-scroll">
            <table ref={tableRef} id={t.id('heavy-table')} data-testid="heavy-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: ROWS }, (_, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>Row {i + 1}</td>
                    <td>{((i * 7919) % 10000) / 100}</td>
                    <td>{i % 3 === 0 ? 'open' : i % 3 === 1 ? 'closed' : 'pending'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card title="Heavy image">
        <img
          ref={imgRef}
          src={publicUrl('fixtures/heavy.png')}
          alt="Heavy sample image"
          data-testid="heavy-image"
          style={{ maxWidth: '100%', height: 'auto', maxHeight: 280 }}
          onLoad={(e) =>
            merge({ image: { loaded: true, naturalWidth: e.currentTarget.naturalWidth, ms: Math.round(performance.now() - loadT0.current) } })
          }
          onError={() => merge({ image: { loaded: false } })}
        />
      </Card>

      <Card title="Long-polling request">
        <button id={t.id('long-poll')} disabled={poll === 'waiting'} onClick={longPoll}>
          Start long poll
        </button>
        <p role="status" data-testid="long-poll-status">
          {poll === 'waiting' ? 'Waiting for the server…' : poll === 'done' ? `Long poll returned ${pollRows} rows` : poll === 'error' ? 'Long poll failed' : 'Idle'}
        </p>
      </Card>

      <Card title="Slow section">
        {slow ? (
          <p data-testid="slow-section">Slow section loaded</p>
        ) : (
          <p data-ui="hint" data-testid="slow-pending">
            Loading… (takes 10 seconds)
          </p>
        )}
      </Card>
    </>
  )
}
