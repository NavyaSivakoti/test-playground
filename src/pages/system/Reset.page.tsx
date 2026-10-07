import { useState } from 'react'
import { backend } from '../../core/backend'
import { useConfig, usePageState } from '../../core/playground'
import { broadcastReset, clearBrowserStorage } from '../../core/reset'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/system/reset',
  title: 'Reset namespace',
  group: 'System',
  summary:
    'Clears everything that belongs to one namespace: server records, browser storage (cookies, local/session storage, IndexedDB) and the in-memory state of open frames and tabs.',
  order: 2,
  samples: [
    {
      id: 'R1',
      title: 'Reset before a run',
      query: 'ns=run42',
      steps: ['Navigate to <base>/system/reset/?ns=run42', 'Click on "Reset namespace run42"', 'Wait until the text "Reset complete" is present on the current page'],
      expected: 'Text "Reset complete: N records, M keys, K frames"; a second reset reports 0 records and 0 keys.',
    },
  ],
}

export default function Reset() {
  const config = useConfig()
  const { merge } = usePageState()
  const [report, setReport] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async () => {
    setBusy(true)
    setReport(null)
    const [server, keys, frames] = await Promise.all([
      backend.reset(config.ns).catch(() => ({ records: -1 })),
      clearBrowserStorage(config.ns),
      broadcastReset(config.ns),
    ])
    const text = `Reset complete: ${server.records} records, ${keys} keys, ${frames} frames`
    setReport(text)
    merge({ reset: { records: server.records, keys, frames } })
    setBusy(false)
  }
  return (
    <div data-ui="card">
      <p>
        Namespace: <code data-testid="reset-ns">{config.ns}</code>
      </p>
      <button data-variant="danger" disabled={busy} onClick={run}>
        Reset namespace {config.ns}
      </button>
      {report ? (
        <p role="status" data-testid="reset-report">
          {report}
        </p>
      ) : null}
    </div>
  )
}
