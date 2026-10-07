import { useState } from 'react'
import { Badge, Card, useToast } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/ai',
  title: 'AI agent, ask and verify',
  group: 'Step baselines',
  summary: 'A tiny shop and an order card with clear facts (status, colour-coded badge, delivery date) for AI-driven actions, questions and visual verification, plus visually distinct hot spots for heatmaps.',
  covers: [568, 573, 576, 583],
  order: 28,
  samples: [
    {
      id: 'AI1',
      title: 'AI agent places an order',
      steps: ['Navigate to <base>/steps/ai/', 'AI Agent add 2 "Blue mug" to the cart and check out'],
      expected: 'state.order = { item: "Blue mug", qty: 2 } and the page shows "Order placed".',
    },
    {
      id: 'AI2',
      title: 'AI ask about a fact on the page',
      steps: ['AI Ask: what is the delivery date shown?'],
      expected: 'Answer "15 December 2026".',
    },
    {
      id: 'AI3',
      title: 'AI visual verification',
      steps: ['AI Verification: the order status is Shipped and the badge is green'],
      expected: 'True. With variant=b the status still reads Shipped and the badge is still green.',
    },
    {
      id: 'AI4',
      title: 'Heatmap',
      steps: ['Generate heatmap'],
      expected: 'Heatmap highlights the large sale banner, the primary checkout button and the order card.',
    },
  ],
}

const PRICE = 12

export default function AiPage() {
  const t = useTraps('ai')
  const config = useConfig()
  const toast = useToast()
  const { state, merge } = usePageState()
  const [qty, setQty] = useState(1)
  const cart = state.cart as { item: string; qty: number } | undefined
  const total = cart ? (cart.qty + (config.bugs.includes('cartTotal') ? 1 : 0)) * PRICE : 0

  const product = (
    <Card title="Shop" aria-label="Shop">
      <div data-ui="inline" style={{ alignItems: 'flex-start', gap: '1rem' }}>
        <div aria-hidden="true" style={{ width: 96, height: 96, borderRadius: 12, background: '#2563eb' }} />
        <div>
          <h3 style={{ margin: 0 }}>Blue mug</h3>
          <p style={{ margin: '0.2rem 0' }}>${PRICE.toFixed(2)} each</p>
          <label data-ui="field" style={{ maxWidth: 120 }}>
            <span>Quantity</span>
            <input
              type="number"
              min={1}
              max={10}
              id={t.id('quantity')}
              className={t.cls('input input--qty')}
              value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
            />
          </label>
          <button
            id={t.id(t.v('add-to-cart', 'add-to-basket'))}
            className={t.cls('btn btn--add')}
            onClick={() => {
              merge({ cart: { item: 'Blue mug', qty } })
              toast(`Added ${qty} × Blue mug`)
            }}
          >
            {t.v('Add to cart', 'Add to basket')}
          </button>
        </div>
      </div>
    </Card>
  )

  const cartCard = (
    <Card title={t.v('Cart', 'Your basket')}>
      {cart ? (
        <p data-testid="cart-line">
          {cart.qty} × {cart.item} — total ${total.toFixed(2)}
        </p>
      ) : (
        <p data-ui="hint">Cart is empty.</p>
      )}
      <button
        id={t.id('checkout')}
        className={t.cls('btn btn--checkout')}
        data-variant="primary"
        disabled={!cart}
        style={{ fontSize: '1.2rem', padding: '0.8rem 2rem' }}
        onClick={() => {
          if (!cart) return
          merge({ order: { item: cart.item, qty: cart.qty }, cart: undefined })
        }}
      >
        Checkout
      </button>
      {state.order ? (
        <p data-testid="order-placed">
          <strong>Order placed</strong>: {(state.order as { qty: number }).qty} × {(state.order as { item: string }).item}
        </p>
      ) : null}
    </Card>
  )

  return (
    <>
      <div
        data-testid="hotspot-banner"
        aria-label="Sale banner"
        style={{ background: '#f97316', color: '#fff', padding: '1.5rem', borderRadius: 12, fontSize: '1.6rem', fontWeight: 800, textAlign: 'center', margin: '0.5rem 0 1rem' }}
      >
        Autumn sale — 20% off mugs
      </div>
      {t.v(
        <>
          {product}
          {cartCard}
        </>,
        <div data-ui="row" data-wrapper="ai-v2">
          <div style={{ flex: 1 }}>{cartCard}</div>
          <div style={{ flex: 1 }}>{product}</div>
        </div>,
      )}
      <Card title="Recent order" aria-label="Order card" data-testid="order-card">
        <p>
          Order <strong>#A-1042</strong> · 1 × Desk lamp
        </p>
        <p>
          Status: <span data-testid="order-status">Shipped</span>{' '}
          <span data-ui="badge" data-testid="status-badge" style={{ background: '#16a34a', color: '#fff', borderColor: '#16a34a' }}>
            Shipped
          </span>
        </p>
        <p data-testid="delivery-date">Delivery date: 15 December 2026</p>
        <p data-ui="hint">
          Other orders: #A-1039 <Badge tone="warning">Pending</Badge> · #A-1031 <Badge tone="danger">Cancelled</Badge>
        </p>
      </Card>
      <div data-ui="inline" aria-label="Hot spots" style={{ gap: '1rem' }}>
        <div data-testid="hotspot-help" style={{ width: 140, height: 80, background: '#a855f7', color: '#fff', borderRadius: 10, display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          Need help?
        </div>
        <div data-testid="hotspot-newsletter" style={{ width: 220, height: 80, background: '#facc15', borderRadius: 10, display: 'grid', placeItems: 'center', fontWeight: 700 }}>
          Join the newsletter
        </div>
      </div>
    </>
  )
}
