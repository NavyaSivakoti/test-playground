import { useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/embed/level-3',
  title: 'Frame level 3',
  group: 'Step baselines',
  summary: 'Innermost frame of the nested chain on the Frames page.',
  hidden: true,
  bare: true,
}

export default function Level3Page() {
  const t = useTraps('level-3')
  return (
    <main style={{ padding: 6 }}>
      <label data-ui="field">
        <span>Deep value</span>
        <input
          id={t.id('deep-value')}
          className={t.cls('input input--deep')}
          onChange={(e) => window.top?.postMessage({ type: 'tp-frame', action: 'deep-value', value: e.target.value }, window.location.origin)}
        />
      </label>
    </main>
  )
}
