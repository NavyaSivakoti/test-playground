import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { postToParent } from '../shared'

export const meta: PageMeta = {
  path: '/embed/sidebar-addin',
  title: 'Sidebar add-in (embedded)',
  group: 'Scenarios',
  summary: 'Bare add-in panel loaded inside an iframe on the iframe lab.',
  hidden: true,
  bare: true,
}

/** `?as=dynamic` turns it into the "dynamic frame" content (button "Confirm"). */
export default function SidebarAddinPage() {
  const t = useTraps('sidebar-addin')
  const [params] = useSearchParams()
  const dynamic = params.get('as') === 'dynamic'
  const frame = dynamic ? 'dynamic-frame' : 'sidebar-addin'
  const [count, setCount] = useState(0)
  const label = dynamic ? t.v('Confirm', 'Confirm choice') : t.v('Insert', 'Insert into document')
  return (
    <div style={{ padding: 12, background: 'var(--surface)', minHeight: '100vh' }}>
      <strong>{dynamic ? 'Dynamic frame' : t.v('Snippets', 'Snippet library')}</strong>
      <p data-ui="hint" style={{ margin: '0.3rem 0 0.6rem' }}>
        {dynamic ? 'This frame gets a new name on every load.' : 'Insert a greeting into the document.'}
      </p>
      <button
        data-variant="primary"
        id={t.id(t.v(dynamic ? 'confirm' : 'insert', dynamic ? 'confirm-v2' : 'insert-snippet'))}
        data-testid={t.v(dynamic ? 'confirm' : 'insert', dynamic ? 'confirm-v2' : 'insert-snippet')}
        onClick={() => {
          setCount((c) => c + 1)
          postToParent({ frame, type: dynamic ? 'confirm' : 'insert', text: 'Hello from the add-in' })
        }}
      >
        {label}
      </button>
      {count ? <div data-testid="frame-count">Clicked {count}×</div> : null}
    </div>
  )
}
