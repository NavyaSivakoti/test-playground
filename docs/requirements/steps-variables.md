# Variables and parameters (/steps/variables)

**Purpose:** known values to store in variables, and echo fields that prove the stored value was right.

## User stories
- As a tester I can store text, input values, attributes and tag names, then reuse them in later steps.

## Acceptance criteria
- "Invoice total" is a `<strong>` with text "$1,234.50" (tag name "strong").
- "Reference code" is a readonly input with value "REF-42-ALPHA".
- "Product card" has data-sku="SKU-778"; "Customer name" text is "Grace Hopper".
- When I enter a stored value in "Echo field", then state.echo equals it (e.g. "REF-42-ALPHA" or "apple,pear").
- When I enter a generated 8-character string in "Unique name", then state.uniqueName has it and state.uniqueNameLength = 8.
- A custom step reading `window.testPlayground.version` returns "1.0.0". Note steps have no page effect.

## Trap params
`variant=b` (invoice/customer order, wrapper, reference code id, product text), `unstableIds`, `unstableClasses`.
