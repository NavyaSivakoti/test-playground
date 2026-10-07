import { useConfig } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { routeUrl } from '../steps/windowsShared'

export const meta: PageMeta = {
  path: '/embed/level-2',
  title: 'Frame level 2',
  group: 'Step baselines',
  summary: 'Level 2 of the nested frame chain on the Frames page.',
  hidden: true,
  bare: true,
}

export default function Level2Page() {
  const config = useConfig()
  return (
    <main style={{ padding: 6, border: '2px dashed var(--border)' }}>
      <p style={{ margin: '0 0 0.4rem' }}>Level 2 frame</p>
      <iframe
        name="frame-level-3"
        title="Level 3 frame"
        src={routeUrl('embed/level-3', config)}
        style={{ width: '100%', height: 160, border: '1px solid var(--border)' }}
      />
    </main>
  )
}
