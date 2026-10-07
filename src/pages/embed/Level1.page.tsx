import { useConfig } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { routeUrl } from '../steps/windowsShared'

export const meta: PageMeta = {
  path: '/embed/level-1',
  title: 'Frame level 1',
  group: 'Step baselines',
  summary: 'Level 1 of the nested frame chain on the Frames page.',
  hidden: true,
  bare: true,
}

export default function Level1Page() {
  const config = useConfig()
  return (
    <main style={{ padding: 6, border: '2px dashed var(--border)' }}>
      <p style={{ margin: '0 0 0.4rem' }}>Level 1 frame</p>
      <iframe
        name="frame-level-2"
        title="Level 2 frame"
        src={routeUrl('embed/level-2', config)}
        style={{ width: '100%', height: 260, border: '1px solid var(--border)' }}
      />
    </main>
  )
}
