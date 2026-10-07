# Online store checkout (/shop)

Purpose: an e-commerce checkout with infinite scroll, button-group variant pickers, a cart drawer, a coupon, address autocomplete and card fields inside nested iframes (test mode only, no real payments).

## User stories
- As a shopper I scroll the catalogue, choose colour and size, and add products to my cart.
- As a shopper I apply the coupon SAVE10 and see the discount.
- As a shopper I pay with the test card and receive an order number.

## Acceptance criteria
- Given the page loads, then 12 of 60 products are shown; when I scroll to the bottom, then 12 more load after netDelay (state.productsLoaded 24, 36 … 60).
- Given I click "Add <product> to cart" without choosing colour and size, then "Choose a colour and size" is shown and the cart is unchanged.
- Given a product with colour and size chosen, when I add it, then state.cart contains it and "Cart (1)" is shown.
- Given "SAVE10" in "Coupon code", when I click "Apply coupon", then state.discount = 10 % of the subtotal and state.total = subtotal − discount. Other codes show "Coupon not recognised".
- Given 3+ characters in "Address", then suggestions from a fixed list appear; choosing one sets state.address and state.addressFromSuggestion = true.
- The payment form is the frame "payment-form"; the "Card number" field is in the frame "card-number" inside it. Only 4242 4242 4242 4242 (with MM/YY expiry ≥ 26, 3-digit CVC, a name) is accepted; other numbers give "Card declined…" in state.paymentError.
- After a successful "Place order", a toast "Order placed: ORD-…" disappears after 3 s, "Order confirmed" shows the order number (state.order) and the cart empties. An order record (kind shop-orders) is stored.

## Trap params
variant=b (Bag, Add to bag, Promo code, Pay now, Card digits, Expires (MM/YY)), bugs=cartTotal (displayed total is one item price too high), netDelay (batch loading), unstableIds, unstableClasses.
