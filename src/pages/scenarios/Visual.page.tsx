import { useEffect, useMemo, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useMountMerge } from './advanced/util'

export const meta: PageMeta = {
  path: '/visual',
  title: 'Canvas, charts and visual state',
  group: 'Scenarios',
  summary:
    'Charts drawn on canvas and in SVG with hover tooltips, a canvas map with clickable regions, a signature pad and cards whose selection is shown only by colour. Variant b shifts the layout for screenshot comparison.',
  order: 24,
  samples: [
    {
      id: 'VI1',
      title: 'Click a map region',
      steps: ['Navigate to <base>/visual/', 'AI Agent Click on the region labelled "East" on the map', 'AI Verification: the East region of the map is highlighted'],
      expected: 'state.region = "East". A plain "Click on \\"East\\"" step fails: the regions are pixels, not elements.',
    },
    {
      id: 'VI2',
      title: 'Bar chart tooltip',
      steps: ['AI Agent Hover over the tallest bar of the bar chart', 'AI Verification: a tooltip with the month and value is shown on the chart'],
      expected: 'state.hoveredBar = { label, value } of the bar under the mouse (values depend on the seed).',
    },
    {
      id: 'VI3',
      title: 'Selection visible only by colour',
      steps: ['Click on "Standard"', 'AI Verification: the Standard plan card has a highlighted border'],
      expected: 'state.selectedCard = "Standard"; no text or aria attribute changes, only border and background colour.',
    },
    {
      id: 'VI4',
      title: 'Signature pad',
      steps: ['AI Agent Draw a signature on the signature pad', 'Click on "Clear"'],
      expected: 'state.strokes ≥ 1 after drawing, then state.strokes = 0 and state.signed = false after Clear.',
    },
    {
      id: 'VI5',
      title: 'Screenshot drift',
      query: 'variant=b',
      steps: ['Navigate to <base>/visual/?variant=b', 'Take full page screenshot with URL'],
      expected: 'Visual comparison against variant a shows moved sections, different bar colours and shifted cards.',
    },
  ],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']
const REGIONS = ['North', 'East', 'South', 'West'] as const
type Region = (typeof REGIONS)[number]

function canvasPoint(e: React.PointerEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>) {
  const c = e.currentTarget
  const r = c.getBoundingClientRect()
  return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }
}

function regionAt(x: number, y: number): Region {
  const dx = (x - 200) / 200
  const dy = (y - 150) / 150
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'North' : 'South'
  return dx < 0 ? 'West' : 'East'
}

export default function VisualPage() {
  const t = useTraps('visual')
  const { merge } = usePageState()
  const b = t.config.variant === 'b'
  const values = useMemo(() => MONTHS.map((_, i) => 20 + Math.floor(t.rand(`bar:${i}`) * 80)), [t])
  const weekly = useMemo(() => Array.from({ length: 8 }, (_, i) => 10 + Math.floor(t.rand(`line:${i}`) * 90)), [t])
  const [hoverBar, setHoverBar] = useState<number | null>(null)
  const [hoverPoint, setHoverPoint] = useState<number | null>(null)
  const [region, setRegion] = useState<Region | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [strokes, setStrokes] = useState(0)
  const barRef = useRef<HTMLCanvasElement>(null)
  const mapRef = useRef<HTMLCanvasElement>(null)
  const sigRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef<{ points: number } | null>(null)
  const totalPoints = useRef(0)

  useMountMerge(() => ({ barValues: values, hoveredBar: null, region: null, strokes: 0, selectedCard: null }))

  // bar layout (variant b shifts it)
  const barX = (i: number) => (b ? 80 + i * 84 : 50 + i * 90)
  const BAR_W = b ? 50 : 60
  const barTop = (v: number) => 260 - v * 2.3

  useEffect(() => {
    const ctx = barRef.current?.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, 600, 300)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, 600, 300)
    ctx.strokeStyle = '#9aa3b8'
    ctx.beginPath()
    ctx.moveTo(40, 260)
    ctx.lineTo(590, 260)
    ctx.stroke()
    values.forEach((v, i) => {
      ctx.fillStyle = hoverBar === i ? '#1e3a8a' : b ? '#7c3aed' : '#3554d1'
      ctx.fillRect(barX(i), barTop(v), BAR_W, v * 2.3)
      ctx.fillStyle = '#1c2333'
      ctx.font = '13px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(MONTHS[i], barX(i) + BAR_W / 2, 278)
    })
    if (hoverBar !== null) {
      const v = values[hoverBar]
      const label = `${MONTHS[hoverBar]}: ${v}`
      const x = Math.min(500, barX(hoverBar) - 10)
      const y = Math.max(8, barTop(v) - 38)
      ctx.fillStyle = '#111827'
      ctx.beginPath()
      ctx.roundRect(x, y, 90, 28, 6)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = '600 14px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(label, x + 45, y + 19)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, hoverBar, b])

  useEffect(() => {
    const ctx = mapRef.current?.getContext('2d')
    if (!ctx) return
    const tri: Record<Region, [number, number][]> = {
      North: [
        [0, 0],
        [400, 0],
        [200, 150],
      ],
      East: [
        [400, 0],
        [400, 300],
        [200, 150],
      ],
      South: [
        [0, 300],
        [400, 300],
        [200, 150],
      ],
      West: [
        [0, 0],
        [0, 300],
        [200, 150],
      ],
    }
    const centre: Record<Region, [number, number]> = { North: [200, 50], East: [335, 155], South: [200, 255], West: [65, 155] }
    const base: Record<Region, string> = { North: '#dbeafe', East: '#dcfce7', South: '#fef3c7', West: '#fce7f3' }
    for (const r of REGIONS) {
      ctx.fillStyle = region === r ? '#3554d1' : base[r]
      ctx.beginPath()
      tri[r].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
      ctx.closePath()
      ctx.fill()
      ctx.strokeStyle = '#ffffff'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.fillStyle = region === r ? '#ffffff' : '#1c2333'
      ctx.font = '600 18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(r, centre[r][0], centre[r][1])
    }
  }, [region])

  const clearSig = () => {
    const ctx = sigRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, 400, 160)
    totalPoints.current = 0
    setStrokes(0)
    merge({ strokes: 0, signaturePoints: 0, signed: false, cleared: true })
  }

  const barCard = (
    <Card title="Monthly orders (canvas)" key="bar">
      <canvas
        ref={barRef}
        width={600}
        height={300}
        data-testid="bar-chart"
        aria-label="Bar chart of monthly orders"
        role="img"
        style={{ maxWidth: '100%', border: '1px solid var(--border)', borderRadius: 8 }}
        onMouseMove={(e) => {
          const { x, y } = canvasPoint(e)
          const i = values.findIndex((v, j) => x >= barX(j) && x <= barX(j) + BAR_W && y >= barTop(v) && y <= 260)
          const next = i >= 0 ? i : null
          if (next !== hoverBar) {
            setHoverBar(next)
            merge({ hoveredBar: next === null ? null : { index: next, label: MONTHS[next], value: values[next] } })
          }
        }}
        onMouseLeave={() => {
          setHoverBar(null)
          merge({ hoveredBar: null })
        }}
        onClick={() => hoverBar !== null && merge({ clickedBar: MONTHS[hoverBar] })}
      >
        Bar chart: {MONTHS.map((m, i) => `${m} ${values[i]}`).join(', ')}
      </canvas>
    </Card>
  )

  const mapCard = (
    <Card title="Sales regions (canvas map)" key="map">
      <canvas
        ref={mapRef}
        width={400}
        height={300}
        data-testid="region-map"
        role="img"
        aria-label="Map with four regions"
        style={{ maxWidth: '100%', cursor: 'pointer', borderRadius: 8 }}
        onClick={(e) => {
          const { x, y } = canvasPoint(e)
          const r = regionAt(x, y)
          setRegion(r)
          merge({ region: r })
        }}
      />
      <p data-ui="hint">Selected region is shown only on the map.</p>
    </Card>
  )

  const W = 600
  const H = 240
  const px = (i: number) => 40 + i * ((W - 70) / 7)
  const py = (v: number) => H - 30 - v * 1.9
  const lineCard = (
    <Card title="Weekly sign-ups (SVG)" key="line">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, background: '#fff', borderRadius: 8, border: '1px solid var(--border)' }} data-testid="line-chart" role="img" aria-label="Line chart of weekly sign-ups">
        <polyline fill="none" stroke={b ? '#b45309' : '#15803d'} strokeWidth={3} points={weekly.map((v, i) => `${px(i)},${py(v)}`).join(' ')} />
        {weekly.map((v, i) => (
          <circle
            key={i}
            data-testid={`point-${i + 1}`}
            cx={px(i)}
            cy={py(v)}
            r={hoverPoint === i ? 9 : 6}
            fill={hoverPoint === i ? '#111827' : b ? '#b45309' : '#15803d'}
            onMouseEnter={() => {
              setHoverPoint(i)
              merge({ hoveredPoint: { week: i + 1, value: v } })
            }}
            onMouseLeave={() => setHoverPoint(null)}
          />
        ))}
        {hoverPoint !== null ? (
          <g data-testid="line-tooltip" pointerEvents="none">
            <rect x={Math.min(W - 110, px(hoverPoint) - 50)} y={Math.max(4, py(weekly[hoverPoint]) - 40)} width={100} height={26} rx={5} fill="#111827" />
            <text x={Math.min(W - 110, px(hoverPoint) - 50) + 50} y={Math.max(4, py(weekly[hoverPoint]) - 40) + 18} textAnchor="middle" fill="#fff" fontSize={13}>
              Week {hoverPoint + 1}: {weekly[hoverPoint]}
            </text>
          </g>
        ) : null}
      </svg>
    </Card>
  )

  const plans = t.v(['Basic', 'Standard', 'Premium'], ['Premium', 'Standard', 'Basic'])

  return (
    <div style={b ? { paddingLeft: 24 } : undefined}>
      {b ? [mapCard, barCard, lineCard] : [barCard, lineCard, mapCard]}
      <Card title="Signature">
        <canvas
          ref={sigRef}
          width={400}
          height={160}
          data-testid="signature-pad"
          aria-label="Signature pad"
          style={{ maxWidth: '100%', background: '#fff', border: '1px dashed var(--border)', borderRadius: 8, touchAction: 'none', cursor: 'crosshair' }}
          onPointerDown={(e) => {
            const ctx = e.currentTarget.getContext('2d')
            if (!ctx) return
            const { x, y } = canvasPoint(e)
            e.currentTarget.setPointerCapture?.(e.pointerId)
            ctx.strokeStyle = '#1c2333'
            ctx.lineWidth = 2.5
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(x, y)
            drawing.current = { points: 1 }
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return
            const ctx = e.currentTarget.getContext('2d')
            const { x, y } = canvasPoint(e)
            ctx?.lineTo(x, y)
            ctx?.stroke()
            drawing.current.points += 1
          }}
          onPointerUp={() => {
            const d = drawing.current
            drawing.current = null
            if (!d || d.points < 3) return
            totalPoints.current += d.points
            const n = strokes + 1
            setStrokes(n)
            merge({ strokes: n, signaturePoints: totalPoints.current, signed: true })
          }}
        />
        <div data-ui="inline">
          <button type="button" id={t.id('clear-signature')} onClick={clearSig}>
            {t.v('Clear', 'Clear signature')}
          </button>
          <span data-ui="hint">Strokes: {strokes}</span>
        </div>
      </Card>
      <Card title="Choose a plan">
        <p data-ui="hint">The selected plan is shown only by its border and background colour.</p>
        <div data-ui="inline" style={{ gap: b ? '2rem' : '0.8rem', marginLeft: b ? 40 : 0 }}>
          {plans.map((p) => (
            <button
              key={p}
              type="button"
              data-testid={`plan-${p.toLowerCase()}`}
              className={t.cls('plan-card')}
              style={{
                width: 150,
                height: 90,
                justifyContent: 'center',
                fontWeight: 600,
                border: selected === p ? '3px solid #3554d1' : '3px solid var(--border)',
                background: selected === p ? '#e6ebff' : 'var(--surface)',
                color: '#1c2333',
              }}
              onClick={() => {
                setSelected(p)
                merge({ selectedCard: p })
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </Card>
    </div>
  )
}
