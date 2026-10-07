import { useMemo, useState } from 'react'
import { Card } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useSyncedState } from './part2State'
import { tokenFor } from '../../core/rng'

export const meta: PageMeta = {
  path: '/ui/checkout',
  title: 'Checkout',
  group: 'General UI',
  summary:
    'A generic checkout: shipping and billing addresses, shipping methods, promo codes, regional tax, an order summary that recalculates, and a test-mode card form that only accepts the published test card.',
  order: 15,
  samples: [
    {
      id: 'CO1',
      title: 'Place an order with the test card',
      steps: [
        'Navigate to <base>/ui/checkout/',
        'Enter Ada Lovelace in the "Full name" field',
        'Enter 12 Analytical Way in the "Street" field',
        'Enter Springfield in the "City" field',
        'Enter 10001 in the "Postal code" field',
        'Enter 4242 4242 4242 4242 in the "Card number" field',
        'Enter 12/30 in the "Expiry (MM/YY)" field',
        'Enter 123 in the "CVC" field',
        'Click on "Place order"',
        'Verify that the current page displays text "Order confirmed"',
      ],
      expected: 'state.order = {number:"ORD-…" (seeded), total:109.38}; state.totals = {subtotal:98.48, discount:0, shipping:4.99, tax:5.91 (Central 6%), total:109.38}.',
    },
    {
      id: 'CO2',
      title: 'Promo code WELCOME5',
      steps: ['Enter WELCOME5 in the "Promo code" field', 'Click on "Apply"', 'Verify that the current page displays text "WELCOME5 applied"'],
      expected: 'state.promo = {code:"WELCOME5", valid:true} and state.totals.discount = 5.',
    },
    {
      id: 'CO3',
      title: 'Shipping method changes the total',
      steps: ['Click on "Express"'],
      expected: 'state.shippingMethod = "express" and state.totals.shipping = 12.99; total increases by 8.00.',
    },
    {
      id: 'CO4',
      title: 'Real card numbers are refused',
      steps: ['Enter 4000 1234 5678 9010 in the "Card number" field', 'Click on "Place order"', 'Verify that the current page displays text "Only the test card"'],
      expected: 'state.order is not set and state.errors includes "card".',
    },
    {
      id: 'CO5',
      title: 'Separate billing address',
      steps: ['Click on "Billing same as shipping"', 'Verify that the "Billing street" is visible'],
      expected: 'state.billingSameAsShipping = false.',
    },
    {
      id: 'CO6',
      title: 'Wrong total (bug)',
      query: 'bugs=cartTotal',
      steps: ['Verify that the "Order total" displays text "$109.38"'],
      expected: 'Fails: the total shows $134.37 (one extra Wireless mouse); state.totals.total differs from subtotal - discount + shipping + tax.',
    },
  ],
}

const ITEMS = [
  { sku: 'mouse', name: 'Wireless mouse', price: 24.99, qty: 2 },
  { sku: 'cable', name: 'USB-C cable', price: 9.5, qty: 1 },
  { sku: 'stand', name: 'Laptop stand', price: 39.0, qty: 1 },
]
const SHIPPING = [
  { key: 'standard', label: 'Standard', price: 4.99, eta: '5–7 days' },
  { key: 'express', label: 'Express', price: 12.99, eta: '2–3 days' },
  { key: 'overnight', label: 'Overnight', price: 24.99, eta: 'next day' },
]
const REGIONS = [
  { key: 'central', label: 'Central (6%)', rate: 0.06 },
  { key: 'coastal', label: 'Coastal (8%)', rate: 0.08 },
  { key: 'mountain', label: 'Mountain (4%)', rate: 0.04 },
  { key: 'free', label: 'Tax-free zone (0%)', rate: 0 },
]
const r2 = (n: number) => Math.round(n * 100) / 100
const money = (n: number) => `$${n.toFixed(2)}`

type Addr = { name: string; street: string; city: string; postal: string }
const emptyAddr: Addr = { name: '', street: '', city: '', postal: '' }

export default function CheckoutPage() {
  const t = useTraps('checkout')
  const config = useConfig()
  const { state, merge } = usePageState()
  const [qty, setQty] = useState<Record<string, number>>(Object.fromEntries(ITEMS.map((i) => [i.sku, i.qty])))
  const [ship, setShip] = useState<Addr>(emptyAddr)
  const [bill, setBill] = useState<Addr>(emptyAddr)
  const [same, setSame] = useState(true)
  const [region, setRegion] = useState('central')
  const [method, setMethod] = useState('standard')
  const [promoInput, setPromoInput] = useState('')
  const [promo, setPromo] = useState<{ code: string; valid: boolean; message: string } | null>(null)
  const [card, setCard] = useState({ number: '', expiry: '', cvc: '', holder: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [order, setOrder] = useState<{ number: string; total: number } | null>(null)

  const totals = useMemo(() => {
    const subtotal = r2(ITEMS.reduce((s, i) => s + i.price * (qty[i.sku] ?? 0), 0))
    const discount = promo?.valid && promo.code === 'WELCOME5' ? Math.min(5, subtotal) : 0
    const baseShip = SHIPPING.find((s) => s.key === method)?.price ?? 0
    const shipping = promo?.valid && promo.code === 'FREESHIP' ? 0 : baseShip
    const rate = REGIONS.find((x) => x.key === region)?.rate ?? 0
    const tax = r2((subtotal - discount) * rate)
    let total = r2(subtotal - discount + shipping + tax)
    // deliberate bug: total off by one item
    if (config.bugs.includes('cartTotal')) total = r2(total + ITEMS[0].price)
    return { subtotal, discount, shipping, tax, taxRate: rate, total }
  }, [qty, promo, method, region, config.bugs])

  useSyncedState({ totals, shippingMethod: method, region, quantities: qty })

  const applyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    const p =
      code === 'WELCOME5'
        ? { code, valid: true, message: 'WELCOME5 applied: $5.00 off' }
        : code === 'FREESHIP'
          ? { code, valid: true, message: 'FREESHIP applied: free shipping' }
          : { code, valid: false, message: code ? 'Invalid promo code' : 'Enter a promo code' }
    setPromo(p)
    merge({ promo: { code: p.code, valid: p.valid } })
  }

  const validate = () => {
    const e: Record<string, string> = {}
    const req = (a: Addr, prefix: string) => {
      if (!a.name.trim()) e[`${prefix}name`] = 'Required'
      if (!a.street.trim()) e[`${prefix}street`] = 'Required'
      if (!a.city.trim()) e[`${prefix}city`] = 'Required'
      if (!/^\w[\w -]{2,9}$/.test(a.postal.trim())) e[`${prefix}postal`] = 'Enter a valid postal code'
    }
    req(ship, 'ship_')
    if (!same) req(bill, 'bill_')
    if (card.number.replace(/[\s-]/g, '') !== '4242424242424242') e.card = 'Only the test card 4242 4242 4242 4242 is accepted'
    const m = /^(\d{2})\s*\/\s*(\d{2})$/.exec(card.expiry.trim())
    if (!m || Number(m[1]) < 1 || Number(m[1]) > 12) e.expiry = 'Use MM/YY'
    else {
      const now = new Date(nowMs(config))
      const endOfMonth = new Date(2000 + Number(m[2]), Number(m[1]), 1)
      if (endOfMonth <= now) e.expiry = 'Card has expired'
    }
    if (!/^\d{3}$/.test(card.cvc)) e.cvc = 'Enter 3 digits'
    return e
  }

  const placeOrder = async () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) {
      merge({ errors: Object.keys(e).map((k) => (k.startsWith('ship_') || k.startsWith('bill_') ? k : k)) })
      return
    }
    const count = (state.orderCount as number | undefined) ?? 0
    const number = `ORD-${tokenFor(config.seed, `order:${config.ns}:${count}`, 6).toUpperCase()}`
    const o = { number, total: totals.total }
    setOrder(o)
    merge({
      errors: [],
      orderCount: count + 1,
      order: { ...o, last4: '4242', shippingMethod: method, promo: promo?.valid ? promo.code : null, billingSameAsShipping: same },
    })
    await backend.create(config.ns, 'orders', { ...o, totals, items: ITEMS.map((i) => ({ sku: i.sku, qty: qty[i.sku] })), shipTo: ship.city, last4: '4242' })
  }

  const addrFields = (a: Addr, set: (a: Addr) => void, prefix: string, labelPrefix: string) =>
    (
      [
        ['name', 'Full name', 'name'],
        ['street', 'Street', 'street-address'],
        ['city', 'City', 'address-level2'],
        ['postal', 'Postal code', 'postal-code'],
      ] as const
    ).map(([k, label, ac]) => {
      const full = labelPrefix ? `${labelPrefix} ${label.toLowerCase()}` : label
      return (
        <label data-ui="field" key={k}>
          <span>{full}</span>
          <input
            id={t.id(`${prefix}${k}`)}
            autoComplete={`${labelPrefix ? 'billing' : 'shipping'} ${ac}`}
            value={a[k]}
            aria-invalid={!!errors[`${prefix}${k}`]}
            onChange={(e) => set({ ...a, [k]: e.target.value })}
          />
          {errors[`${prefix}${k}`] ? <span data-ui="error">{errors[`${prefix}${k}`]}</span> : null}
        </label>
      )
    })

  if (order)
    return (
      <Card title="Order confirmed" data-testid="order-confirmation">
        <p>
          Order number: <strong data-testid="order-number">{order.number}</strong>
        </p>
        <p>
          Charged (test mode): <strong>{money(order.total)}</strong> to the card ending 4242.
        </p>
        <button id={t.id('new-order')} className={t.cls('btn')} onClick={() => setOrder(null)}>
          Start a new order
        </button>
      </Card>
    )

  const summary = (
    <Card title="Order summary" data-testid="order-summary">
      <table>
        <tbody>
          {ITEMS.map((i) => (
            <tr key={i.sku}>
              <td>{i.name}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  max={9}
                  aria-label={`Quantity for ${i.name}`}
                  id={t.id(`qty-${i.sku}`)}
                  value={qty[i.sku]}
                  style={{ width: 56 }}
                  onChange={(e) => setQty({ ...qty, [i.sku]: Math.max(0, Math.min(9, Number(e.target.value) || 0)) })}
                />
              </td>
              <td style={{ textAlign: 'right' }}>{money(i.price * (qty[i.sku] ?? 0))}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}>Subtotal</td>
            <td style={{ textAlign: 'right' }} data-testid="subtotal">{money(totals.subtotal)}</td>
          </tr>
          {totals.discount ? (
            <tr>
              <td colSpan={2}>Discount</td>
              <td style={{ textAlign: 'right' }} data-testid="discount">−{money(totals.discount)}</td>
            </tr>
          ) : null}
          <tr>
            <td colSpan={2}>Shipping</td>
            <td style={{ textAlign: 'right' }} data-testid="shipping">{money(totals.shipping)}</td>
          </tr>
          <tr>
            <td colSpan={2}>Tax ({Math.round(totals.taxRate * 100)}%)</td>
            <td style={{ textAlign: 'right' }} data-testid="tax">{money(totals.tax)}</td>
          </tr>
          <tr>
            <th colSpan={2} style={{ textAlign: 'left' }}>Total</th>
            <th style={{ textAlign: 'right' }}>
              <output aria-label="Order total" data-testid="order-total">{money(totals.total)}</output>
            </th>
          </tr>
        </tbody>
      </table>
    </Card>
  )

  return (
    <>
      {t.v(null, summary)}
      <Card title="Shipping address">
        <div data-ui="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          {addrFields(ship, setShip, 'ship_', '')}
          <label data-ui="field">
            <span>Region</span>
            <select id={t.id('region')} value={region} onChange={(e) => setRegion(e.target.value)}>
              {REGIONS.map((r) => (
                <option key={r.key} value={r.key}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label style={{ display: 'block', marginTop: 8 }}>
          <input
            type="checkbox"
            id={t.id('billing-same')}
            checked={same}
            onChange={(e) => {
              setSame(e.target.checked)
              merge({ billingSameAsShipping: e.target.checked })
            }}
          />{' '}
          {t.v('Billing same as shipping', 'Use shipping address for billing')}
        </label>
      </Card>

      {!same ? (
        <Card title="Billing address">
          <div data-ui="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            {addrFields(bill, setBill, 'bill_', 'Billing')}
          </div>
        </Card>
      ) : null}

      <Card title="Shipping method">
        <fieldset>
          <legend>Shipping method</legend>
          {SHIPPING.map((s) => (
            <label key={s.key} style={{ display: 'block' }}>
              <input type="radio" name="shipping-method" id={t.id(`ship-${s.key}`)} value={s.key} checked={method === s.key} onChange={() => setMethod(s.key)} /> {s.label}
              <span data-ui="hint"> {money(s.price)} · {s.eta}</span>
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title="Promo code">
        <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
          <label data-ui="field">
            <span>Promo code</span>
            <input id={t.id('promo-code')} value={promoInput} onChange={(e) => setPromoInput(e.target.value)} />
          </label>
          <button id={t.id(t.v('apply-promo', 'redeem-promo'))} className={t.cls('btn btn--promo')} onClick={applyPromo}>
            {t.v('Apply', 'Redeem')}
          </button>
        </div>
        {promo ? (
          <div data-ui={promo.valid ? 'hint' : 'error'} role="status" data-testid="promo-result">
            {promo.message}
          </div>
        ) : null}
      </Card>

      {t.v(summary, null)}

      <Card title="Payment">
        <div data-ui="card" data-tone="info" data-testid="test-mode-note">
          Test mode – no real payments. Use card 4242 4242 4242 4242, any future expiry and any 3-digit CVC.
        </div>
        <div data-ui="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          <label data-ui="field">
            <span>Name on card</span>
            <input id={t.id('card-holder')} autoComplete="off" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value })} />
          </label>
          <label data-ui="field">
            <span>Card number</span>
            <input id={t.id('card-number')} inputMode="numeric" autoComplete="off" value={card.number} aria-invalid={!!errors.card} onChange={(e) => setCard({ ...card, number: e.target.value })} />
            {errors.card ? <span data-ui="error">{errors.card}</span> : null}
          </label>
          <label data-ui="field">
            <span>Expiry (MM/YY)</span>
            <input id={t.id('card-expiry')} autoComplete="off" placeholder="MM/YY" value={card.expiry} aria-invalid={!!errors.expiry} onChange={(e) => setCard({ ...card, expiry: e.target.value })} />
            {errors.expiry ? <span data-ui="error">{errors.expiry}</span> : null}
          </label>
          <label data-ui="field">
            <span>CVC</span>
            <input id={t.id('card-cvc')} inputMode="numeric" autoComplete="off" maxLength={4} value={card.cvc} aria-invalid={!!errors.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value })} />
            {errors.cvc ? <span data-ui="error">{errors.cvc}</span> : null}
          </label>
        </div>
        {Object.keys(errors).length ? (
          <p data-ui="error" role="alert" data-testid="checkout-errors">
            Please fix the highlighted fields.
          </p>
        ) : null}
        <button
          id={t.id(t.v('place-order', 'complete-purchase'))}
          className={t.cls('btn btn--place-order')}
          data-variant="primary"
          data-testid="place-order"
          onClick={() => void placeOrder()}
        >
          {t.v('Place order', 'Complete purchase')}
        </button>
        {t.dup ? (
          <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6, marginLeft: 8 }} onClick={() => merge({ decoy: 'Place order' })}>
            {t.v('Place order', 'Complete purchase')}
          </button>
        ) : null}
      </Card>
    </>
  )
}
