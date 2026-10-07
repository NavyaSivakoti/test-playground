import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { randFor } from '../../core/rng'

export const meta: PageMeta = {
  path: '/ui/lists',
  title: 'Search, lists, tree and drag to reorder',
  group: 'General UI',
  summary:
    'A product list with debounced suggestions, filter chips, sorting, pagination, load-more and infinite scroll, an empty state, a tree with tri-state checkboxes, a sortable list (HTML5 or pointer drag) and a three-column board.',
  covers: [70, 186, 432, 467, 523, 559],
  order: 14,
  samples: [
    {
      id: 'S1',
      title: 'Search with suggestions',
      steps: ['Navigate to <base>/ui/lists/', 'Enter lamp in the "Search products" field', 'Wait until the text "Aurora Lamp" is present on the current page', 'Click on "Aurora Lamp"'],
      expected: 'Suggestions appear 300 ms after typing; state.query = "Aurora Lamp" and state.resultsCount = 1.',
    },
    {
      id: 'S2',
      title: 'Filter chips, sort and pagination',
      steps: ['Click on "Monitors"', 'Select option by text "Price: high to low" in the list "Sort by"', 'Click on "Next page"'],
      expected: 'state.filters = ["Monitors"], state.resultsCount = 12, state.sort = "price-desc", state.page = 2. Prices come from the seed.',
    },
    {
      id: 'S3',
      title: 'Empty state',
      steps: ['Enter zzz in the "Search products" field', 'Verify that the current page displays text "No results for “zzz”"'],
      expected: 'state.resultsCount = 0.',
    },
    {
      id: 'S4',
      title: 'Tree with tri-state checkboxes',
      steps: ['Click on "Expand Documents"', 'Check the checkbox "Reports"'],
      expected: 'state.selectedNodes = ["Documents/Reports/Q1.pdf","Documents/Reports/Q2.pdf"] and the Documents checkbox is indeterminate (state.indeterminate includes "Documents").',
    },
    {
      id: 'S5',
      title: 'Drag to reorder',
      steps: ['Drag from "Echo" to "Alpha"'],
      expected: 'state.order = ["Echo","Alpha","Bravo","Charlie","Delta"]. With ?dnd=pointer the list uses pointer events instead of HTML5 drag and drop.',
    },
    {
      id: 'S6',
      title: 'Board: move a card',
      steps: ['Drag from "Write release notes" to "Done"'],
      expected: 'state.board["Write release notes"] = "Done".',
    },
  ],
}

const ADJ = ['Aurora', 'Breeze', 'Cobalt', 'Drift', 'Ember', 'Falcon', 'Glacier', 'Harbor', 'Ion', 'Juniper', 'Krypton', 'Lumen']
const CATS = [
  { cat: 'Laptops', noun: 'Laptop' },
  { cat: 'Monitors', noun: 'Monitor' },
  { cat: 'Keyboards', noun: 'Keyboard' },
  { cat: 'Headphones', noun: 'Headphones' },
  { cat: 'Lamps', noun: 'Lamp' },
]
const PAGE_SIZE = 10

interface TreeNode {
  name: string
  children?: TreeNode[]
}
const TREE: TreeNode[] = [
  {
    name: 'Documents',
    children: [
      { name: 'Reports', children: [{ name: 'Q1.pdf' }, { name: 'Q2.pdf' }] },
      { name: 'Invoices', children: [{ name: 'INV-001.pdf' }] },
    ],
  },
  { name: 'Photos', children: [{ name: '2025', children: [{ name: 'beach.jpg' }, { name: 'city.jpg' }] }] },
  { name: 'Music' },
]
function leaves(node: TreeNode, path: string): string[] {
  return node.children ? node.children.flatMap((c) => leaves(c, `${path}/${c.name}`)) : [path]
}

const BOARD_COLS = ['To do', 'In progress', 'Done'] as const
type Col = (typeof BOARD_COLS)[number]
const BOARD_INIT: Record<string, Col> = {
  'Write release notes': 'To do',
  'Fix login bug': 'To do',
  'Review pull request': 'In progress',
  'Update screenshots': 'In progress',
  'Plan sprint': 'Done',
}

export default function ListsPage() {
  const t = useTraps('lists')
  const config = useConfig()
  const { merge } = usePageState()
  const [params] = useSearchParams()

  const products = useMemo(
    () =>
      t.shuffle(
        CATS.flatMap((c, ci) =>
          ADJ.map((a, ai) => ({
            id: ci * 12 + ai,
            name: `${a} ${c.noun}`,
            category: c.cat,
            price: 20 + Math.floor(randFor(config.seed, `lists:price:${ci}:${ai}`) * 980),
          })),
        ),
        'products',
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.seed, config.shuffle],
  )

  // ---------- search / filter / sort / pagination ----------
  const [query, setQuery] = useState('')
  const [debounced, setDebounced] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [filters, setFilters] = useState<string[]>([])
  const [sort, setSort] = useState('name-asc')
  const [page, setPage] = useState(1)

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300)
    return () => clearTimeout(id)
  }, [query])

  const suggestions = debounced.trim() ? products.filter((p) => p.name.toLowerCase().includes(debounced.trim().toLowerCase())).slice(0, 5) : []

  const results = useMemo(() => {
    const ql = query.trim().toLowerCase()
    const r = products.filter((p) => (!ql || p.name.toLowerCase().includes(ql)) && (!filters.length || filters.includes(p.category)))
    const cmp: Record<string, (a: (typeof r)[0], b: (typeof r)[0]) => number> = {
      'name-asc': (a, b) => a.name.localeCompare(b.name),
      'name-desc': (a, b) => b.name.localeCompare(a.name),
      'price-asc': (a, b) => a.price - b.price || a.name.localeCompare(b.name),
      'price-desc': (a, b) => b.price - a.price || a.name.localeCompare(b.name),
    }
    return r.slice().sort(cmp[sort])
  }, [products, query, filters, sort])
  const pages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageRows = results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    merge({ query, resultsCount: results.length, filters, sort, page, pages, firstResult: results[(page - 1) * PAGE_SIZE]?.name ?? null })
  }, [query, results, filters, sort, page, pages, merge])

  const setQ = (v: string) => {
    setQuery(v)
    setPage(1)
    setSuggestOpen(true)
  }

  // ---------- load more ----------
  const articles = useMemo(() => Array.from({ length: 30 }, (_, i) => `Article ${i + 1}: ${ADJ[i % 12]} update`), [])
  const [shown, setShown] = useState(5)

  // ---------- infinite scroll ----------
  const [infCount, setInfCount] = useState(20)
  const sentinel = useRef<HTMLDivElement | null>(null)
  const scroller = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting))
          setInfCount((c) => Math.min(200, c + 20))
      },
      { root: scroller.current, rootMargin: '40px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [merge])

  useEffect(() => {
    if (infCount > 20) merge({ infiniteLoaded: infCount })
  }, [infCount, merge])

  // ---------- tree ----------
  const [expanded, setExpanded] = useState<string[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const allLeaves = (node: TreeNode, path: string) => leaves(node, path)
  const triState = (node: TreeNode, path: string): 'checked' | 'mixed' | 'unchecked' => {
    const ls = allLeaves(node, path)
    const n = ls.filter((l) => selected.includes(l)).length
    return n === 0 ? 'unchecked' : n === ls.length ? 'checked' : 'mixed'
  }
  const toggleNode = (node: TreeNode, path: string) => {
    const ls = allLeaves(node, path)
    const state = triState(node, path)
    const next = state === 'checked' ? selected.filter((s) => !ls.includes(s)) : Array.from(new Set([...selected, ...ls]))
    next.sort()
    setSelected(next)
    const mixed: string[] = []
    const walk = (n: TreeNode, p: string) => {
      const l = leaves(n, p)
      const c = l.filter((x) => next.includes(x)).length
      if (c > 0 && c < l.length) mixed.push(p)
      n.children?.forEach((ch) => walk(ch, `${p}/${ch.name}`))
    }
    TREE.forEach((n) => walk(n, n.name))
    merge({ selectedNodes: next, indeterminate: mixed })
  }
  const renderTree = (nodes: TreeNode[], parent: string, level: number) =>
    nodes.map((node) => {
      const path = parent ? `${parent}/${node.name}` : node.name
      const isOpen = expanded.includes(path)
      const st = triState(node, path)
      return (
        <li key={path} role="treeitem" aria-expanded={node.children ? isOpen : undefined} aria-level={level} aria-selected={st === 'checked'} style={{ listStyle: 'none' }}>
          <div data-ui="inline" style={{ gap: 4 }}>
            {node.children ? (
              <button
                data-variant="ghost"
                aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${node.name}`}
                className={t.cls('tree__toggle')}
                style={{ padding: '0 6px' }}
                onClick={() => {
                  const next = isOpen ? expanded.filter((e) => e !== path) : [...expanded, path]
                  setExpanded(next)
                  merge({ expanded: next })
                }}
              >
                {isOpen ? '▾' : '▸'}
              </button>
            ) : (
              <span style={{ width: 26 }} />
            )}
            <label data-ui="inline" style={{ gap: 4 }}>
              <input
                type="checkbox"
                className={t.cls('tree__check')}
                checked={st === 'checked'}
                aria-checked={st === 'mixed' ? 'mixed' : st === 'checked'}
                ref={(el) => {
                  if (el) el.indeterminate = st === 'mixed'
                }}
                onChange={() => toggleNode(node, path)}
              />
              {node.name}
            </label>
          </div>
          {node.children && isOpen ? (
            <ul role="group" style={{ paddingLeft: 22, margin: 0 }}>
              {renderTree(node.children, path, level + 1)}
            </ul>
          ) : null}
        </li>
      )
    })

  // ---------- sortable list ----------
  const dndMode = params.get('dnd') === 'pointer' ? 'pointer' : 'html5'
  const [mode, setMode] = useState<'html5' | 'pointer'>(dndMode)
  const [order, setOrder] = useState(['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo'])
  const [dragging, setDragging] = useState<string | null>(null)
  const rowRefs = useRef<Record<string, HTMLLIElement | null>>({})
  const move = (item: string, toIndex: number, via: string) => {
    const from = order.indexOf(item)
    if (from < 0 || from === toIndex) return
    const next = order.slice()
    next.splice(from, 1)
    next.splice(toIndex, 0, item)
    setOrder(next)
    merge({ order: next, lastMove: { item, to: toIndex, via } })
  }
  const indexAtY = (y: number) => {
    let idx = order.length - 1
    for (let i = 0; i < order.length; i++) {
      const r = rowRefs.current[order[i]]?.getBoundingClientRect()
      if (r && y < r.top + r.height / 2) {
        idx = i
        break
      }
    }
    return idx
  }

  // ---------- board ----------
  const [board, setBoard] = useState<Record<string, Col>>(BOARD_INIT)
  const moveCard = (card: string, col: Col, via: string) => {
    const next = { ...board, [card]: col }
    setBoard(next)
    merge({ board: next, lastCardMove: { card, col, via } })
  }

  useEffect(() => {
    merge({ order, board: BOARD_INIT, selectedNodes: [], dndMode: mode })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const searchLabel = t.v('Search products', 'Find a product')

  return (
    <>
      <Card title="Products">
        <div data-ui="row">
          <div data-ui="field" style={{ position: 'relative' }}>
            <label htmlFor={t.id('search')} style={{ fontWeight: 600 }}>
              {searchLabel}
            </label>
            <input
              id={t.id('search')}
              className={t.cls('list-search__input')}
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls="search-suggestions"
              aria-autocomplete="list"
              autoComplete="off"
              value={query}
              onChange={(e) => setQ(e.target.value)}
              onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            />
            {suggestOpen && suggestions.length > 0 && debounced === query ? (
              <ul id="search-suggestions" role="listbox" aria-label="Suggestions" data-ui="popover" style={{ top: '100%', left: 0, listStyle: 'none', margin: 0 }}>
                {suggestions.map((s) => (
                  <li
                    key={s.id}
                    role="option"
                    aria-selected={false}
                    data-ui="menu-item"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setQuery(s.name)
                      setDebounced(s.name)
                      setSuggestOpen(false)
                      setPage(1)
                      merge({ suggestionPicked: s.name })
                    }}
                  >
                    {s.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
          <div data-ui="field">
            <label htmlFor={t.id('sort')} style={{ fontWeight: 600 }}>
              Sort by
            </label>
            <select id={t.id('sort')} className={t.cls('list-sort')} value={sort} onChange={(e) => (setSort(e.target.value), setPage(1))}>
              <option value="name-asc">Name: A to Z</option>
              <option value="name-desc">Name: Z to A</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>
        </div>
        <div role="group" aria-label="Category filters" data-ui="inline" style={{ margin: '8px 0' }}>
          {CATS.map((c) => {
            const on = filters.includes(c.cat)
            return (
              <button
                key={c.cat}
                aria-pressed={on}
                className={t.cls('chip')}
                data-variant={on ? 'primary' : undefined}
                style={{ borderRadius: 999 }}
                onClick={() => {
                  setFilters(on ? filters.filter((f) => f !== c.cat) : [...filters, c.cat])
                  setPage(1)
                }}
              >
                {c.cat}
              </button>
            )
          })}
          {filters.length ? (
            <button data-variant="link" onClick={() => setFilters([])}>
              Clear filters
            </button>
          ) : null}
        </div>
        <p data-ui="hint" aria-live="polite" data-testid="results-count">
          {results.length} results
        </p>
        {results.length === 0 ? (
          <p data-testid="empty-state" role="status">
            No results for “{query}”
          </p>
        ) : (
          <table aria-label="Products">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td>{p.category}</td>
                  <td>${p.price}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <nav aria-label="Pagination" data-ui="inline" style={{ marginTop: 8 }}>
          <button id={t.id('prev-page')} disabled={page <= 1} onClick={() => setPage(page - 1)}>
            {t.v('Previous page', '‹ Prev')}
          </button>
          {Array.from({ length: pages }, (_, i) => (
            <button key={i} aria-label={`Page ${i + 1}`} aria-current={page === i + 1 ? 'page' : undefined} data-variant={page === i + 1 ? 'primary' : undefined} onClick={() => setPage(i + 1)}>
              {i + 1}
            </button>
          ))}
          <button id={t.id('next-page')} disabled={page >= pages} onClick={() => setPage(page + 1)}>
            {t.v('Next page', 'Next ›')}
          </button>
        </nav>
      </Card>

      <div data-ui="row">
        <Card title="News (load more)" style={{ flex: 1, minWidth: 260 }}>
          <ul data-testid="load-more-list">
            {articles.slice(0, shown).map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          {shown < articles.length ? (
            <button
              id={t.id('load-more')}
              className={t.cls('news__more')}
              onClick={() => {
                const n = Math.min(articles.length, shown + 5)
                setShown(n)
                merge({ loadMoreShown: n })
              }}
            >
              Load more
            </button>
          ) : (
            <p data-ui="hint">All {articles.length} articles loaded.</p>
          )}
        </Card>

        <Card title="Activity log (infinite scroll)" style={{ flex: 1, minWidth: 260 }}>
          <div ref={scroller} data-testid="infinite-list" tabIndex={0} aria-label="Activity log" style={{ height: 220, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            <ol style={{ margin: 0 }}>
              {Array.from({ length: infCount }, (_, i) => (
                <li key={i}>Event #{i + 1}</li>
              ))}
            </ol>
            {infCount < 200 ? (
              <div ref={sentinel} data-ui="hint" style={{ padding: 6 }}>
                Loading more…
              </div>
            ) : (
              <p data-ui="hint">End of log</p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Files">
        <ul role="tree" aria-label="Files" aria-multiselectable="true" style={{ padding: 0 }}>
          {renderTree(TREE, '', 1)}
        </ul>
      </Card>

      <div data-ui="row">
        <Card title="Priority order" style={{ flex: 1, minWidth: 260 }}>
          <label data-ui="field">
            <span>Drag mode</span>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as 'html5' | 'pointer')
                merge({ dndMode: e.target.value })
              }}
            >
              <option value="html5">HTML5 drag and drop</option>
              <option value="pointer">Pointer events</option>
            </select>
          </label>
          <ol aria-label="Sortable list" data-testid="sortable" style={{ padding: 0, listStyle: 'none', touchAction: 'none' }}>
            {order.map((item, i) => (
              <li
                key={item}
                ref={(el) => {
                  rowRefs.current[item] = el
                }}
                data-testid={`sortable-${item}`}
                className={t.cls('sortable__item')}
                draggable={mode === 'html5'}
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', item)
                  e.dataTransfer.effectAllowed = 'move'
                  setDragging(item)
                }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const src = e.dataTransfer.getData('text/plain') || dragging
                  if (src && order.includes(src)) move(src, i, 'html5')
                  setDragging(null)
                }}
                onDragEnd={() => setDragging(null)}
                onPointerDown={(e) => {
                  if (mode !== 'pointer') return
                  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
                  setDragging(item)
                }}
                onPointerUp={(e) => {
                  if (mode !== 'pointer' || dragging !== item) return
                  move(item, indexAtY(e.clientY), 'pointer')
                  setDragging(null)
                }}
                onPointerCancel={() => mode === 'pointer' && setDragging(null)}
                style={{
                  padding: '8px 10px',
                  margin: '4px 0',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  background: dragging === item ? 'var(--surface-2)' : 'var(--surface)',
                  cursor: 'grab',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  userSelect: 'none',
                }}
              >
                <span>
                  <span aria-hidden="true">⠿ </span>
                  {item}
                </span>
                <span data-ui="inline" style={{ gap: 4 }}>
                  <button aria-label={`Move ${item} up`} disabled={i === 0} onClick={() => move(item, i - 1, 'button')} style={{ padding: '0 6px' }}>
                    ↑
                  </button>
                  <button aria-label={`Move ${item} down`} disabled={i === order.length - 1} onClick={() => move(item, i + 1, 'button')} style={{ padding: '0 6px' }}>
                    ↓
                  </button>
                </span>
              </li>
            ))}
          </ol>
        </Card>
      </div>

      <Card title="Board">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          {BOARD_COLS.map((col) => (
            <section
              key={col}
              aria-label={col}
              data-testid={`column-${col}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const card = e.dataTransfer.getData('text/card')
                if (card) moveCard(card, col, 'html5')
              }}
              style={{ background: 'var(--surface-2)', borderRadius: 8, padding: 8, minHeight: 160 }}
            >
              <h3 style={{ marginTop: 0 }}>{col}</h3>
              {Object.entries(board)
                .filter(([, c]) => c === col)
                .map(([card]) => (
                  <div
                    key={card}
                    draggable
                    data-testid={`card-${card}`}
                    className={t.cls('board__card')}
                    onDragStart={(e) => e.dataTransfer.setData('text/card', card)}
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, padding: 8, margin: '6px 0', cursor: 'grab' }}
                  >
                    {card}
                    <select
                      aria-label={`Move ${card} to`}
                      value={col}
                      onChange={(e) => moveCard(card, e.target.value as Col, 'select')}
                      style={{ display: 'block', marginTop: 4, fontSize: '0.8rem' }}
                    >
                      {BOARD_COLS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                ))}
            </section>
          ))}
        </div>
      </Card>
    </>
  )
}
