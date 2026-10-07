import { useCallback, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Modal, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { fmtTime, makeDevices, type Device, type DeviceStatus } from './business/devices'
import { downloadText, sha256Text, useAfterMount } from './business/util'

export const meta: PageMeta = {
  path: '/grid',
  title: 'Network admin console',
  group: 'Scenarios',
  summary:
    'A data grid of 500 network devices with virtualized rows, sortable headers, a filter, separately scrolling header and body, hover-only row actions, select all, pagination below the fold, inline editing with a confirmation, an edit conflict and CSV export.',
  covers: [26, 27, 23, 30, 70, 35, 54, 186, 523, 642, 432, 138, 580, 168],
  order: 11,
  samples: [
    {
      id: 'G1',
      title: 'Filter and sort',
      steps: ['Navigate to <base>/grid/', 'Enter fra in the "Filter devices" field', 'Click on "Hostname"', 'Click on "Hostname"'],
      expected: 'state.filter = "fra", state.sort = { key: "hostname", dir: "desc" }, state.matching < 500 and only rows containing "fra" are listed.',
    },
    {
      id: 'G2',
      title: 'Inline edit with confirmation',
      steps: [
        'Enter edge-ams in the "Filter devices" field',
        'Double click on the first hostname cell',
        'Clear the value displayed in the "Hostname" field',
        'Enter renamed-switch-01 in the "Hostname" field',
        'Press Enter/Return Key',
        'Wait until the text "Save changes?" is present on the current page',
        'Click on "Save"',
        'Click on the Refresh button in the browser',
        'Verify that the current page displays text "renamed-switch-01"',
      ],
      expected: 'state.edits[0].persisted = true and the new hostname survives a reload. With bugs=savePersist the toast still says "Changes saved" but persisted = false and the old name is back after reload.',
    },
    {
      id: 'G3',
      title: 'Hover-only row actions',
      steps: ['Mouseover on "edge-ams-001"', 'Click on the "Reboot" located to the right of "edge-ams-001"'],
      expected: 'state.lastAction = "reboot:<hostname>". The actions are invisible until the row is hovered.',
    },
    {
      id: 'G4',
      title: 'Pagination below the fold',
      steps: ['Scroll (up to/down to) the element "Next page" into view', 'Click on "Next page"', 'Verify that the "Page indicator" displays text "Page 2 of 10"'],
      expected: 'state.page = 2.',
    },
    {
      id: 'G5',
      title: 'Select all and export',
      steps: ['Check the checkbox "Select all"', 'Enter offline in the "Filter devices" field', 'Download file by click on "Export CSV"'],
      expected: 'state.selected.count = 50; a file devices-filtered.csv downloads and state.lastExport.rows equals state.matching.',
    },
    {
      id: 'G6',
      title: 'Edit conflict',
      query: 'conflict=1',
      steps: ['Double click on the first hostname cell', 'Enter -x in the "Hostname" field', 'Press Enter/Return Key', 'Click on "Save"', 'Verify that the current page displays text "Edited by another user"', 'Click on "Overwrite"'],
      expected: 'state.conflict = "overwritten" and the edit is saved.',
    },
  ],
}

type SortKey = keyof Device
interface Col {
  key: SortKey
  label: string
  width: number
}
const ROW_H = 36
const BODY_H = 420
const STATUS_ICON: Record<DeviceStatus, { icon: string; label: string; color: string }> = {
  online: { icon: '●', label: 'Online', color: 'var(--success)' },
  offline: { icon: '○', label: 'Offline', color: 'var(--muted)' },
  disabled: { icon: '⊘', label: 'Disabled', color: 'var(--danger)' },
}
const KIND = 'grid-edit'

interface Edit {
  id: string
  from: string
  to: string
  persisted: boolean
}

export default function GridPage() {
  const t = useTraps('grid')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [params] = useSearchParams()
  const conflictMode = params.get('conflict') === '1'
  const [now] = useState(() => nowMs(config))
  const base = useMemo(() => makeDevices(config.seed, now), [config.seed, now])

  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [deleted, setDeleted] = useState<string[]>([])
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null)
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [hover, setHover] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null)
  const [confirm, setConfirm] = useState<{ id: string; from: string; to: string } | null>(null)
  const [conflict, setConflict] = useState<{ id: string; from: string; to: string } | null>(null)
  const [conflictResolved, setConflictResolved] = useState(false)
  const [scrollTop, setScrollTop] = useState(0)
  const edits = useRef<Edit[]>([])
  const headerRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const cols: Col[] = useMemo(() => {
    const host: Col = { key: 'hostname', label: 'Hostname', width: 170 }
    const ip: Col = { key: 'ip', label: 'IP address', width: 130 }
    const rest: Col[] = [
      { key: 'protocol', label: 'Protocol', width: 90 },
      { key: 'status', label: 'Status', width: 90 },
      { key: 'lastSeen', label: 'Last seen', width: 170 },
      { key: 'site', label: 'Site', width: 70 },
      { key: 'model', label: 'Model', width: 110 },
      { key: 'firmware', label: 'Firmware', width: 100 },
      { key: 'uptimeDays', label: 'Uptime (days)', width: 120 },
      { key: 'rack', label: 'Rack', width: 70 },
      { key: 'ports', label: 'Ports', width: 70 },
      { key: 'vlan', label: 'VLAN', width: 70 },
      { key: 'owner', label: 'Owner', width: 150 },
      { key: 'serial', label: 'Serial', width: 120 },
    ]
    return t.v([host, ip, ...rest], [ip, host, ...rest])
  }, [t])
  const SEL_W = 44
  const ACT_W = 200
  const totalWidth = SEL_W + ACT_W + cols.reduce((n, c) => n + c.width, 0)

  const devices = useMemo(
    () => base.filter((d) => !deleted.includes(d.id)).map((d) => (overrides[d.id] ? { ...d, hostname: overrides[d.id] } : d)),
    [base, deleted, overrides],
  )
  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const list = q ? devices.filter((d) => [d.hostname, d.ip, d.status, d.protocol, d.owner, d.site].some((v) => v.toLowerCase().includes(q))) : devices.slice()
    if (sort) {
      list.sort((a, b) => {
        const x = a[sort.key]
        const y = b[sort.key]
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'en', { numeric: true })
        return sort.dir === 'asc' ? c : -c
      })
    }
    return list
  }, [devices, filter, sort])
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize))
  const curPage = Math.min(page, pages)
  const pageRows = filtered.slice((curPage - 1) * pageSize, curPage * pageSize)
  const start = Math.max(0, Math.floor(scrollTop / ROW_H) - 4)
  const end = Math.min(pageRows.length, start + Math.ceil(BODY_H / ROW_H) + 8)
  const visible = pageRows.slice(start, end)

  const publishSelection = (s: Set<string>) => {
    const ids = [...s]
    merge({ selected: { count: ids.length, ids: ids.slice(0, 10) } })
  }
  const toPage = (p: number) => {
    setPage(p)
    setScrollTop(0)
    if (bodyRef.current) bodyRef.current.scrollTop = 0
    merge({ page: p, lastAction: `page:${p}` })
  }

  useAfterMount(() => {
    merge({ page: 1, pageSize: 50, total: 500, matching: 500, filter: '', sort: null, selected: { count: 0, ids: [] }, edits: [], renderedRows: Math.min(end - start, pageRows.length), conflictMode })
    backend
      .list(config.ns, KIND)
      .then((rows) => {
        const o: Record<string, string> = {}
        for (const r of rows) if (typeof r.data.deviceId === 'string') o[r.data.deviceId] = String(r.data.hostname)
        setOverrides(o)
        merge({ persistedEdits: Object.keys(o).length })
      })
      .catch(() => merge({ persistedEdits: 0, loadError: true }))
  })

  const persist = useCallback(
    async (c: { id: string; from: string; to: string }) => {
      setOverrides((o) => ({ ...o, [c.id]: c.to }))
      let persisted = false
      if (!config.bugs.includes('savePersist')) {
        const rows = await backend.list(config.ns, KIND)
        const found = rows.find((r) => r.data.deviceId === c.id)
        if (found) await backend.update(config.ns, KIND, found.id, { hostname: c.to })
        else await backend.create(config.ns, KIND, { deviceId: c.id, hostname: c.to })
        persisted = true
      }
      edits.current = [...edits.current, { ...c, persisted }]
      merge({ edits: edits.current, lastAction: `save:${c.id}` })
      toast('Changes saved', { tone: 'success' })
    },
    [config.bugs, config.ns, merge, toast],
  )

  const onSave = () => {
    if (!confirm) return
    const c = confirm
    setConfirm(null)
    if (conflictMode && !conflictResolved) {
      setConflict(c)
      merge({ conflict: 'shown' })
      return
    }
    void persist(c)
  }

  const header = (
    <div
      ref={headerRef}
      role="rowgroup"
      data-testid="grid-header"
      style={{ overflow: 'hidden', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
    >
      <div role="row" aria-rowindex={1} style={{ display: 'flex', width: totalWidth, height: ROW_H, alignItems: 'center' }}>
        <div role="columnheader" style={{ width: SEL_W, flex: 'none', textAlign: 'center' }}>
          <input
            type="checkbox"
            id={t.id('select-all')}
            aria-label="Select all"
            checked={pageRows.length > 0 && pageRows.every((r) => selected.has(r.id))}
            onChange={(e) => {
              const s = new Set(selected)
              for (const r of pageRows) {
                if (e.target.checked) s.add(r.id)
                else s.delete(r.id)
              }
              setSelected(s)
              publishSelection(s)
              merge({ lastAction: e.target.checked ? 'select-all' : 'clear-selection' })
            }}
          />
        </div>
        {cols.map((c, i) => (
          <div
            key={c.key}
            role="columnheader"
            aria-sort={sort?.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
            style={{ width: c.width, flex: 'none', order: i === 0 ? 0 : 2 }}
          >
            <button
              data-variant="ghost"
              id={t.id(t.v(`sort-${c.key}`, `col-${c.key}-sort`))}
              className={t.cls('grid__sort')}
              style={{ fontWeight: 600, padding: '0.2rem 0.4rem' }}
              onClick={() => {
                const next = sort?.key === c.key && sort.dir === 'asc' ? { key: c.key, dir: 'desc' as const } : { key: c.key, dir: 'asc' as const }
                setSort(next)
                merge({ sort: next, lastAction: `sort:${c.key}:${next.dir}` })
              }}
            >
              {c.label}
              {sort?.key === c.key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
            </button>
          </div>
        ))}
        <div role="columnheader" style={{ width: ACT_W, flex: 'none', order: 1, fontWeight: 600 }}>
          Actions
        </div>
      </div>
    </div>
  )

  const renderRow = (d: Device, idx: number) => {
    const shown = hover === d.id
    const st = STATUS_ICON[d.status]
    const cell = (c: Col, i: number) => {
      const style: React.CSSProperties = { width: c.width, flex: 'none', order: i === 0 ? 0 : 2, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', padding: '0 0.4rem' }
      if (c.key === 'hostname') {
        if (editing?.id === d.id)
          return (
            <div key={c.key} role="gridcell" style={style}>
              <input
                autoFocus
                aria-label="Hostname"
                id={t.id('hostname-edit')}
                value={editing.value}
                style={{ width: '100%', padding: '0.15rem 0.3rem' }}
                onChange={(e) => setEditing({ id: d.id, value: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const to = editing.value.trim()
                    setEditing(null)
                    if (to && to !== d.hostname) {
                      setConfirm({ id: d.id, from: d.hostname, to })
                      merge({ lastAction: `edit:${d.id}` })
                    }
                  } else if (e.key === 'Escape') {
                    setEditing(null)
                    merge({ lastAction: `edit-cancelled:${d.id}` })
                  }
                }}
              />
            </div>
          )
        return (
          <div
            key={c.key}
            role="gridcell"
            data-testid={`host-${d.id}`}
            data-cell="hostname"
            title="Double-click to edit"
            style={{ ...style, cursor: 'text' }}
            onDoubleClick={() => setEditing({ id: d.id, value: d.hostname })}
          >
            {d.hostname}
          </div>
        )
      }
      if (c.key === 'status')
        return (
          <div key={c.key} role="gridcell" style={style}>
            <span role="img" aria-label={st.label} title={st.label} data-status={d.status} style={{ color: st.color, fontSize: '1.1rem' }}>
              {st.icon}
            </span>
          </div>
        )
      const v = d[c.key]
      return (
        <div key={c.key} role="gridcell" style={style}>
          {c.key === 'lastSeen' ? fmtTime(v as number) : String(v)}
        </div>
      )
    }
    return (
      <div
        key={d.id}
        role="row"
        aria-rowindex={(curPage - 1) * pageSize + idx + 2}
        aria-selected={selected.has(d.id)}
        data-testid={`row-${d.id}`}
        data-hostname={d.hostname}
        onMouseEnter={() => setHover(d.id)}
        onMouseLeave={() => setHover((h) => (h === d.id ? null : h))}
        onFocus={() => setHover(d.id)}
        style={{
          position: 'absolute',
          top: idx * ROW_H,
          left: 0,
          height: ROW_H,
          width: totalWidth,
          display: 'flex',
          alignItems: 'center',
          borderBottom: '1px solid var(--border)',
          background: shown ? 'var(--surface-2)' : undefined,
        }}
      >
        <div role="gridcell" style={{ width: SEL_W, flex: 'none', textAlign: 'center' }}>
          <input
            type="checkbox"
            aria-label={`Select ${d.hostname}`}
            checked={selected.has(d.id)}
            onChange={(e) => {
              const s = new Set(selected)
              if (e.target.checked) s.add(d.id)
              else s.delete(d.id)
              setSelected(s)
              publishSelection(s)
            }}
          />
        </div>
        {cols.map(cell)}
        <div role="gridcell" data-testid={`actions-${d.id}`} style={{ width: ACT_W, flex: 'none', order: 1, visibility: shown ? 'visible' : 'hidden' }}>
          <span data-ui="inline" style={{ gap: '0.25rem', flexWrap: 'nowrap' }}>
            <button style={{ padding: '0.15rem 0.45rem' }} onClick={() => setEditing({ id: d.id, value: d.hostname })}>
              Edit
            </button>
            <button
              style={{ padding: '0.15rem 0.45rem' }}
              onClick={() => {
                merge({ lastAction: `reboot:${d.hostname}` })
                toast(`Reboot queued for ${d.hostname}`)
              }}
            >
              Reboot
            </button>
            <button
              data-variant="danger"
              style={{ padding: '0.15rem 0.45rem' }}
              onClick={() => {
                const n = [...deleted, d.id]
                setDeleted(n)
                merge({ deleted: n, lastAction: `delete:${d.hostname}` })
                toast(`${d.hostname} deleted`)
              }}
            >
              Delete
            </button>
          </span>
        </div>
      </div>
    )
  }

  return (
    <>
      <Card title="Devices">
        <p data-ui="hint">
          Only the rows in view exist in the DOM (virtualized). Header and body scroll separately; scroll the body sideways to see more columns. Row actions appear only while a row is hovered. Status is an icon with an accessible label. Double-click a hostname to edit it.
        </p>
        {conflict ? (
          <div role="alert" data-ui="card" data-testid="conflict-banner" style={{ borderColor: 'var(--warning)' }}>
            <strong>Edited by another user</strong>: {conflict.from} was changed by Grace Hopper while you were editing.
            <div data-ui="inline" style={{ marginTop: '0.5rem' }}>
              <button
                data-variant="primary"
                id={t.id('conflict-overwrite')}
                onClick={() => {
                  const c = conflict
                  setConflict(null)
                  setConflictResolved(true)
                  merge({ conflict: 'overwritten' })
                  void persist(c)
                }}
              >
                Overwrite
              </button>
              <button
                id={t.id('conflict-discard')}
                onClick={() => {
                  setConflict(null)
                  setConflictResolved(true)
                  merge({ conflict: 'discarded', lastAction: `discard:${conflict.id}` })
                }}
              >
                Discard my changes
              </button>
            </div>
          </div>
        ) : null}
        <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
          <label data-ui="field" style={{ margin: 0 }}>
            <span>{t.v('Filter devices', 'Search devices')}</span>
            <input
              id={t.id(t.v('filter', 'device-search'))}
              className={t.cls('grid__filter')}
              type="search"
              value={filter}
              placeholder="hostname, IP, status…"
              onChange={(e) => {
                const f = e.target.value
                setFilter(f)
                setPage(1)
                setScrollTop(0)
                if (bodyRef.current) bodyRef.current.scrollTop = 0
                const q = f.trim().toLowerCase()
                const n = q ? devices.filter((d) => [d.hostname, d.ip, d.status, d.protocol, d.owner, d.site].some((v) => v.toLowerCase().includes(q))).length : devices.length
                merge({ filter: f, page: 1, matching: n })
              }}
            />
          </label>
          <button
            id={t.id(t.v('export-csv', 'download-csv'))}
            className={t.cls('grid__export')}
            onClick={async () => {
              const head = cols.map((c) => c.label).join(',')
              const lines = filtered.map((d) => cols.map((c) => (c.key === 'lastSeen' ? fmtTime(d.lastSeen) : String(d[c.key]))).join(','))
              const csv = [head, ...lines].join('\n') + '\n'
              const name = filter.trim() ? 'devices-filtered.csv' : 'devices-all.csv'
              downloadText(name, csv)
              merge({ lastExport: { name, rows: lines.length, filter, sha256: await sha256Text(csv) }, lastAction: 'export' })
            }}
          >
            {t.v('Export CSV', 'Download CSV')}
          </button>
        </div>
        <p data-ui="hint" data-testid="grid-summary">
          {filtered.length} of {devices.length} devices · {selected.size} selected
        </p>
        <div role="grid" aria-label="Devices" aria-rowcount={filtered.length + 1} aria-colcount={cols.length + 2} data-testid="device-grid" style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          {header}
          <div
            ref={bodyRef}
            role="rowgroup"
            data-testid="grid-body"
            style={{ height: BODY_H, overflow: 'auto', position: 'relative' }}
            onScroll={(e) => {
              const el = e.currentTarget
              if (headerRef.current) headerRef.current.scrollLeft = el.scrollLeft
              if (Math.floor(el.scrollTop / ROW_H) !== Math.floor(scrollTop / ROW_H)) {
                setScrollTop(el.scrollTop)
                merge({ firstVisibleRow: Math.floor(el.scrollTop / ROW_H) + 1 })
              }
            }}
          >
            <div style={{ height: pageRows.length * ROW_H, width: totalWidth, position: 'relative' }} data-rendered={visible.length}>
              {visible.map((d, i) => renderRow(d, start + i))}
            </div>
            {pageRows.length === 0 ? <p style={{ padding: '1rem' }}>No devices match the filter.</p> : null}
          </div>
        </div>
      </Card>

      <div style={{ height: '85vh' }} data-testid="fold-spacer">
        <p data-ui="hint">The pagination controls are below the fold. Scroll down.</p>
      </div>

      <Card title="Pagination" data-testid="pagination">
        <div data-ui="inline">
          <label data-ui="inline">
            Rows per page
            <select
              id={t.id('rows-per-page')}
              value={pageSize}
              onChange={(e) => {
                const n = Number(e.target.value)
                setPageSize(n)
                toPage(1)
                merge({ pageSize: n })
              }}
            >
              {[25, 50, 100, 250].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button id={t.id('prev-page')} disabled={curPage <= 1} onClick={() => toPage(curPage - 1)}>
            {t.v('Previous page', 'Previous')}
          </button>
          <span aria-label="Page indicator" data-testid="page-indicator" role="status">
            Page {curPage} of {pages}
          </span>
          <button id={t.id(t.v('next-page', 'pager-next'))} className={t.cls('pager__next')} disabled={curPage >= pages} onClick={() => toPage(curPage + 1)}>
            {t.v('Next page', 'Next')}
          </button>
        </div>
      </Card>

      <Modal open={!!confirm} title="Save changes?" labelledBy="grid-confirm-title" onClose={() => setConfirm(null)} data-testid="confirm-save">
        <p>
          Rename <strong>{confirm?.from}</strong> to <strong>{confirm?.to}</strong>?
        </p>
        <div data-ui="inline">
          <button data-variant="primary" id={t.id('confirm-save')} onClick={onSave}>
            Save
          </button>
          <button
            id={t.id('confirm-cancel')}
            onClick={() => {
              merge({ lastAction: `cancel:${confirm?.id}` })
              setConfirm(null)
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  )
}
