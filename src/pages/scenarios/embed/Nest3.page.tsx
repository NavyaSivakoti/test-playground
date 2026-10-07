import { useState } from 'react'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { postToParent } from '../shared'

export const meta: PageMeta = {
  path: '/embed/nest-3',
  title: 'Nested frame level 3 (embedded)',
  group: 'Scenarios',
  summary: 'Level 3 of the three-level nested iframe on the iframe lab.',
  hidden: true,
  bare: true,
}

export default function Nest3Page() {
  const t = useTraps('nest-3')
  const [clicks, setClicks] = useState(0)
  return (
    <div style={{ padding: 8 }} data-testid="nest-3">
      <div>
        <strong>Level 3</strong>
      </div>
      <label data-ui="field">
        <span>{t.v('Deep field', 'Innermost field')}</span>
        <input id={t.id('deep-field')} onChange={(e) => postToParent({ frame: 'nest-3', type: 'input', value: e.target.value }, 'top')} />
      </label>
      <button
        id={t.id(t.v('deep-button', 'deep-button-v2'))}
        onClick={() => {
          setClicks((c) => c + 1)
          postToParent({ frame: 'nest-3', type: 'click' }, 'top')
        }}
      >
        {t.v('Deep button', 'Innermost button')}
      </button>
      {clicks ? <span data-testid="deep-clicks"> Clicked {clicks}×</span> : null}
    </div>
  )
}
