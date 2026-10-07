import { useEffect, useState } from 'react'
import { backend } from '../../core/backend'
import type { PlaygroundConfig } from '../../core/config'
import { usePlayground, usePageState } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/system/drift',
  title: 'Server-side drift (self-heal)',
  group: 'System',
  summary:
    'Changes the DOM of a namespace without changing any URL. Record a test on variant a, switch the namespace to variant b here, rerun the same test and check whether Auto-Heal recovers.',
  order: 3,
  samples: [
    {
      id: 'H1',
      title: 'Self-heal after drift',
      query: 'ns=heal1',
      steps: [
        'Record and run a test on <base>/widgets/?ns=heal1 (variant a)',
        'Open <base>/system/drift/?ns=heal1 and click "Switch to variant b"',
        'Rerun the same, unchanged test',
      ],
      expected: 'The widgets page now renders variant b (moved and relabelled controls) for ns=heal1 only; the run either heals and the state matches, or fails reproducibly.',
    },
  ],
}

export default function Drift() {
  const { config, reloadServerConfig } = usePlayground()
  const { merge } = usePageState()
  const [current, setCurrent] = useState<Partial<PlaygroundConfig>>({})
  useEffect(() => {
    void backend.getConfig(config.ns).then(setCurrent)
  }, [config.ns])
  const save = async (cfg: Partial<PlaygroundConfig>) => {
    await backend.setConfig(config.ns, cfg)
    setCurrent(cfg)
    merge({ serverConfig: cfg })
    reloadServerConfig()
  }
  return (
    <div data-ui="card">
      <p>
        Namespace <code>{config.ns}</code> server override: <code data-testid="drift-current">{JSON.stringify(current)}</code>
      </p>
      <div data-ui="inline">
        <button data-variant="primary" onClick={() => save({ ...current, variant: 'b' })}>
          Switch to variant b
        </button>
        <button onClick={() => save({ ...current, unstableIds: true })}>Turn on unstable ids</button>
        <button onClick={() => save({ ...current, duplicateLabels: true })}>Turn on duplicate labels</button>
        <button onClick={() => save({})}>Clear override</button>
      </div>
      <p data-ui="hint">
        Overrides apply to every page opened with <code>?ns={config.ns}</code>. They never affect other namespaces.
      </p>
    </div>
  )
}
