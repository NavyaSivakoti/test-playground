# Checkout (/ui/checkout)

**Purpose:** a generic, test-mode-only checkout for verifying calculated totals, promo codes, conditional address fields and card validation. No real payment is ever made.

## User stories
- As a shopper I enter a shipping address and optionally a different billing address.
- As a shopper I choose a shipping method, apply a promo code and see tax for my region.
- As a shopper I pay with the published test card and receive an order number.

## Acceptance criteria
- Default cart: 2 × Wireless mouse $24.99, 1 × USB-C cable $9.50, 1 × Laptop stand $39.00 → subtotal $98.48, Standard shipping $4.99, Central tax 6% $5.91, total $109.38 (state.totals).
- Changing a quantity, shipping method (Standard 4.99 / Express 12.99 / Overnight 24.99) or region (6% / 8% / 4% / 0%) recalculates every total.
- Promo "WELCOME5" → $5 off ("WELCOME5 applied"); "FREESHIP" → shipping $0; anything else → "Invalid promo code"; state.promo.
- Unticking "Billing same as shipping" shows billing fields (state.billingSameAsShipping = false).
- Only card 4242 4242 4242 4242 is accepted ("Only the test card … is accepted" otherwise); expiry must be MM/YY in the future; CVC 3 digits. The note "Test mode – no real payments" is always visible. Only last4 is stored.
- When everything is valid and I click "Place order", then "Order confirmed" shows a seeded order number ORD-XXXXXX; state.order = {number, total}; an `orders` record is created.

## Trap params
`bugs=cartTotal` (total includes one extra Wireless mouse: $134.37), `variant=b` ("Complete purchase", "Redeem", "Use shipping address for billing", summary moved to the top), `now`, `unstableIds`, `unstableClasses`, `duplicateLabels`.
