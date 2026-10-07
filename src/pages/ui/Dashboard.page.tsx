import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useSyncedState } from './part2State'
import { randFor } from '../../core/rng'

export const meta: PageMeta = {
  path: '/ui/dashboard',
  title: 'Analytics dashboard',
  group: 'General UI',
  summary:
    'KPI cards, a date-range filter that recomputes every widget, widgets that load at different speeds, an SVG chart and a canvas chart with hover tooltips, image export and a live-updating counter. All numbers are seeded.',
  order: 14,
  samples: [
    {
      id: 'D1',
      title: 'Wait for slow widgets',
      steps: ['Navigate to <base>/ui/dashboard/', 'Wait until the element "Revenue chart (canvas)" is visible', 'Verify that the "Revenue" displays text "$"'],
      expected: 'state.loadedWidgets = ["kpis","ordersChart","revenueChart"] (500 / 1500 / 3000 ms).',
    },
    {
      id: 'D2',
      title: 'Change the date range',
      steps: ['Select option by text "Last 30 days" in the list "Date range"'],
      expected: 'state.range.days = 30 and state.kpis changes (seeded); widgets reload with spinners first.',
    },
    {
      id: 'D3',
      title: 'Custom range',
      steps: ['Select option by text "Custom" in the list "Date range"', 'Enter 2026-03-01 in the "From" field', 'Enter 2026-03-10 in the "To" field'],
      expected: 'state.range = {key:"custom", from:"2026-03-01", to:"2026-03-10", days:10}.',
    },
    {
      id: 'D4',
      title: 'Export the canvas chart',
      steps: ['Click on "Export as image"'],
      expected: 'A PNG download named revenue-chart.png; state.exported = {name:"revenue-chart.png", size>0}.',
    },
    {
      id: 'D5',
      title: 'Live counter ticks',
      steps: ['Wait for 5 seconds', 'Verify that the "Active users now" is visible'],
      expected: 'state.activeUsers.tick ≥ 2; the value for a given seed and tick is always the same.',
    },
  ],
}

type RangeKey = '7' | '30' | 'custom'
const DAY = 86400000

interface Kpis {
  revenue: number
  orders: number
  customers: number
  conversion: number
}

function series(seed: number, key: string, days: number) {
  return Array.from({ length: days }, (_, i) => ({
    day: i + 1,
    orders: 20 + Math.floor(randFor(seed, `orders:${key}:${i}`) * 60),
    revenue: 800 + Math.round(randFor(seed, `rev:${key}:${i}`) * 2400),
  }))
}

const money = (n: number) => `$${n.toLocaleString('en-US')}`

function Spinner({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} data-testid="widget-spinner" style={{ padding: 16 }}>
      <span aria-hidden="true" style={{ display: 'inline-block', width: 16, height: 16, border: '3px solid rgba(127,127,127,.3)', borderTopColor: 'currentColor', borderRadius: '50%', animation: 'tp-spin 0.8s linear infinite' }} /> Loading…
    </div>
  )
}

export default function DashboardPage() {
  const t = useTraps('dashboard')
  const { state, merge } = usePageState()
  const seed = t.config.seed
  const [rangeKey, setRangeKey] = useState<RangeKey>('7')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [refreshes, setRefreshes] = useState(0)

  const days = useMemo(() => {
    if (rangeKey !== 'custom') return Number(rangeKey)
    const a = Date.parse(from)
    const b = Date.parse(to)
    if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0
    return Math.min(90, Math.round((b - a) / DAY) + 1)
  }, [rangeKey, from, to])
  const dataKey = rangeKey === 'custom' ? `custom:${from}:${to}` : rangeKey
  const data = useMemo(() => series(seed, dataKey, days), [seed, dataKey, days])
  const kpis: Kpis = useMemo(() => {
    const revenue = data.reduce((s, d) => s + d.revenue, 0)
    const orders = data.reduce((s, d) => s + d.orders, 0)
    const customers = Math.round(orders * (0.6 + randFor(seed, `cust:${dataKey}`) * 0.3))
    const visits = orders * (20 + Math.floor(randFor(seed, `visits:${dataKey}`) * 20))
    const conversion = visits ? Math.round((orders / visits) * 10000) / 100 : 0
    return { revenue, orders, customers, conversion }
  }, [data, seed, dataKey])

  // ---------- staggered widget loading ----------
  const [loaded, setLoaded] = useState<string[]>([])
  useEffect(() => {
    setLoaded([])
    merge({ loadedWidgets: [] })
    const timers = (
      [
        ['kpis', 500],
        ['ordersChart', 1500],
        ['revenueChart', 3000],
      ] as const
    ).map(([w, ms]) =>
      setTimeout(() => {
        setLoaded((l) => {
          const n = l.includes(w) ? l : [...l, w]
          merge({ loadedWidgets: n })
          return n
        })
      }, ms),
    )
    return () => timers.forEach(clearTimeout)
  }, [dataKey, days, refreshes, merge])

  useSyncedState({ range: { key: rangeKey, days, ...(rangeKey === 'custom' ? { from, to } : {}) }, kpis })

  // ---------- live counter ----------
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const h = setInterval(() => setTick((x) => x + 1), 2000)
    return () => clearInterval(h)
  }, [])
  const activeUsers = 100 + Math.floor(randFor(seed, `active:${tick}`) * 50)
  useSyncedState({ activeUsers: { tick, value: activeUsers } })

  // ---------- svg chart hover ----------
  const [svgHover, setSvgHover] = useState<{ day: number; orders: number; x: number } | null>(null)

  // ---------- canvas chart ----------
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [canvasHover, setCanvasHover] = useState<{ day: number; revenue: number; x: number; y: number } | null>(null)
  const W = 480
  const H = 200
  const maxRev = Math.max(1, ...data.map((d) => d.revenue))
  const pt = (i: number, rev: number) => ({
    x: data.length <= 1 ? W / 2 : 20 + (i * (W - 40)) / (data.length - 1),
    y: H - 20 - (rev / maxRev) * (H - 40),
  })
  const revenueLoaded = loaded.includes('revenueChart')
  useEffect(() => {
    if (!revenueLoaded) return
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
    ctx.strokeStyle = '#999'
    ctx.beginPath()
    ctx.moveTo(20, H - 20)
    ctx.lineTo(W - 20, H - 20)
    ctx.stroke()
    ctx.strokeStyle = '#1565c0'
    ctx.lineWidth = 2
    ctx.beginPath()
    data.forEach((d, i) => {
      const p = pt(i, d.revenue)
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
    ctx.fillStyle = '#1565c0'
    data.forEach((d, i) => {
      const p = pt(i, d.revenue)
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2)
      ctx.fill()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revenueLoaded, data])

  const exportImage = () => {
    const cv = canvasRef.current
    if (!cv) return
    cv.toBlob((blob) => {
      if (!blob) {
        merge({ exported: { error: 'toBlob returned null' } })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'revenue-chart.png'
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      merge({ exported: { name: 'revenue-chart.png', size: blob.size, type: blob.type } })
    }, 'image/png')
  }

  const kpiCards: { key: keyof Kpis; label: string; value: string }[] = [
    { key: 'revenue', label: 'Revenue', value: money(kpis.revenue) },
    { key: 'orders', label: 'Orders', value: kpis.orders.toLocaleString('en-US') },
    { key: 'customers', label: 'Customers', value: kpis.customers.toLocaleString('en-US') },
    { key: 'conversion', label: 'Conversion', value: `${kpis.conversion}%` },
  ]
  const orderedKpis = t.v(kpiCards, [kpiCards[1], kpiCards[0], kpiCards[3], kpiCards[2]])
  const maxOrders = Math.max(1, ...data.map((d) => d.orders))
  const barW = data.length ? (W - 40) / data.length : 0

  return (
    <>
      <style>{'@keyframes tp-spin { to { transform: rotate(360deg) } }'}</style>
      <Card title="Filters">
        <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
          <label data-ui="field">
            <span>Date range</span>
            <select id={t.id('date-range')} value={rangeKey} onChange={(e) => setRangeKey(e.target.value as RangeKey)}>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="custom">Custom</option>
            </select>
          </label>
          {rangeKey === 'custom' ? (
            <>
              <label data-ui="field">
                <span>From</span>
                <input type="date" id={t.id('range-from')} value={from} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label data-ui="field">
                <span>To</span>
                <input type="date" id={t.id('range-to')} value={to} onChange={(e) => setTo(e.target.value)} />
              </label>
            </>
          ) : null}
          <button
            id={t.id(t.v('refresh', 'reload-data'))}
            className={t.cls('btn btn--refresh')}
            onClick={() => {
              setRefreshes((r) => r + 1)
              merge({ refreshes: ((state.refreshes as number) ?? 0) + 1 })
            }}
          >
            {t.v('Refresh', 'Reload data')}
          </button>
          <span data-testid="active-users" aria-label="Active users now" role="status">
            Active users now: <strong>{activeUsers}</strong>
          </span>
        </div>
        {rangeKey === 'custom' && days === 0 ? <p data-ui="error">Choose a valid From and To date.</p> : null}
      </Card>

      <section data-ui="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }} aria-label="KPIs">
        {loaded.includes('kpis')
          ? orderedKpis.map((k) => (
              <div key={k.key} data-ui="card" data-testid={`kpi-${k.key}`} id={t.id(`kpi-${k.key}`)} aria-label={k.label} role="group">
                <div data-ui="hint">{k.label}</div>
                <div style={{ fontSize: 24, fontWeight: 600 }}>{k.value}</div>
              </div>
            ))
          : <Spinner label="KPIs" />}
      </section>

      <Card title="Orders per day">
        {loaded.includes('ordersChart') ? (
          <div style={{ position: 'relative', maxWidth: W }}>
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Orders chart (SVG)" data-testid="orders-chart" onMouseLeave={() => setSvgHover(null)}>
              <line x1={20} y1={H - 20} x2={W - 20} y2={H - 20} stroke="#999" />
              {data.map((d, i) => {
                const h = (d.orders / maxOrders) * (H - 40)
                return (
                  <rect
                    key={d.day}
                    data-day={d.day}
                    x={20 + i * barW + 1}
                    y={H - 20 - h}
                    width={Math.max(1, barW - 2)}
                    height={h}
                    fill={svgHover?.day === d.day ? '#e65100' : '#2e7d32'}
                    onMouseEnter={() => {
                      setSvgHover({ day: d.day, orders: d.orders, x: 20 + i * barW })
                      merge({ svgHover: { day: d.day, orders: d.orders } })
                    }}
                  >
                    <title>{`Day ${d.day}: ${d.orders} orders`}</title>
                  </rect>
                )
              })}
            </svg>
            {svgHover ? (
              <div data-ui="popover" role="tooltip" data-testid="svg-tooltip" style={{ position: 'absolute', top: 0, left: `${(svgHover.x / W) * 100}%` }}>
                Day {svgHover.day}: {svgHover.orders} orders
              </div>
            ) : null}
          </div>
        ) : (
          <Spinner label="orders chart" />
        )}
      </Card>

      <Card title="Revenue per day">
        {revenueLoaded ? (
          <>
            <div style={{ position: 'relative', maxWidth: W }}>
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                role="img"
                aria-label="Revenue chart (canvas)"
                data-testid="revenue-chart"
                style={{ width: '100%', maxWidth: W, border: '1px solid rgba(127,127,127,.3)' }}
                onMouseLeave={() => setCanvasHover(null)}
                onMouseMove={(e) => {
                  if (!data.length) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const x = ((e.clientX - rect.left) / rect.width) * W
                  let best = 0
                  data.forEach((_, i) => {
                    if (Math.abs(pt(i, 0).x - x) < Math.abs(pt(best, 0).x - x)) best = i
                  })
                  const d = data[best]
                  const p = pt(best, d.revenue)
                  if (canvasHover?.day !== d.day) {
                    setCanvasHover({ day: d.day, revenue: d.revenue, x: p.x, y: p.y })
                    merge({ canvasHover: { day: d.day, revenue: d.revenue } })
                  }
                }}
              />
              {canvasHover ? (
                <div
                  data-ui="popover"
                  role="tooltip"
                  data-testid="canvas-tooltip"
                  style={{ position: 'absolute', left: `${(canvasHover.x / W) * 100}%`, top: `${(canvasHover.y / H) * 100}%`, pointerEvents: 'none' }}
                >
                  Day {canvasHover.day}: {money(canvasHover.revenue)}
                </div>
              ) : null}
            </div>
            <button id={t.id('export-image')} className={t.cls('btn btn--export')} onClick={exportImage} style={{ marginTop: 8 }}>
              {t.v('Export as image', 'Download PNG')}
            </button>
          </>
        ) : (
          <Spinner label="revenue chart" />
        )}
      </Card>
    </>
  )
}
