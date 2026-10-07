import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { backendMode } from '../../core/backend'
import { useConfig } from '../../core/playground'
import { pages, type PageMeta } from '../../core/registry'
import steps from '../../coverage/steps.json'

export const meta: PageMeta = {
  path: '/coverage',
  title: 'Step coverage matrix',
  group: 'System',
  summary:
    'Every web step type in the catalog, the page that targets it, what to do and the expected result. Status is computed from the pages in this build.',
  order: 1,
}

type Row = (typeof steps)[number]

function liveStatus(row: Row, coveredBy: string[]): { status: string; reason: string } {
  if (row.status === 'unsupported') return { status: 'unsupported', reason: row.note }
  if (row.status === 'blocked') return { status: 'blocked', reason: row.note }
  if (!coveredBy.length) return { status: 'missing', reason: 'No page declares this step yet' }
  if (row.env === 'app server' && backendMode === 'local') return { status: 'blocked', reason: 'Backend not configured in this build' }
  return { status: 'implemented', reason: row.note }
}

export default function Coverage() {
  const config = useConfig()
  const [filter, setFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const q = config.ns !== 'default' ? `?ns=${config.ns}` : ''
  const coverMap = useMemo(() => {
    const m = new Map<number, string[]>()
    for (const p of pages) for (const id of p.meta.covers ?? []) m.set(id, [...(m.get(id) ?? []), p.meta.path])
    return m
  }, [])
  const rows = steps.map((r) => {
    const by = coverMap.get(r.id) ?? []
    return { ...r, coveredBy: by, ...liveStatus(r, by) }
  })
  const counts = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  const shown = rows.filter(
    (r) =>
      (statusFilter === 'all' || r.status === statusFilter) &&
      (!filter || `${r.id} ${r.name} ${r.text} ${r.page}`.toLowerCase().includes(filter.toLowerCase())),
  )
  return (
    <div>
      <div data-ui="inline" data-testid="coverage-summary">
        {Object.entries(counts).map(([k, v]) => (
          <span key={k} data-ui="badge" data-tone={k === 'implemented' ? 'success' : k === 'missing' ? 'danger' : 'warning'}>
            {k}: {v}
          </span>
        ))}
        <span data-ui="badge">total: {rows.length}</span>
      </div>
      <div data-ui="inline" style={{ margin: '0.75rem 0' }}>
        <input aria-label="Filter steps" placeholder="Filter by id, name, text or page" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minWidth: 280 }} />
        <select aria-label="Status filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {['all', 'implemented', 'blocked', 'unsupported', 'missing'].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <a href={`${import.meta.env.BASE_URL}coverage/steps.csv`} download>
          Download CSV
        </a>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table data-testid="coverage-table">
          <thead>
            <tr>
              <th>Id</th>
              <th>Step template</th>
              <th>Environment</th>
              <th>Page</th>
              <th>What to do</th>
              <th>Expected result</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} data-step-id={r.id} data-status={r.status}>
                <td>{r.id}</td>
                <td>
                  <div>{r.text}</div>
                  <code data-ui="hint">{r.name}</code>
                </td>
                <td>{r.env}</td>
                <td>
                  {r.coveredBy.length ? (
                    r.coveredBy.map((p) => (
                      <div key={p}>
                        <Link to={`${p}${q}`}>{p}</Link>
                      </div>
                    ))
                  ) : (
                    <span>{r.page}</span>
                  )}
                </td>
                <td>{r.target}</td>
                <td>{r.expected}</td>
                <td>
                  <span data-ui="badge" data-tone={r.status === 'implemented' ? 'success' : r.status === 'missing' ? 'danger' : 'warning'}>
                    {r.status}
                  </span>
                  {r.reason ? <div data-ui="hint">{r.reason}</div> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
