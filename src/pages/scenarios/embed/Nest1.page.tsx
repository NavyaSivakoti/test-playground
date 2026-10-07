import { useLocation } from 'react-router-dom'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { embedSrc } from '../shared'

export const meta: PageMeta = {
  path: '/embed/nest-1',
  title: 'Nested frame level 1 (embedded)',
  group: 'Scenarios',
  summary: 'Level 1 of the three-level nested iframe on the iframe lab.',
  hidden: true,
  bare: true,
}

export default function Nest1Page() {
  const t = useTraps('nest-1')
  const location = useLocation()
  return (
    <div style={{ padding: 8 }} data-testid="nest-1">
      <div>
        <strong>Level 1</strong>
      </div>
      <iframe
        name="nest-2"
        id={t.id(t.v("nest-2-frame", "nest-2-frame-v2"))}
        title="Level 2"
        src={embedSrc('embed/nest-2', location.search)}
        style={{ width: '100%', height: 320, border: '1px dashed var(--border)', borderRadius: 6 }}
      />
    </div>
  )
}
