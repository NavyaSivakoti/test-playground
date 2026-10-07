import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { usePageState, useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { frameSrc, toParent } from '../advanced/util'

export const meta: PageMeta = {
  path: '/embed/payment-form',
  title: 'Payment form (embedded)',
  group: 'Scenarios',
  summary: 'Outer payment frame of the store checkout. The card number lives in a nested frame inside it.',
  hidden: true,
  bare: true,
  mock: true,
}

export const TEST_CARD = '4242424242424242'

export interface PayResult {
  type: 'tp-pay-result'
  ok: boolean
  error?: string
  last4?: string
  nameOnCard?: string
}

function check(digits: string, expiry: string, cvc: string, name: string): Omit<PayResult, 'type'> {
  if (!name.trim()) return { ok: false, error: 'Enter the name on the card' }
  if (digits.length !== 16) return { ok: false, error: 'Enter a 16-digit card number' }
  if (digits !== TEST_CARD) return { ok: false, error: 'Card declined: test mode only accepts the test card 4242 4242 4242 4242' }
  const m = /^(0[1-9]|1[0-2])\s*\/\s*(\d{2})$/.exec(expiry.trim())
  if (!m) return { ok: false, error: 'Expiry must look like MM/YY' }
  if (Number(m[2]) < 26) return { ok: false, error: 'Card expired' }
  if (!/^\d{3}$/.test(cvc)) return { ok: false, error: 'CVC must be 3 digits' }
  return { ok: true, last4: digits.slice(-4), nameOnCard: name.trim() }
}

export default function PaymentFormFrame() {
  const t = useTraps('payment-form')
  const { merge } = usePageState()
  const location = useLocation()
  const digits = useRef('')
  const [name, setName] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fields = useRef({ name, expiry, cvc })
  fields.current = { name, expiry, cvc }

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return
      if (e.data.type === 'tp-card-number') {
        digits.current = String(e.data.digits ?? '')
        toParent({ type: 'tp-pay-field', field: 'cardNumber', filled: digits.current.length, last4: digits.current.slice(-4) })
        merge({ cardDigits: digits.current.length })
      }
      if (e.data.type === 'tp-pay-request') {
        const f = fields.current
        const r = check(digits.current, f.expiry, f.cvc, f.name)
        setError(r.ok ? null : (r.error ?? null))
        merge({ lastCheck: r.ok ? 'ok' : r.error })
        toParent({ type: 'tp-pay-result', ...r })
      }
    }
    window.addEventListener('message', on)
    toParent({ type: 'tp-pay-ready' })
    return () => window.removeEventListener('message', on)
  }, [merge])

  return (
    <form
      style={{ padding: 10, background: 'var(--surface)', minHeight: '100vh' }}
      onSubmit={(e) => e.preventDefault()}
      aria-label="Payment details"
    >
      <p data-ui="badge" data-tone="warning" style={{ margin: '0 0 6px' }} data-testid="test-mode">
        Test mode – no real payments
      </p>
      <label data-ui="field">
        <span>Name on card</span>
        <input id={t.id('name-on-card')} name={t.uuid('name-on-card')} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <iframe
        name="card-number"
        title="Card number"
        src={frameSrc('/embed/card-number', location.search)}
        style={{ width: '100%', maxWidth: 420, height: 78, border: '1px dashed var(--border)', borderRadius: 6, display: 'block' }}
      />
      <div data-ui="inline">
        <label data-ui="field" style={{ maxWidth: 140 }}>
          <span>{t.v('Expiry date', 'Expires (MM/YY)')}</span>
          <input id={t.id('expiry')} name={t.uuid('expiry')} placeholder="MM/YY" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
        </label>
        <label data-ui="field" style={{ maxWidth: 100 }}>
          <span>CVC</span>
          <input id={t.id('cvc')} name={t.uuid('cvc')} inputMode="numeric" value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </label>
      </div>
      {error ? (
        <p data-ui="error" role="alert" data-testid="payment-error">
          {error}
        </p>
      ) : null}
    </form>
  )
}
