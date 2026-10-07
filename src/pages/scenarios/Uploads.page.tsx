import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, fileInfo, useToast } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { embedSrc, type EmbedMessage } from './shared'
import { readFirstSheet } from './uploads/xlsx'

export const meta: PageMeta = {
  path: '/uploads',
  title: 'Upload lab',
  group: 'Scenarios',
  summary:
    'File uploads the hard way: plain and hidden inputs, a drop zone without any input, CSV and Excel validation, a delayed confirmation toast, an input inside an iframe, multiple files and a type filter.',
  covers: [547, 672, 491],
  order: 2,
  samples: [
    {
      id: 'U1',
      title: 'Plain file input',
      steps: ['Navigate to <base>/uploads/', 'Upload the file at "#file-plain-u" from URL <base>fixtures/sample.csv with name sample.csv'],
      expected: 'state.uploads.plain.name = "sample.csv", size and sha256 of the real file.',
    },
    {
      id: 'U2',
      title: 'Hidden input behind a styled button',
      steps: ['Upload the file at "[data-testid=hidden-upload-input]" from URL <base>fixtures/avatar.png with name avatar.png'],
      expected: 'state.uploads.hidden.name = "avatar.png". The input is display:none; the visible button only opens the file chooser.',
    },
    {
      id: 'U3',
      title: 'Drop zone without an input element',
      steps: ['Upload the file at "[data-testid=drop-zone]" from URL <base>fixtures/notes.txt with name notes.txt'],
      expected:
        'There is no <input type=file> in the zone, so an input-based upload cannot work: state.uploads.dropped stays empty. Only a real drop event fills state.uploads.dropped = [{ name: "notes.txt" }].',
    },
    {
      id: 'U4',
      title: 'CSV header validation',
      steps: [
        'Upload the file at "#users-csv" from URL <base>fixtures/bad-missing-email.csv with name bad-missing-email.csv',
        'Verify that the current page displays text "Missing column: email"',
        'Upload the file at "#users-csv" from URL <base>fixtures/bad-empty.csv with name bad-empty.csv',
        'Verify that the current page displays text "File is empty"',
        'Upload the file at "#users-csv" from URL <base>fixtures/sample.csv with name sample.csv',
      ],
      expected: 'state.csv.error is set for the bad files; for sample.csv state.csv = { rows: 10, error: null }.',
    },
    {
      id: 'U5',
      title: 'Upload and verify the toast',
      query: 'renderDelay=1500',
      steps: ['Upload the file at "#toast-upload" from URL <base>fixtures/receipt.png with name receipt.png and verify that the toaster "Uploaded" is visible within 5 seconds.'],
      expected: 'The toast "Uploaded" appears renderDelay ms after the upload and stays ~2 s. state.uploads.toast.name = "receipt.png".',
    },
    {
      id: 'U6',
      title: 'Upload inside an iframe',
      steps: [
        'Switch to the frame named upload-frame',
        'Upload the file at "[data-testid=framed-file]" from URL <base>fixtures/sample.csv with name sample.csv',
        'Switch to the main page',
      ],
      expected: 'The frame posts the file info to the parent: state.frameUpload.name = "sample.csv".',
    },
    {
      id: 'U7',
      title: 'Excel line items',
      steps: [
        'Upload the file at "#line-items" from URL <base>fixtures/line-items.xlsx with name line-items.xlsx',
        'Verify that the current page displays text "Total: 510.50"',
        'Upload the file at "#line-items" from URL <base>fixtures/line-items-bad-headers.xlsx with name line-items-bad-headers.xlsx',
      ],
      expected: 'state.excel = { rows: 5, total: 510.5 } for the good file; the bad file gives state.excel.error starting "Wrong headers".',
    },
    {
      id: 'U8',
      title: 'Multiple files and type filter',
      steps: [
        'Upload the file at "#attachments" from URL <base>fixtures/sample.csv with name sample.csv',
        'Upload the file at "#profile-photo" from URL <base>fixtures/notes.txt with name notes.txt',
        'Verify that the current page displays text "Only image files are allowed"',
      ],
      expected: 'state.uploads.multi lists every file; state.imageRejected = "notes.txt".',
    },
  ],
}

type Info = Awaited<ReturnType<typeof fileInfo>>
const CSV_REQUIRED = ['name', 'email', 'role']
const XLSX_HEADERS = ['sku', 'description', 'quantity', 'unit_price']

export default function UploadsPage() {
  const t = useTraps('uploads')
  const config = useConfig()
  const location = useLocation()
  const { merge } = usePageState()
  const toast = useToast()
  const uploads = useRef<Record<string, unknown>>({})
  const hiddenRef = useRef<HTMLInputElement>(null)
  const [dropped, setDropped] = useState<Info[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [csv, setCsv] = useState<{ error: string | null; rows: number; headers: string[] } | null>(null)
  const [excel, setExcel] = useState<{ error: string | null; rows: (string | number)[][]; total: number } | null>(null)
  const [imageMsg, setImageMsg] = useState<string | null>(null)
  const [received, setReceived] = useState<Record<string, string>>({})

  const record = (key: string, value: unknown) => {
    uploads.current = { ...uploads.current, [key]: value }
    merge({ uploads: uploads.current })
  }

  useEffect(() => {
    merge({ uploads: {}, dropZone: { note: 'no input element in the drop zone; only drop events are handled' } })
    const onMsg = (e: MessageEvent) => {
      const d = e.data as EmbedMessage
      if (d?.source !== 'tp-embed' || d.frame !== 'upload-frame') return
      const f = d.file as Info
      merge({ frameUpload: f })
      setReceived((r) => ({ ...r, frame: f.name }))
    }
    window.addEventListener('message', onMsg)
    return () => {
      window.removeEventListener('message', onMsg)
    }
  }, [merge])

  const simple = (key: string) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    const info = await fileInfo(f)
    record(key, info)
    setReceived((r) => ({ ...r, [key]: info.name }))
  }

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const text = (await f.text()).replace(/^﻿/, '')
    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
    let res: { error: string | null; rows: number; headers: string[] }
    if (!lines.length) res = { error: 'File is empty', rows: 0, headers: [] }
    else {
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase())
      const missing = CSV_REQUIRED.filter((c) => !headers.includes(c))
      res = missing.length ? { error: `Missing column: ${missing.join(', ')}`, rows: lines.length - 1, headers } : { error: null, rows: lines.length - 1, headers }
    }
    setCsv(res)
    merge({ csv: { file: f.name, ...res } })
  }

  const onExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    try {
      const rows = await readFirstSheet(await f.arrayBuffer())
      const headers = (rows[0] ?? []).map((h) => String(h).trim().toLowerCase())
      if (XLSX_HEADERS.some((h, i) => headers[i] !== h)) {
        const error = `Wrong headers: expected ${XLSX_HEADERS.join(', ')} but got ${headers.join(', ') || 'nothing'}`
        setExcel({ error, rows: [], total: 0 })
        merge({ excel: { file: f.name, error, rows: 0, total: null } })
        return
      }
      const body = rows.slice(1).filter((r) => r.some((c) => c !== ''))
      const total = Math.round(body.reduce((s, r) => s + Number(r[2]) * Number(r[3]), 0) * 100) / 100
      setExcel({ error: null, rows: body, total })
      merge({ excel: { file: f.name, error: null, rows: body.length, total, skus: body.map((r) => r[0]) } })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      setExcel({ error, rows: [], total: 0 })
      merge({ excel: { file: f.name, error, rows: 0, total: null } })
    }
  }

  const fileLabel = (key: string) => (received[key] ? <span data-ui="hint" data-testid={`received-${key}`}>Received {received[key]}</span> : null)

  return (
    <>
      <div data-ui="grid">
        <Card title="Plain input" data-testid="u1">
          <label data-ui="field">
            <span>{t.v('Plain file', 'Attachment (plain)')}</span>
            <input type="file" id={t.v(t.id('file-plain-u'), t.id('plain-file-v2'))} data-testid={t.v('file-plain-u', 'plain-file-v2')} onChange={simple('plain')} />
          </label>
          {fileLabel('plain')}
        </Card>

        <Card title="Hidden input" data-testid="u2">
          <p data-ui="hint">The real input is display:none. The button only forwards the click to it.</p>
          <button type="button" data-variant="primary" id={t.id('choose-file')} onClick={() => hiddenRef.current?.click()}>
            {t.v('Choose file', 'Browse files')}
          </button>
          <input ref={hiddenRef} type="file" data-testid="hidden-upload-input" id={t.id('hidden-upload')} style={{ display: 'none' }} onChange={simple('hidden')} />
          {fileLabel('hidden')}
        </Card>

        <Card title="Drop zone" data-testid="u3">
          <div
            data-testid="drop-zone"
            id={t.id('drop-zone')}
            aria-label="Drop files here"
            onDragOver={(e) => {
              e.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={async (e) => {
              e.preventDefault()
              setDragOver(false)
              const infos = await Promise.all(Array.from(e.dataTransfer.files).map(fileInfo))
              const all = [...dropped, ...infos]
              setDropped(all)
              record('dropped', all)
            }}
            style={{
              border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 10,
              padding: '1.6rem',
              textAlign: 'center',
              background: dragOver ? 'var(--surface-2)' : undefined,
            }}
          >
            Drop files here
          </div>
          <p data-ui="hint">There is no file input here at all: only drag-and-drop events work.</p>
          {dropped.length ? (
            <ul data-testid="dropped-list">
              {dropped.map((d, i) => (
                <li key={i}>{d.name}</li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="CSV import" data-testid="u4">
          <label data-ui="field">
            <span>{t.v('Users CSV', 'Users file (CSV)')}</span>
            <input type="file" accept=".csv,text/csv" id={t.v(t.id('users-csv'), t.id('users-file'))} onChange={onCsv} />
            <span data-ui="hint">Required columns: name, email, role</span>
          </label>
          {csv?.error ? (
            <div data-ui="error" role="alert" data-testid="csv-error">
              {csv.error}
            </div>
          ) : null}
          {csv && !csv.error ? <div data-testid="csv-ok">Imported {csv.rows} users</div> : null}
        </Card>

        <Card title="Upload with confirmation" data-testid="u5">
          <label data-ui="field">
            <span>{t.v('Receipt', 'Receipt image')}</span>
            <input
              type="file"
              id={t.id('toast-upload')}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                const info = await fileInfo(f)
                record('toast', info)
                toast(config.bugs.includes('toastText') ? 'Upload failed' : 'Uploaded', { tone: 'success', ms: 2000, delayMs: config.renderDelay })
              }}
            />
            <span data-ui="hint">The “Uploaded” toast appears after the render delay ({config.renderDelay} ms) and disappears after 2 s.</span>
          </label>
        </Card>

        <Card title="Upload inside an iframe" data-testid="u6">
          <iframe
            name="upload-frame"
            title="Upload frame"
            src={embedSrc('embed/upload-frame', location.search)}
            style={{ width: '100%', height: 130, border: '1px solid var(--border)', borderRadius: 8 }}
          />
          {fileLabel('frame')}
        </Card>

        <Card title="Multiple files" data-testid="u7">
          <label data-ui="field">
            <span>{t.v('Attachments', 'Attach files')}</span>
            <input
              type="file"
              multiple
              id={t.id('attachments')}
              onChange={async (e) => {
                const infos = await Promise.all(Array.from(e.target.files ?? []).map(fileInfo))
                record('multi', infos)
                setReceived((r) => ({ ...r, multi: infos.map((i) => i.name).join(', ') }))
              }}
            />
          </label>
          {fileLabel('multi')}
        </Card>

        <Card title="Images only" data-testid="u8">
          <label data-ui="field">
            <span>{t.v('Profile photo', 'Profile picture')}</span>
            <input
              type="file"
              accept="image/*"
              id={t.id('profile-photo')}
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                if (!f.type.startsWith('image/')) {
                  setImageMsg('Only image files are allowed')
                  merge({ imageRejected: f.name })
                  return
                }
                setImageMsg(null)
                record('image', await fileInfo(f))
                merge({ imageRejected: null })
                setReceived((r) => ({ ...r, image: f.name }))
              }}
            />
          </label>
          {imageMsg ? (
            <div data-ui="error" role="alert">
              {imageMsg}
            </div>
          ) : null}
          {fileLabel('image')}
        </Card>
      </div>

      <Card title="Excel line items" data-testid="u9">
        <label data-ui="field">
          <span>{t.v('Line items (Excel)', 'Line items spreadsheet')}</span>
          <input type="file" accept=".xlsx" id={t.id('line-items')} onChange={onExcel} />
          <span data-ui="hint">Required headers: {XLSX_HEADERS.join(', ')}</span>
        </label>
        {excel?.error ? (
          <div data-ui="error" role="alert" data-testid="excel-error">
            {excel.error}
          </div>
        ) : null}
        {excel && !excel.error ? (
          <>
            <table data-testid="excel-table">
              <thead>
                <tr>
                  {XLSX_HEADERS.map((h) => (
                    <th key={h} style={{ textAlign: 'left', paddingRight: 16 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {excel.rows.map((r, i) => (
                  <tr key={i}>
                    {r.slice(0, 4).map((c, j) => (
                      <td key={j} style={{ paddingRight: 16 }}>
                        {j === 3 ? Number(c).toFixed(2) : String(c)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p data-testid="excel-total">
              <strong>Total: {excel.total.toFixed(2)}</strong>
            </p>
          </>
        ) : null}
      </Card>
    </>
  )
}
