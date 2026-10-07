import { useState } from 'react'
import { Card, publicUrl } from '../../components/ui'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/download',
  title: 'File download and documents',
  group: 'Step baselines',
  summary: 'A generated CSV download, fixture PDF and XLSX downloads with known contents, and a small form whose data a generated document can use.',
  covers: [580, 581, 644],
  order: 25,
  samples: [
    {
      id: 'D1',
      title: 'Download a generated CSV',
      steps: ['Navigate to <base>/steps/download/', 'Download file by click on "Download CSV"'],
      expected: 'File orders.csv with 11 lines (header + 10 rows); state.downloads[0] = { name: "orders.csv", lines: 11 }.',
    },
    {
      id: 'D2',
      title: 'Ask about the invoice PDF',
      steps: ['Download file by click on "Download invoice PDF"', 'AI Document Ask: how many line items are in invoice.pdf and what is the total?'],
      expected: 'Answer: 5 line items, total $510.50 (invoice INV-2026-0042).',
    },
    {
      id: 'D3',
      title: 'Generate a document from form data',
      steps: ['Enter Grace Hopper in the "Customer" field', 'Enter 510.50 in the "Amount" field', 'Click on "Generate document"', 'Generate Document'],
      expected: 'Preview shows "Quote for Grace Hopper" and "Amount: $510.50"; state.document = { customer: "Grace Hopper", amount: "510.50" }.',
    },
  ],
}

const ITEMS = ['Blue mug', 'Notebook', 'Desk lamp', 'USB cable', 'Stapler', 'Water bottle', 'Mouse pad', 'Sticky notes', 'Pen set', 'Headphones']
function ordersCsv(): string {
  const rows = ITEMS.map((item, i) => {
    const qty = (i % 3) + 1
    const price = (5 + i * 2.5).toFixed(2)
    return `ORD-${1001 + i},${item},${qty},${price},${(qty * Number(price)).toFixed(2)}`
  })
  return ['order_id,item,quantity,unit_price,total', ...rows].join('\n') + '\n'
}

export default function DownloadPage() {
  const t = useTraps('download')
  const config = useConfig()
  const { state, merge } = usePageState()
  const [customer, setCustomer] = useState('')
  const [amount, setAmount] = useState('')
  const downloads = (state.downloads as Record<string, unknown>[]) ?? []
  const note = (d: Record<string, unknown>) => merge({ downloads: [...downloads, { ...d, at: new Date(nowMs(config)).toISOString() }] })

  const csvBtn = (
    <button
      id={t.id(t.v('download-csv', 'csv-download'))}
      className={t.cls('btn btn--csv')}
      data-testid="download-csv"
      onClick={() => {
        const csv = ordersCsv()
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        const a = document.createElement('a')
        a.href = url
        a.download = 'orders.csv'
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 5000)
        note({ name: 'orders.csv', lines: csv.trim().split('\n').length, size: csv.length })
      }}
    >
      Download CSV
    </button>
  )

  return (
    <>
      <Card title="Downloads">
        {t.v(
          <div data-ui="inline">{csvBtn}</div>,
          <div data-ui="inline" data-wrapper="download-v2">
            <span>{csvBtn}</span>
          </div>,
        )}
        <p data-ui="hint">orders.csv is generated in the browser: a header plus 10 fixed rows.</p>
        <ul>
          <li>
            <a
              id={t.id('download-pdf')}
              className={t.cls('link link--pdf')}
              href={config.bugs.includes('brokenLink') ? publicUrl('fixtures/missing-invoice.pdf') : publicUrl('fixtures/invoice.pdf')}
              download="invoice.pdf"
              onClick={() => note({ name: 'invoice.pdf' })}
            >
              Download invoice PDF
            </a>{' '}
            <span data-ui="hint">Invoice INV-2026-0042, 5 line items.</span>
          </li>
          <li>
            <a id={t.id('download-xlsx')} className={t.cls('link link--xlsx')} href={publicUrl('fixtures/line-items.xlsx')} download="line-items.xlsx" onClick={() => note({ name: 'line-items.xlsx' })}>
              {t.v('Download line items XLSX', 'Download line items (XLSX)')}
            </a>{' '}
            <span data-ui="hint">5 line items.</span>
          </li>
        </ul>
        <p data-testid="download-count">Downloads started: {downloads.length}</p>
      </Card>

      <Card title="Generate a document">
        <p data-ui="hint">Fill the form and generate a preview. A generated document (for example a quote) can use the same data.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            merge({ document: { customer, amount } })
          }}
        >
          <label data-ui="field">
            <span>Customer</span>
            <input id={t.id('doc-customer')} className={t.cls('input input--customer')} value={customer} onChange={(e) => setCustomer(e.target.value)} />
          </label>
          <label data-ui="field">
            <span>Amount</span>
            <input id={t.id('doc-amount')} className={t.cls('input input--amount')} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </label>
          <button type="submit" id={t.id('generate-document')} className={t.cls('btn btn--generate')} disabled={!customer.trim()}>
            Generate document
          </button>
        </form>
        {state.document ? (
          <article data-ui="card" data-testid="document-preview" aria-label="Document preview">
            <h3 style={{ marginTop: 0 }}>Quote for {(state.document as { customer: string }).customer}</h3>
            <p>Amount: ${Number((state.document as { amount: string }).amount || 0).toFixed(2)}</p>
            <p data-ui="hint">Valid for 30 days.</p>
          </article>
        ) : null}
      </Card>
    </>
  )
}
