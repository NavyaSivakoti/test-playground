import { useEffect } from 'react'
import { StatePanel } from '../../components/PageShell'
import { usePageState } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/windows/popup',
  title: 'Popup window',
  group: 'Step baselines',
  summary: 'Small popup opened by the Windows page.',
  hidden: true,
  bare: true,
}

export default function WindowPopupPage() {
  const { merge } = usePageState()
  useEffect(() => {
    document.title = 'Popup window'
    const init = setTimeout(() => merge({ popup: true, size: { width: window.innerWidth, height: window.innerHeight } }), 0)
    return () => clearTimeout(init)
  }, [merge])
  return (
    <main data-ui="main">
      <h1>Popup content</h1>
      <p>This popup was opened with window.open and a width/height feature string.</p>
      <button onClick={() => window.close()}>Close popup</button>
      <StatePanel />
    </main>
  )
}
