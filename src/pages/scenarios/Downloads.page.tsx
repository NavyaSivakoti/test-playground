import { useMemo, useRef, useState } from 'react'
import { Card, publicUrl, useToast } from '../../components/ui'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { downloadText, isoDate, sha256Text, useStateLog } from './business/util'

export const meta: PageMeta = {
  path: '/downloads',
  title: 'Downloads',
  group: 'Scenarios',
  summary:
    'Files to download and inspect: a generated CSV, a spreadsheet, an invoice PDF, a PDF that opens in a new tab, a file that is prepared on the server for a few seconds and a file whose name contains the current date.',
  covers: [580, 581, 464, 34, 348, 26, 145],
  order: 12,
  samples: [
    {
      id: 'D1',
      title: 'Download the orders CSV',
      steps: ['Navigate to <base>/downloads/', 'Download file by click on "Orders CSV"'],
      expected: 'A file orders.csv with a header and 10 rows; state.downloads[0] = { name: "orders.csv", rows: 10 }.',
    },
    {
      id: 'D2',
      title: 'Check the invoice PDF',
      steps: ['Download file by click on "Invoice PDF"', 'AI Document Ask: What is the invoice total and how many line items are there?'],
      expected: 'invoice.pdf; the answer is $510.50 and 5 line items. state.downloads has name "invoice.pdf".',
    },
    {
      id: 'D3',
      title: 'PDF in a new tab',
      steps: ['Click on "Open invoice in a new tab" and switch to the new window', 'Verify that the current page has url containing invoice.pdf', 'Close the current window'],
      expected: 'The link has target=_blank; state.openedInNewTab = 1.',
    },
    {
      id: 'D4',
      title: 'File prepared after a delay',
      steps: ['Click on "Prepare export"', 'Wait until the text "Your file is ready" is present on the current page'],
      expected: '"Preparing your file…" shows for 3 s, then export-ready.csv downloads. state.prepared = { status: "delivered", ms ≥ 3000 }.',
    },
    {
      id: 'D5',
      title: 'Dated file name',
      query: 'now=2026-10-06T09:00:00Z',
      steps: ['Download file by click on "Daily report"'],
      expected: 'The file is report-2026-10-06.csv (date from the frozen clock); state.downloads contains that name.',
    },
    {
      id: 'D6',
      title: 'Broken download link (deliberate bug)',
      query: 'bugs=brokenLink',
      steps: ['Download file by click on "Line items spreadsheet"'],
      expected: 'The link points to a missing file and returns 404; state.downloads[0].status = 404.',
    },
  ],
}

interface DownloadEntry {
  name: string
  kind: string
  size?: number
  rows?: number
  status?: number
  sha256?: string
}

const ORDERS = [
  ['ORD-1001', 'Ada Lovelace', 'Keyboard', '2', '89.00'],
  ['ORD-1002', 'Grace Hopper', 'Monitor', '1', '249.99'],
  ['ORD-1003', 'Alan Turing', 'Mouse', '3', '24.50'],
  ['ORD-1004', 'Katherine Johnson', 'Laptop stand', '1', '51.25'],
  ['ORD-1005', 'Margaret Hamilton', 'USB hub', '2', '19.90'],
  ['ORD-1006', 'Edsger Dijkstra', 'Webcam', '1', '64.00'],
  ['ORD-1007', 'Barbara Liskov', 'Headset', '1', '79.95'],
  ['ORD-1008', 'Donald Knuth', 'Desk lamp', '2', '32.40'],
  ['ORD-1009', 'Frances Allen', 'Notebook', '5', '4.99'],
  ['ORD-1010', 'John Backus', 'Cable kit', '1', '15.00'],
]
const ORDERS_CSV = ['order_id,customer,item,quantity,unit_price', ...ORDERS.map((r) => r.join(','))].join('\n') + '\n'

export default function DownloadsPage() {
  const t = useTraps('downloads')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const log = useStateLog<DownloadEntry>('downloads')
  const [prep, setPrep] = useState<'idle' | 'preparing' | 'ready'>('idle')
  const newTabs = useRef(0)
  const broken = config.bugs.includes('brokenLink')
  const today = isoDate(nowMs(config))
  const reportName = `report-${today}.csv`
  const reportCsv = useMemo(() => `date,sessions,exports\n${today},128,14\n`, [today])
  const ordersHref = useMemo(() => URL.createObjectURL(new Blob([ORDERS_CSV], { type: 'text/csv' })), [])
  const reportHref = useMemo(() => URL.createObjectURL(new Blob([reportCsv], { type: 'text/csv' })), [reportCsv])

  const recordFixture = (name: string, kind: string, path: string) => {
    // Probe the same URL so the state records what the server really returned (size or 404).
    fetch(publicUrl(path), { headers: { accept: 'application/octet-stream' } })
      .then(async (res) => {
        const buf = res.ok ? await res.arrayBuffer() : null
        log.append({ name, kind, status: res.status, size: buf?.byteLength })
        if (!res.ok) toast(`Download failed (${res.status})`, { tone: 'danger' })
      })
      .catch(() => log.append({ name, kind, status: 0 }))
  }

  const xlsxPath = broken ? 'fixtures/line-items-missing.xlsx' : 'fixtures/line-items.xlsx'

  return (
    <>
      <Card title="Files">
        <ul style={{ lineHeight: 2 }}>
          <li>
            <a
              href={ordersHref}
              download="orders.csv"
              id={t.id(t.v('orders-csv', 'dl-orders'))}
              className={t.cls('dl__link')}
              data-testid="orders-csv"
              onClick={async () => log.append({ name: 'orders.csv', kind: 'csv', rows: 10, size: ORDERS_CSV.length, sha256: await sha256Text(ORDERS_CSV) })}
            >
              {t.v('Orders CSV', 'Orders (CSV)')}
            </a>{' '}
            <span data-ui="hint">10 orders, generated in the browser</span>
          </li>
          <li>
            <a
              href={publicUrl(xlsxPath)}
              download="line-items.xlsx"
              id={t.id('line-items-xlsx')}
              data-testid="line-items-xlsx"
              onClick={() => recordFixture('line-items.xlsx', 'xlsx', xlsxPath)}
            >
              Line items spreadsheet
            </a>{' '}
            <span data-ui="hint">5 items, total 510.50</span>
          </li>
          <li>
            <a
              href={publicUrl('fixtures/invoice.pdf')}
              download="invoice.pdf"
              id={t.id('invoice-pdf')}
              data-testid="invoice-pdf"
              onClick={() => recordFixture('invoice.pdf', 'pdf', 'fixtures/invoice.pdf')}
            >
              Invoice PDF
            </a>{' '}
            <span data-ui="hint">INV-2026-0042, 5 line items</span>
          </li>
          <li>
            <a
              href={publicUrl('fixtures/invoice.pdf')}
              target="_blank"
              rel="noopener"
              id={t.id('invoice-new-tab')}
              data-testid="invoice-new-tab"
              onClick={() => {
                newTabs.current += 1
                merge({ openedInNewTab: newTabs.current })
              }}
            >
              {t.v('Open invoice in a new tab', 'View invoice in a new tab')}
            </a>
          </li>
          <li>
            <a
              href={reportHref}
              download={reportName}
              id={t.id('daily-report')}
              data-testid="daily-report"
              onClick={async () => log.append({ name: reportName, kind: 'csv', rows: 1, size: reportCsv.length, sha256: await sha256Text(reportCsv) })}
            >
              Daily report
            </a>{' '}
            <span data-ui="hint">
              file name: <code>{reportName}</code> (date from the clock; freeze it with <code>now=</code>)
            </span>
          </li>
        </ul>
      </Card>

      <Card title="Server-side export">
        <p>The export is generated on the server and downloads automatically when it is ready.</p>
        <button
          id={t.id(t.v('prepare-export', 'start-export'))}
          className={t.cls('dl__prepare')}
          disabled={prep === 'preparing'}
          onClick={() => {
            const started = performance.now()
            setPrep('preparing')
            merge({ prepared: { status: 'preparing' } })
            setTimeout(async () => {
              const csv = 'id,status\n1,exported\n2,exported\n'
              downloadText('export-ready.csv', csv)
              setPrep('ready')
              const ms = Math.round(performance.now() - started)
              merge({ prepared: { status: 'delivered', ms, name: 'export-ready.csv' } })
              log.append({ name: 'export-ready.csv', kind: 'csv', rows: 2, size: csv.length, sha256: await sha256Text(csv) })
            }, 3000)
          }}
        >
          {t.v('Prepare export', 'Generate export')}
        </button>
        {prep === 'preparing' ? (
          <p role="status" data-testid="preparing">
            Preparing your file…
          </p>
        ) : null}
        {prep === 'ready' ? (
          <p role="status" data-testid="export-ready">
            Your file is ready: export-ready.csv
          </p>
        ) : null}
      </Card>
      {broken ? <p data-ui="hint">bugs=brokenLink is on: one download link points to a missing file.</p> : null}
    </>
  )
}
