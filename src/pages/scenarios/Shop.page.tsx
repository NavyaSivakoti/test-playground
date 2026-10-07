import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { randFor } from '../../core/rng'
import { frameSrc, money, useMountMerge } from './advanced/util'

export const meta: PageMeta = {
  path: '/shop',
  title: 'Online store checkout',
  group: 'Scenarios',
  summary:
    'A store with an infinitely scrolling catalogue, variant button groups, a cart drawer with coupons, address autocomplete and card fields inside nested iframes. Test mode only.',
  order: 21,
  mock: true,
  samples: [
    {
      id: 'SH1',
      title: 'Add a product with variants',
      steps: [
        'Navigate to <base>/shop/',
        'Select element by text "Blue" in the button group "Canvas Tote Bag colour"',
        'Select element by text "M" in the button group "Canvas Tote Bag size"',
        'Click on "Add Canvas Tote Bag to cart"',
        'Verify that the current page displays text "Cart (1)"',
      ],
      expected: 'state.cart = [{ id: "P-001", colour: "Blue", size: "M", qty: 1, … }] and state.subtotal equals the product price.',
    },
    {
      id: 'SH2',
      title: 'Coupon SAVE10',
      steps: ['Add any product to the cart', 'Click on "Cart (1)"', 'Enter SAVE10 in the "Coupon code" field', 'Click on "Apply coupon"', 'Verify that the current page displays text "SAVE10 applied"'],
      expected: 'state.discount = round(subtotal × 10 %) and state.total = subtotal − discount.',
    },
    {
      id: 'SH3',
      title: 'Infinite scroll',
      steps: ['Navigate to <base>/shop/', 'Scroll to bottom', 'Wait until the text "Showing 24 of 60 products" is present on the current page'],
      expected: 'state.productsLoaded grows 12 → 24 → … → 60 as the page scrolls; "All 60 products loaded" at the end.',
    },
    {
      id: 'SH4',
      title: 'Pay with the test card in nested frames',
      steps: [
        'Add a product, open the cart and click on "Checkout"',
        'Enter Ada Lovelace in the "Full name" field',
        'Enter Anal in the "Address" field',
        'Click on "12 Analytical Engine Lane, London"',
        'Switch to the frame named "payment-form"',
        'Enter Ada Lovelace in the "Name on card" field',
        'Enter 12/30 in the "Expiry date" field',
        'Enter 123 in the "CVC" field',
        'Switch to the frame named "card-number"',
        'Enter 4242 4242 4242 4242 in the "Card number" field',
        'Switch back to the main page and click on "Place order"',
        'Wait until the text "Order confirmed" is present on the current page',
      ],
      expected: 'state.order.number like ORD-12345-1, state.order.last4 = "4242", a toast that disappears after 3 seconds, the cart is empty.',
    },
    {
      id: 'SH5',
      title: 'Declined card',
      steps: ['As SH4 but enter 4000 0000 0000 0002 as the card number', 'Click on "Place order"'],
      expected: 'state.paymentError starts with "Card declined"; no order is created.',
    },
    {
      id: 'SH6',
      title: 'Deliberate cart total bug',
      query: 'bugs=cartTotal',
      steps: ['Add one product and open the cart', 'Verify that the "Total" displays text equal to the "Subtotal"'],
      expected: 'Fails on purpose: the displayed total is one item price too high (state.total ≠ state.subtotal − state.discount).',
    },
  ],
}

const ADJ = ['Canvas', 'Linen', 'Wool', 'Cotton', 'Bamboo', 'Cedar', 'Copper', 'Granite', 'Maple', 'Velvet']
const NOUN = ['Tote Bag', 'Notebook', 'Mug', 'Scarf', 'Desk Lamp', 'Backpack']
const COLOURS = ['Red', 'Blue', 'Black']
const SIZES = ['S', 'M', 'L']
const BATCH = 12
const TOTAL = 60
const ADDRESSES = [
  '12 Analytical Engine Lane, London',
  '7 Difference Engine Road, Manchester',
  '1 Compiler Way, Arlington',
  '42 Mark Street, Cambridge',
  '9 Bernoulli Gardens, London',
  '55 Turing Avenue, Wilmslow',
  '3 Babbage Court, Teignmouth',
  '18 Pascal Row, Clermont',
]

interface Product {
  id: string
  name: string
  price: number
}
interface Line {
  key: string
  id: string
  name: string
  colour: string
  size: string
  qty: number
  price: number
}

function catalogue(seed: number): Product[] {
  return Array.from({ length: TOTAL }, (_, i) => ({
    id: `P-${String(i + 1).padStart(3, '0')}`,
    name: `${ADJ[i % 10]} ${NOUN[Math.floor(i / 10)]}`,
    price: (9 + Math.floor(randFor(seed, `shop:price:${i}`) * 60)) * 100 + 99,
  }))
}

function ProductCard({ p, onAdd }: { p: Product; onAdd: (p: Product, colour: string, size: string) => void }) {
  const t = useTraps('shop')
  const [colour, setColour] = useState<string | null>(null)
  const [size, setSize] = useState<string | null>(null)
  const [err, setErr] = useState(false)
  const group = (label: string, items: string[], value: string | null, set: (v: string) => void) => (
    <div role="group" aria-label={`${p.name} ${label.toLowerCase()}`} data-ui="inline" style={{ gap: '0.3rem', margin: '0.3rem 0' }}>
      <span data-ui="hint" style={{ minWidth: 48 }}>
        {label}
      </span>
      {items.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          data-variant={value === v ? 'primary' : undefined}
          style={{ padding: '0.2rem 0.55rem' }}
          onClick={() => {
            set(v)
            setErr(false)
          }}
        >
          {v}
        </button>
      ))}
    </div>
  )
  return (
    <article data-ui="card" data-testid={`product-${p.id}`} style={{ margin: 0 }} className={t.cls('product-card')}>
      <h3 style={{ marginTop: 0 }}>{p.name}</h3>
      <div data-testid={`price-${p.id}`}>{money(p.price)}</div>
      {group(t.v('Colour', 'Color'), COLOURS, colour, setColour)}
      {group('Size', SIZES, size, setSize)}
      <button
        type="button"
        data-variant="primary"
        aria-label={`${t.v('Add', 'Put')} ${p.name} ${t.v('to cart', 'in bag')}`}
        id={t.id(`add-${p.id}`)}
        onClick={() => {
          if (!colour || !size) {
            setErr(true)
            return
          }
          onAdd(p, colour, size)
        }}
      >
        {t.v('Add to cart', 'Add to bag')}
      </button>
      {err ? (
        <div data-ui="error" role="alert">
          Choose a colour and size
        </div>
      ) : null}
    </article>
  )
}

export default function ShopPage() {
  const t = useTraps('shop')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const location = useLocation()
  const products = useMemo(() => catalogue(config.seed), [config.seed])
  const [shown, setShown] = useState(BATCH)
  const [loading, setLoading] = useState(false)
  const [cart, setCart] = useState<Line[]>([])
  const [drawer, setDrawer] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<string | null>(null)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState(false)
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [payError, setPayError] = useState<string | null>(null)
  const [placing, setPlacing] = useState(false)
  const [order, setOrder] = useState<{ number: string; total: number; items: number; last4: string } | null>(null)
  const orderCount = useRef(0)
  const touched = useRef(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)
  const pending = useRef<((r: { ok: boolean; error?: string; last4?: string }) => void) | null>(null)

  useMountMerge(() => ({ productsLoaded: BATCH, cart: [], subtotal: 0, discount: 0, total: 0 }))

  // ---------- infinite scroll ----------
  useEffect(() => {
    const el = sentinel.current
    if (!el || shown >= TOTAL) return
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting || loading) return
        setLoading(true)
        setTimeout(() => {
          setShown((n) => {
            const next = Math.min(TOTAL, n + BATCH)
            merge({ productsLoaded: next })
            return next
          })
          setLoading(false)
        }, Math.max(300, config.netDelay))
      },
      { rootMargin: '200px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown, loading, config.netDelay, merge])

  // ---------- totals ----------
  const subtotal = cart.reduce((s, l) => s + l.price * l.qty, 0)
  const discount = coupon ? Math.round(subtotal * 0.1) : 0
  const realTotal = subtotal - discount
  const total = config.bugs.includes('cartTotal') && cart.length ? realTotal + cart[0].price : realTotal
  const count = cart.reduce((s, l) => s + l.qty, 0)

  useEffect(() => {
    // skip the initial render (the mount merge handles it)
    if (!touched.current) {
      touched.current = true
      return
    }
    merge({
      cart: cart.map(({ id, name, colour, size, qty, price }) => ({ id, name, colour, size, qty, price: price / 100 })),
      subtotal: subtotal / 100,
      discount: discount / 100,
      total: total / 100,
      coupon,
    })
  }, [cart, coupon, subtotal, discount, total, merge])

  const add = (p: Product, colour: string, size: string) => {
    const key = `${p.id}:${colour}:${size}`
    setCart((c) => (c.some((l) => l.key === key) ? c.map((l) => (l.key === key ? { ...l, qty: l.qty + 1 } : l)) : [...c, { key, id: p.id, name: p.name, colour, size, qty: 1, price: p.price }]))
    merge({ lastAdded: `${p.id} ${colour} ${size}` })
    toast(`${p.name} added`, { ms: 1500 })
  }
  const setQty = (key: string, qty: number) => setCart((c) => (qty <= 0 ? c.filter((l) => l.key !== key) : c.map((l) => (l.key === key ? { ...l, qty } : l))))

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase()
    if (code === 'SAVE10') {
      setCoupon('SAVE10')
      setCouponError(null)
      merge({ couponError: null })
    } else {
      setCoupon(null)
      setCouponError('Coupon not recognised')
      merge({ coupon: null, couponError: 'Coupon not recognised' })
    }
  }

  useResetListener(
    config.ns,
    useCallback(() => {
      setCart([])
      setCoupon(null)
      setOrder(null)
      setCheckout(false)
    }, []),
  )

  // ---------- payment frame messages ----------
  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || !e.data || typeof e.data !== 'object') return
      if (e.data.type === 'tp-pay-ready') merge({ paymentFrameReady: true })
      if (e.data.type === 'tp-pay-field') merge({ cardDigitsEntered: e.data.filled })
      if (e.data.type === 'tp-pay-result' && pending.current) {
        pending.current(e.data)
        pending.current = null
      }
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [merge])

  const suggestions = address.trim().length >= 3 ? ADDRESSES.filter((a) => a.toLowerCase().includes(address.trim().toLowerCase())) : []
  const pick = (a: string) => {
    setAddress(a)
    setSuggestOpen(false)
    setActive(-1)
    merge({ address: a, addressFromSuggestion: true })
  }

  const placeOrder = async () => {
    setPayError(null)
    const fail = (msg: string) => {
      setPayError(msg)
      merge({ paymentError: msg })
    }
    if (!cart.length) return fail('Your cart is empty')
    if (!fullName.trim()) return fail('Enter your full name')
    if (!ADDRESSES.includes(address)) return fail('Choose an address from the suggestions')
    const win = frame.current?.contentWindow
    if (!win) return fail('Payment form not loaded')
    setPlacing(true)
    const result = await new Promise<{ ok: boolean; error?: string; last4?: string }>((resolve) => {
      pending.current = resolve
      win.postMessage({ type: 'tp-pay-request' }, window.location.origin)
      setTimeout(() => {
        if (pending.current === resolve) {
          pending.current = null
          resolve({ ok: false, error: 'Payment form not responding' })
        }
      }, 4000)
    })
    if (!result.ok) {
      setPlacing(false)
      return fail(result.error ?? 'Payment failed')
    }
    orderCount.current += 1
    const number = `ORD-${10000 + Math.floor(t.rand('order') * 90000)}-${orderCount.current}`
    const o = { number, total: total / 100, items: count, last4: result.last4 ?? '' }
    try {
      await backend.create(config.ns, 'shop-orders', { ...o, fullName, address, lines: cart.map((l) => ({ id: l.id, qty: l.qty })) })
    } catch {
      /* local simulation continues */
    }
    setPlacing(false)
    setOrder(o)
    setCart([])
    setCoupon(null)
    setCheckout(false)
    merge({ order: o, paymentError: null, cart: [], subtotal: 0, discount: 0, total: 0, coupon: null })
    toast(`Order placed: ${number}`, { tone: 'success', ms: 3000 })
  }

  const cartLabel = `${t.v('Cart', 'Bag')} (${count})`

  return (
    <>
      <div
        data-ui="inline"
        style={{ position: 'sticky', top: 0, zIndex: 50, background: 'var(--bg)', padding: '0.4rem 0', justifyContent: 'space-between' }}
      >
        <span data-ui="badge" data-tone="warning" data-testid="shop-test-mode">
          Test mode – no real payments
        </span>
        <button id={t.id('open-cart')} data-testid="open-cart" onClick={() => setDrawer(true)}>
          {cartLabel}
        </button>
      </div>

      {order ? (
        <Card title="Order confirmed" data-testid="order-confirmation">
          <p>
            Order number: <strong data-testid="order-number">{order.number}</strong>
          </p>
          <p>
            {order.items} item(s), charged {money(Math.round(order.total * 100))} to the test card ending {order.last4}.
          </p>
          <button onClick={() => setOrder(null)}>Continue shopping</button>
        </Card>
      ) : null}

      {checkout ? (
        <Card title="Checkout" data-testid="checkout">
          <label data-ui="field">
            <span>Full name</span>
            <input id={t.id('full-name')} value={fullName} onChange={(e) => setFullName(e.target.value)} onBlur={() => merge({ fullName })} />
          </label>
          <div style={{ position: 'relative', maxWidth: 420 }}>
            <label data-ui="field" htmlFor={t.id('address')}>
              <span>Address</span>
            </label>
            <input
              id={t.id('address')}
              role="combobox"
              aria-expanded={suggestOpen && suggestions.length > 0}
              aria-controls="address-suggestions"
              aria-autocomplete="list"
              autoComplete="off"
              style={{ width: '100%' }}
              value={address}
              onChange={(e) => {
                setAddress(e.target.value)
                setSuggestOpen(true)
                setActive(-1)
                merge({ address: e.target.value, addressFromSuggestion: false })
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') setActive((a) => Math.min(suggestions.length - 1, a + 1))
                if (e.key === 'ArrowUp') setActive((a) => Math.max(0, a - 1))
                if (e.key === 'Enter' && active >= 0 && suggestions[active]) {
                  e.preventDefault()
                  pick(suggestions[active])
                }
                if (e.key === 'Escape') setSuggestOpen(false)
              }}
            />
            {suggestOpen && suggestions.length ? (
              <div data-ui="popover" role="listbox" id="address-suggestions" aria-label="Address suggestions" style={{ left: 0, right: 0, top: '100%' }}>
                {suggestions.map((a, i) => (
                  <div
                    key={a}
                    role="option"
                    aria-selected={i === active}
                    data-ui="menu-item"
                    data-active={i === active}
                    style={{ cursor: 'pointer' }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(a)}
                  >
                    {a}
                  </div>
                ))}
              </div>
            ) : null}
            <span data-ui="hint">Suggestions appear after 3 characters.</span>
          </div>
          <h3>Payment</h3>
          <iframe
            ref={frame}
            name="payment-form"
            title="Payment form"
            src={frameSrc('/embed/payment-form', location.search)}
            style={{ width: '100%', maxWidth: 460, height: 330, border: '1px solid var(--border)', borderRadius: 8, display: 'block' }}
          />
          <p data-ui="hint">The card number field is inside a frame inside this frame. Only the test card 4242 4242 4242 4242 is accepted.</p>
          {payError ? (
            <p data-ui="error" role="alert" data-testid="pay-error">
              {payError}
            </p>
          ) : null}
          <p>
            Order total: <strong>{money(total)}</strong>
          </p>
          <button data-variant="primary" id={t.id('place-order')} disabled={placing} onClick={placeOrder}>
            {placing ? 'Processing…' : t.v('Place order', 'Pay now')}
          </button>
        </Card>
      ) : null}

      <Card title="Products">
        <p data-ui="hint">Every card has its own colour and size button groups and the same visible add button; target them by product.</p>
        <div data-ui="grid" data-testid="product-grid">
          {products.slice(0, shown).map((p) => (
            <ProductCard key={p.id} p={p} onAdd={add} />
          ))}
        </div>
        <div ref={sentinel} data-testid="scroll-sentinel" style={{ padding: '1rem 0', textAlign: 'center' }}>
          {loading ? <span>Loading more products…</span> : null}{' '}
          <span data-testid="products-count">{shown >= TOTAL ? `All ${TOTAL} products loaded` : `Showing ${shown} of ${TOTAL} products`}</span>
        </div>
      </Card>

      {drawer ? (
        <>
          <div data-ui="backdrop" onClick={() => setDrawer(false)} />
          <aside data-ui="drawer" role="dialog" aria-modal="true" aria-label="Shopping cart" data-testid="cart-drawer">
            <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
              <h2 style={{ margin: 0 }}>{t.v('Your cart', 'Your bag')}</h2>
              <button onClick={() => setDrawer(false)} aria-label="Close cart">
                ✕
              </button>
            </div>
            {cart.length === 0 ? <p>Your cart is empty.</p> : null}
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {cart.map((l) => (
                <li key={l.key} data-testid={`cart-line-${l.key}`} style={{ borderBottom: '1px solid var(--border)', padding: '0.4rem 0' }}>
                  <div>
                    <strong>{l.name}</strong> · {l.colour} · {l.size}
                  </div>
                  <div data-ui="inline">
                    <button aria-label={`Decrease quantity of ${l.name}`} onClick={() => setQty(l.key, l.qty - 1)}>
                      −
                    </button>
                    <span aria-label="Quantity">{l.qty}</span>
                    <button aria-label={`Increase quantity of ${l.name}`} onClick={() => setQty(l.key, l.qty + 1)}>
                      +
                    </button>
                    <span>{money(l.price * l.qty)}</span>
                    <button data-variant="link" onClick={() => setQty(l.key, 0)}>
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <div data-ui="inline" style={{ alignItems: 'flex-end' }}>
              <label data-ui="field" style={{ flex: 1 }}>
                <span>{t.v('Coupon code', 'Promo code')}</span>
                <input id={t.id('coupon')} value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
              </label>
              <button onClick={applyCoupon} style={{ marginBottom: '0.5rem' }}>
                {t.v('Apply coupon', 'Apply code')}
              </button>
            </div>
            {couponError ? (
              <p data-ui="error" role="alert">
                {couponError}
              </p>
            ) : null}
            {coupon ? <p data-testid="coupon-applied">{coupon} applied: 10% off</p> : null}
            <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.2rem' }}>
              <dt>Subtotal</dt>
              <dd style={{ margin: 0 }} data-testid="subtotal" aria-label="Subtotal">
                {money(subtotal)}
              </dd>
              <dt>Discount</dt>
              <dd style={{ margin: 0 }} data-testid="discount" aria-label="Discount">
                {money(-discount)}
              </dd>
              <dt>
                <strong>Total</strong>
              </dt>
              <dd style={{ margin: 0 }} data-testid="total" aria-label="Total">
                <strong>{money(total)}</strong>
              </dd>
            </dl>
            <button
              data-variant="primary"
              disabled={!cart.length}
              onClick={() => {
                setDrawer(false)
                setCheckout(true)
                setOrder(null)
                merge({ checkoutOpened: true })
              }}
            >
              {t.v('Checkout', 'Go to checkout')}
            </button>
          </aside>
        </>
      ) : null}
    </>
  )
}
