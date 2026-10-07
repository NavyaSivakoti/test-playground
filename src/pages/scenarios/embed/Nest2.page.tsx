import { useLocation } from 'react-router-dom'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { embedSrc } from '../shared'

export const meta: PageMeta = {
  path: '/embed/nest-2',
  title: 'Nested frame level 2 (embedded)',
  group: 'Scenarios',
  summary: 'Level 2 of the three-level nested iframe on the iframe lab.',
  hidden: true,
  bare: true,
}

export default function Nest2Page() {
  const t = useTraps('nest-2')
  const location = useLocation()
  return (
    <div style={{ padding: 8 }} data-testid="nest-2">
      <div>
        <strong>Level 2</strong>
      </div>
      <iframe
        name="nest-3"
        id={t.id(t.v("nest-3-frame", "nest-3-frame-v2"))}
        title="Level 3"
        src={embedSrc('embed/nest-3', location.search)}
        style={{ width: '100%', height: 170, border: '1px dashed var(--border)', borderRadius: 6 }}
      />
    </div>
  )
}
