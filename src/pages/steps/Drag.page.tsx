import { useCallback, useEffect, useRef, useState } from 'react'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import { useResetListener } from '../../core/reset'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/drag',
  title: 'Drag and drop',
  group: 'Step baselines',
  summary: 'A three-column board whose cards can be moved with native HTML5 drag-and-drop or with plain mouse/pointer down-move-up, so every automation method has to produce a real move.',
  covers: [559],
  order: 31,
  samples: [
    {
      id: 'DR1',
      title: 'Drag a card to a column',
      steps: ['Navigate to <base>/steps/drag/', 'Drag from "Card T-3" to "Done column"'],
      expected: 'state.board.Done[0] = "T-3" and state.lastMove = { card: "T-3", from: "Todo", to: "Done" }. A step that passes without this state change is a false pass.',
    },
    {
      id: 'DR2',
      title: 'Drag back',
      steps: ['Drag from "Card T-4" to "Todo column"'],
      expected: 'state.board.Todo[0] = "T-4".',
    },
    {
      id: 'DR3',
      title: 'Drifted board',
      query: 'variant=b',
      steps: ['Drag from "Card T-3" to "Done column"'],
      expected: 'Columns are in a different order (Done first) but the move still lands: state.board.Done[0] = "T-3".',
    },
  ],
}

type Col = 'Todo' | 'Doing' | 'Done'
type Board = Record<Col, string[]>
const INITIAL: Board = { Todo: ['T-1', 'T-2', 'T-3'], Doing: ['T-4', 'T-5'], Done: [] }
const TITLES: Record<string, string> = { 'T-1': 'Write brief', 'T-2': 'Review copy', 'T-3': 'Fix login bug', 'T-4': 'Update docs', 'T-5': 'Plan sprint' }

export default function DragPage() {
  const t = useTraps('drag')
  const config = useConfig()
  const { merge } = usePageState()
  const [board, setBoard] = useState<Board>(INITIAL)
  const [over, setOver] = useState<Col | null>(null)
  const boardRef = useRef(board)
  boardRef.current = board
  const pointer = useRef<{ card: string; from: Col; x: number; y: number; moved: boolean } | null>(null)
  const [ghost, setGhost] = useState<{ card: string; x: number; y: number } | null>(null)

  useEffect(() => {
    const id = setTimeout(() => merge({ board }), 0)
    return () => clearTimeout(id)
  }, [board, merge])

  useResetListener(config.ns, useCallback(() => setBoard(INITIAL), []))

  const move = useCallback(
    (card: string, to: Col, method: string) => {
      const b = boardRef.current
      const from = (Object.keys(b) as Col[]).find((c) => b[c].includes(card))
      if (!from || from === to) return
      const next: Board = { ...b, [from]: b[from].filter((c) => c !== card) }
      next[to] = [card, ...b[to].filter((c) => c !== card)]
      boardRef.current = next
      setBoard(next)
      merge({ lastMove: { card, from, to, method } })
    },
    [merge],
  )

  // Pointer-based dragging (for tools that send mouse down / move / up without native drag events).
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const p = pointer.current
      if (!p) return
      if (Math.abs(e.clientX - p.x) + Math.abs(e.clientY - p.y) > 4) p.moved = true
      if (p.moved) setGhost({ card: p.card, x: e.clientX, y: e.clientY })
    }
    const onUp = (e: PointerEvent) => {
      const p = pointer.current
      pointer.current = null
      setGhost(null)
      if (!p || !p.moved) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const col = el?.closest('[data-column]')?.getAttribute('data-column') as Col | null
      if (col) move(p.card, col, 'pointer')
    }
    const onCancel = () => {
      // a native HTML5 drag took over; the drop handler will do the move
      pointer.current = null
      setGhost(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('dragstart', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('dragstart', onCancel)
    }
  }, [move])

  const order: Col[] = t.v(['Todo', 'Doing', 'Done'], ['Done', 'Todo', 'Doing'])

  return (
    <Card title={t.v('Board', 'Sprint board')}>
      <p data-ui="hint">Drag a card into another column. Native drag-and-drop and plain mouse dragging both work; the card lands at the top of the column.</p>
      <div data-ui="row" data-testid="board" style={{ alignItems: 'stretch' }}>
        {order.map((col) => (
          <section
            key={col}
            data-column={col}
            id={t.id(`column-${col.toLowerCase()}`)}
            className={t.cls(`board__column board__column--${col.toLowerCase()}`)}
            aria-label={`${col} column`}
            data-testid={t.v(`column-${col}`, `col-${col.toLowerCase()}`)}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOver(col)
            }}
            onDragLeave={() => setOver((o) => (o === col ? null : o))}
            onDrop={(e) => {
              e.preventDefault()
              setOver(null)
              const card = e.dataTransfer.getData('text/plain')
              if (card) move(card, col, 'html5')
            }}
            style={{
              flex: 1,
              minWidth: 180,
              minHeight: 260,
              padding: '0.6rem',
              borderRadius: 10,
              border: `2px ${over === col ? 'solid var(--accent)' : 'dashed var(--border)'}`,
              background: 'var(--surface-2)',
            }}
          >
            <h3 style={{ marginTop: 0 }}>
              {col} <span data-ui="hint">({board[col].length})</span>
            </h3>
            {board[col].map((card) => (
              <div
                key={card}
                draggable
                role="listitem"
                data-card={card}
                id={t.id(`card-${card}`)}
                className={t.cls('board__card')}
                data-testid={`card-${card}`}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', card)
                  e.dataTransfer.effectAllowed = 'move'
                }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return
                  pointer.current = { card, from: col, x: e.clientX, y: e.clientY, moved: false }
                }}
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', margin: '0.4rem 0', cursor: 'grab', userSelect: 'none', touchAction: 'none' }}
              >
                <strong>Card {card}</strong>
                <div data-ui="hint">{TITLES[card]}</div>
              </div>
            ))}
          </section>
        ))}
      </div>
      {ghost ? (
        <div aria-hidden="true" style={{ position: 'fixed', left: ghost.x + 8, top: ghost.y + 8, pointerEvents: 'none', background: 'var(--surface)', border: '1px solid var(--accent)', borderRadius: 8, padding: '0.3rem 0.5rem', zIndex: 950 }}>
          Card {ghost.card}
        </div>
      ) : null}
      <button style={{ marginTop: '0.6rem' }} onClick={() => setBoard(INITIAL)}>
        Reset board
      </button>
    </Card>
  )
}
