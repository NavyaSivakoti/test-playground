// Custom widgets used by the Widgets scenario page (helpers, not a page).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/** W1: combobox whose listbox is rendered into document.body (outside the field's DOM subtree). */
export function PortalSelect({
  label,
  options,
  value,
  placeholder,
  onSelect,
  idBase,
  testId,
}: {
  label: string
  options: string[]
  value: string | null
  placeholder: string
  onSelect: (v: string) => void
  idBase: string
  testId: string
}) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null)
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const place = () => {
      const r = btn.current!.getBoundingClientRect()
      setRect({ left: r.left, top: r.bottom + 4, width: r.width })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node
      if (!btn.current?.contains(n) && !list.current?.contains(n)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <div data-ui="field">
      <span id={`${idBase}-label`}>{label}</span>
      <button
        ref={btn}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${idBase}-listbox`}
        aria-labelledby={`${idBase}-label`}
        id={idBase}
        data-testid={testId}
        onClick={() => setOpen((o) => !o)}
        style={{ justifyContent: 'space-between', minWidth: 220 }}
      >
        <span>{value ?? placeholder}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && rect
        ? createPortal(
            <div
              ref={list}
              role="listbox"
              id={`${idBase}-listbox`}
              aria-label={`${label} options`}
              data-ui="popover"
              data-testid={`${testId}-listbox`}
              style={{ position: 'fixed', left: rect.left, top: rect.top, minWidth: rect.width, zIndex: 800 }}
            >
              {options.map((o) => (
                <div
                  key={o}
                  role="option"
                  aria-selected={o === value}
                  data-ui="menu-item"
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    onSelect(o)
                    setOpen(false)
                  }}
                >
                  {o}
                </div>
              ))}
            </div>,
            document.body,
          )
        : null}
    </div>
  )
}

/** W8: a long scrollable custom list (not a native select). */
export function ScrollList({
  label,
  options,
  value,
  onSelect,
  idBase,
}: {
  label: string
  options: string[]
  value: string | null
  onSelect: (v: string) => void
  idBase: string
}) {
  const [open, setOpen] = useState(false)
  return (
    <div data-ui="field" style={{ position: 'relative' }}>
      <span id={`${idBase}-label`}>{label}</span>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-labelledby={`${idBase}-label`}
        aria-controls={`${idBase}-list`}
        id={idBase}
        onClick={() => setOpen((o) => !o)}
        style={{ justifyContent: 'space-between' }}
      >
        <span>{value ?? 'Choose a timezone'}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div
          role="listbox"
          id={`${idBase}-list`}
          aria-label={`${label} options`}
          data-ui="popover"
          data-testid="timezone-list"
          style={{ top: '100%', left: 0, right: 0, maxHeight: 220, overflowY: 'auto' }}
        >
          {options.map((o) => (
            <div
              key={o}
              role="option"
              aria-selected={o === value}
              data-ui="menu-item"
              style={{ cursor: 'pointer' }}
              onClick={() => {
                onSelect(o)
                setOpen(false)
              }}
            >
              {o}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const pad = (n: number) => String(n).padStart(2, '0')
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** W5: custom calendar. The whole grid re-mounts on every hover (new DOM nodes, same positions). */
export function CalendarField({
  label,
  nowMs,
  value,
  onSelect,
  onRender,
  idBase,
  prevLabel,
  nextLabel,
}: {
  label: string
  nowMs: number
  value: string | null
  onSelect: (iso: string) => void
  onRender: () => void
  idBase: string
  prevLabel: string
  nextLabel: string
}) {
  const now = new Date(nowMs)
  const [open, setOpen] = useState(false)
  const [ym, setYm] = useState({ y: now.getUTCFullYear(), m: now.getUTCMonth() })
  const [hoverTick, setHoverTick] = useState(0)
  const first = new Date(Date.UTC(ym.y, ym.m, 1))
  const days = new Date(Date.UTC(ym.y, ym.m + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7 // Monday first
  const todayIso = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}`
  const shift = (d: number) => setYm(({ y, m }) => ({ y: m + d < 0 ? y - 1 : m + d > 11 ? y + 1 : y, m: (m + d + 12) % 12 }))
  return (
    <div data-ui="field" style={{ position: 'relative' }}>
      <span id={`${idBase}-label`}>{label}</span>
      <input
        id={idBase}
        readOnly
        aria-labelledby={`${idBase}-label`}
        placeholder="YYYY-MM-DD"
        value={value ?? ''}
        onClick={() => setOpen(true)}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <div data-ui="popover" role="dialog" aria-label={`${label} calendar`} data-testid="calendar" style={{ top: '100%', left: 0, padding: 8, width: 290 }}>
          <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
            <button type="button" aria-label={prevLabel} onClick={() => shift(-1)}>
              ‹
            </button>
            <strong data-testid="calendar-month">
              {MONTHS[ym.m]} {ym.y}
            </strong>
            <button type="button" aria-label={nextLabel} onClick={() => shift(1)}>
              ›
            </button>
          </div>
          <div
            key={hoverTick}
            role="grid"
            data-render={hoverTick}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginTop: 6, textAlign: 'center' }}
          >
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <span key={d} data-ui="hint">
                {d}
              </span>
            ))}
            {Array.from({ length: lead }, (_, i) => (
              <span key={`e${i}`} />
            ))}
            {Array.from({ length: days }, (_, i) => {
              const iso = `${ym.y}-${pad(ym.m + 1)}-${pad(i + 1)}`
              return (
                <button
                  key={iso}
                  type="button"
                  role="gridcell"
                  aria-selected={iso === value}
                  data-date={iso}
                  data-today={iso === todayIso}
                  onMouseEnter={() => {
                    setHoverTick((n) => n + 1)
                    onRender()
                  }}
                  onClick={() => {
                    onSelect(iso)
                    setOpen(false)
                  }}
                  style={{
                    padding: '0.25rem 0',
                    justifyContent: 'center',
                    background: iso === value ? 'var(--accent)' : undefined,
                    color: iso === value ? 'var(--accent-text)' : undefined,
                    fontWeight: iso === todayIso ? 700 : undefined,
                  }}
                >
                  {i + 1}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** W6: kanban board with both HTML5 drag-and-drop and pointer-based dragging. */
export function Kanban({
  columns,
  initial,
  onMove,
  columnLabel,
}: {
  columns: string[]
  initial: Record<string, string[]>
  onMove: (m: { card: string; column: string; index: number; method: 'html5' | 'pointer' }) => void
  columnLabel: (c: string) => string
}) {
  const [board, setBoard] = useState(initial)
  const boardRef = useRef(initial)
  const html5 = useRef<string | null>(null)
  const pointer = useRef<{ card: string; x: number; y: number; active: boolean } | null>(null)

  const move = (card: string, column: string, method: 'html5' | 'pointer') => {
    const b = boardRef.current
    const next: Record<string, string[]> = {}
    for (const c of columns) next[c] = b[c].filter((x) => x !== card)
    next[column] = [...next[column], card]
    boardRef.current = next
    setBoard(next)
    onMove({ card, column, index: next[column].length - 1, method })
  }

  useEffect(() => {
    const onMoveEv = (e: PointerEvent) => {
      const p = pointer.current
      if (p && !p.active && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 6) p.active = true
    }
    const onUp = (e: PointerEvent) => {
      const p = pointer.current
      pointer.current = null
      if (!p || !p.active) return
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-column]') as HTMLElement | null
      if (el?.dataset.column) move(p.card, el.dataset.column, 'pointer')
    }
    window.addEventListener('pointermove', onMoveEv)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMoveEv)
      window.removeEventListener('pointerup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, minmax(120px, 1fr))`, gap: 10 }}>
      {columns.map((c) => (
        <div
          key={c}
          data-column={c}
          data-testid={`column-${c}`}
          aria-label={columnLabel(c)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            const card = html5.current ?? e.dataTransfer.getData('text/plain')
            html5.current = null
            if (card) move(card, c, 'html5')
          }}
          style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 8, minHeight: 180 }}
        >
          <strong style={{ display: 'block', marginBottom: 6 }}>{columnLabel(c)}</strong>
          {board[c].map((card) => (
            <div
              key={card}
              draggable
              data-card={card}
              data-testid={`card-${card}`}
              onDragStart={(e) => {
                html5.current = card
                pointer.current = null
                e.dataTransfer.setData('text/plain', card)
                e.dataTransfer.effectAllowed = 'move'
              }}
              onPointerDown={(e) => {
                pointer.current = { card, x: e.clientX, y: e.clientY, active: false }
              }}
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: '0.4rem 0.6rem', marginBottom: 6, cursor: 'grab', userSelect: 'none' }}
            >
              {card}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
