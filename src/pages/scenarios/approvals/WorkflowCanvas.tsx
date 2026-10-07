// Workflow builder drawn entirely on a <canvas>. The nodes are NOT DOM elements: tests have to use
// coordinates (or the accessible fallback list rendered by the page). Pointer events + hit-testing.
import { useEffect, useRef, useState } from 'react'

export interface WfNode {
  id: string
  label: string
  x: number
  y: number
}
export type WfEdge = [string, string]
export interface WfView {
  zoom: number
  panX: number
  panY: number
}

export const NODE_W = 180
export const NODE_H = 64
export const PORT_R = 9
export const CANVAS_W = 3000
export const CANVAS_H = 400

export function portOf(n: WfNode) {
  return { x: n.x + NODE_W, y: n.y + NODE_H / 2 }
}

function hitNode(nodes: WfNode[], x: number, y: number): WfNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]
    if (x >= n.x && x <= n.x + NODE_W && y >= n.y && y <= n.y + NODE_H) return n
  }
  return undefined
}
function hitPort(nodes: WfNode[], x: number, y: number): WfNode | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const p = portOf(nodes[i])
    if (Math.hypot(p.x - x, p.y - y) <= PORT_R + 5) return nodes[i]
  }
  return undefined
}

type Gesture =
  | { kind: 'drag'; id: string; dx: number; dy: number; moved: boolean }
  | { kind: 'connect'; from: string; x: number; y: number }

export function WorkflowCanvas({
  nodes,
  edges,
  view,
  accent,
  onMove,
  onConnect,
  onCancel,
  canvasId,
  testId,
}: {
  nodes: WfNode[]
  edges: WfEdge[]
  view: WfView
  accent: string
  onMove: (nodes: WfNode[], id: string) => void
  onConnect: (from: string, to: string) => void
  onCancel: (reason: string) => void
  canvasId: string
  testId: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [live, setLive] = useState<WfNode[]>(nodes)
  const gesture = useRef<Gesture | null>(null)
  const [pending, setPending] = useState<{ from: string; x: number; y: number } | null>(null)

  useEffect(() => setLive(nodes), [nodes])

  // drawing
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.fillStyle = '#fbfcfe'
    ctx.fillRect(0, 0, c.width, c.height)
    ctx.setTransform(view.zoom, 0, 0, view.zoom, view.panX * view.zoom, view.panY * view.zoom)
    // grid
    ctx.strokeStyle = '#e6e9f2'
    ctx.lineWidth = 1
    for (let gx = 0; gx <= CANVAS_W / view.zoom; gx += 50) {
      ctx.beginPath()
      ctx.moveTo(gx - view.panX, -view.panY)
      ctx.lineTo(gx - view.panX, CANVAS_H / view.zoom - view.panY)
      ctx.stroke()
    }
    const byId = new Map(live.map((n) => [n.id, n]))
    const arrow = (x1: number, y1: number, x2: number, y2: number, color: string, dashed = false) => {
      ctx.strokeStyle = color
      ctx.lineWidth = 2.5
      ctx.setLineDash(dashed ? [6, 5] : [])
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      const mid = (x1 + x2) / 2
      ctx.bezierCurveTo(mid, y1, mid, y2, x2, y2)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - 11, y2 - 6)
      ctx.lineTo(x2 - 11, y2 + 6)
      ctx.closePath()
      ctx.fill()
    }
    for (const [a, b] of edges) {
      const na = byId.get(a)
      const nb = byId.get(b)
      if (!na || !nb) continue
      const p = portOf(na)
      arrow(p.x, p.y, nb.x, nb.y + NODE_H / 2, '#5b6478')
    }
    if (pending) {
      const na = byId.get(pending.from)
      if (na) {
        const p = portOf(na)
        arrow(p.x, p.y, pending.x, pending.y, accent, true)
      }
    }
    for (const n of live) {
      ctx.fillStyle = '#ffffff'
      ctx.strokeStyle = n.id === 'done' ? '#15803d' : accent
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.roundRect(n.x, n.y, NODE_W, NODE_H, 10)
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#1c2333'
      ctx.font = '600 16px system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(n.label, n.x + NODE_W / 2, n.y + NODE_H / 2)
      // ports
      const p = portOf(n)
      ctx.fillStyle = accent
      ctx.beginPath()
      ctx.arc(p.x, p.y, PORT_R, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#d9dee8'
      ctx.beginPath()
      ctx.arc(n.x, n.y + NODE_H / 2, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [live, edges, pending, view, accent])

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget
    const r = c.getBoundingClientRect()
    const sx = ((e.clientX - r.left) * c.width) / r.width
    const sy = ((e.clientY - r.top) * c.height) / r.height
    return { x: sx / view.zoom - view.panX, y: sy / view.zoom - view.panY }
  }

  return (
    <canvas
      ref={ref}
      id={canvasId}
      data-testid={testId}
      width={CANVAS_W}
      height={CANVAS_H}
      style={{ width: CANVAS_W, height: CANVAS_H, display: 'block', touchAction: 'none', cursor: 'default' }}
      aria-label="Workflow builder canvas"
      role="img"
      onPointerDown={(e) => {
        const { x, y } = toWorld(e)
        const port = hitPort(live, x, y)
        if (port) {
          gesture.current = { kind: 'connect', from: port.id, x, y }
          setPending({ from: port.id, x, y })
        } else {
          const n = hitNode(live, x, y)
          if (!n) return
          gesture.current = { kind: 'drag', id: n.id, dx: x - n.x, dy: y - n.y, moved: false }
        }
        e.currentTarget.setPointerCapture?.(e.pointerId)
      }}
      onPointerMove={(e) => {
        const { x, y } = toWorld(e)
        const g = gesture.current
        if (!g) {
          const overPort = hitPort(live, x, y)
          e.currentTarget.style.cursor = overPort ? 'crosshair' : hitNode(live, x, y) ? 'grab' : 'default'
          return
        }
        if (g.kind === 'drag') {
          g.moved = true
          const nx = Math.round(Math.max(0, Math.min(CANVAS_W - NODE_W, x - g.dx)))
          const ny = Math.round(Math.max(0, Math.min(CANVAS_H - NODE_H, y - g.dy)))
          setLive((ls) => ls.map((n) => (n.id === g.id ? { ...n, x: nx, y: ny } : n)))
        } else {
          setPending({ from: g.from, x, y })
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current
        gesture.current = null
        if (!g) return
        if (g.kind === 'drag') {
          if (g.moved) onMove(live, g.id)
          return
        }
        setPending(null)
        const { x, y } = toWorld(e)
        const target = hitNode(live, x, y)
        if (!target) onCancel('dropped on empty canvas')
        else if (target.id === g.from) onCancel('cannot connect a node to itself')
        else onConnect(g.from, target.id)
      }}
    >
      Workflow builder. Use the accessible list below the canvas to read and change nodes and connections.
    </canvas>
  )
}
