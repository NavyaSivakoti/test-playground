import { useState } from 'react'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { toParent } from '../advanced/util'

export const meta: PageMeta = {
  path: '/embed/card-number',
  title: 'Card number field (embedded)',
  group: 'Scenarios',
  summary: 'Innermost frame of the store checkout: holds only the card number field.',
  hidden: true,
  bare: true,
  mock: true,
}

/** Groups digits as "4242 4242 4242 4242". */
const fmt = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ')

export default function CardNumberFrame() {
  const t = useTraps('card-number')
  const [digits, setDigits] = useState('')
  return (
    <div style={{ padding: '4px 8px', background: 'var(--surface)' }}>
      <label data-ui="field" style={{ margin: 0 }}>
        <span>{t.v('Card number', 'Card digits')}</span>
        <input
          id={t.id('card-number')}
          name={t.uuid('card-number')}
          data-testid="card-number"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1234 1234 1234 1234"
          value={fmt(digits)}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(0, 16)
            setDigits(d)
            toParent({ type: 'tp-card-number', digits: d })
          }}
        />
      </label>
    </div>
  )
}
