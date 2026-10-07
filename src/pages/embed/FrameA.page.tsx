import { useState } from 'react'
import { useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/embed/frame-a',
  title: 'Frame A',
  group: 'Step baselines',
  summary: 'Content of the "frame-a" iframe on the Frames page.',
  hidden: true,
  bare: true,
}

export default function FrameAPage() {
  const t = useTraps('frame-a')
  const [done, setDone] = useState(false)
  return (
    <main style={{ padding: 8 }}>
      <p style={{ margin: '0 0 0.5rem' }}>Frame A content</p>
      <button
        id={t.id('insert')}
        className={t.cls('btn btn--insert')}
        onClick={() => {
          window.parent.postMessage({ type: 'tp-frame', action: 'insert' }, window.location.origin)
          setDone(true)
        }}
      >
        Insert
      </button>
      {done ? <span data-testid="frame-a-done"> Sent to parent</span> : null}
    </main>
  )
}
