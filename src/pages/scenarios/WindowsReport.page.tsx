import { useEffect, useState } from 'react'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/windows/report',
  title: 'Quarterly report',
  group: 'Scenarios',
  summary: 'Child tab opened by the windows scenario. It starts blank and fills in after 2 seconds.',
  hidden: true,
  bare: true,
}

export default function WindowsReportPage() {
  const t = useTraps('windows-report')
  const config = useConfig()
  const { merge } = usePageState()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    document.title = 'Quarterly report'
    const timer = setTimeout(() => {
      setLoaded(true)
      merge({ loaded: true, loadedAfterMs: 2000 })
      if (typeof BroadcastChannel !== 'undefined') {
        const ch = new BroadcastChannel('tp-windows')
        ch.postMessage({ type: 'report-loaded', ns: config.ns })
        ch.close()
      }
    }, 2000)
    return () => clearTimeout(timer)
  }, [config.ns, merge])

  if (!loaded) return <main data-ui="main" data-testid="report-blank" />
  return (
    <main data-ui="main" data-testid="report">
      <h1>Quarterly report</h1>
      <table style={{ maxWidth: 420 }}>
        <tbody>
          <tr>
            <th scope="row">Revenue</th>
            <td id={t.id('report-revenue')}>$1,284,000</td>
          </tr>
          <tr>
            <th scope="row">New accounts</th>
            <td>342</td>
          </tr>
          <tr>
            <th scope="row">Churn</th>
            <td>2.1%</td>
          </tr>
        </tbody>
      </table>
      <button id={t.id('close-report')} onClick={() => window.close()}>
        Close report
      </button>
    </main>
  )
}
