import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/variables',
  title: 'Variables and parameters',
  group: 'Step baselines',
  summary: 'Known text, input values and attributes to store in variables, plus fields that echo stored values back so the run proves the variable held the right value.',
  covers: [5, 25, 130, 158, 452, 487, 499, 560, 561, 566, 567, 574, 575, 669],
  order: 6,
  samples: [
    {
      id: 'VA1',
      title: 'Store text and compare',
      steps: ['Store the text of "Invoice total" in a variable name invoiceTotal', 'Verify the ${invoiceTotal} equals to $1,234.50'],
      expected: 'invoiceTotal = "$1,234.50".',
    },
    {
      id: 'VA2',
      title: 'Store an input value and echo it',
      steps: ['Store value from "Reference code" inputbox in a variable refCode', 'Enter ${refCode} in the "Echo field" field'],
      expected: 'state.echo = "REF-42-ALPHA".',
    },
    {
      id: 'VA3',
      title: 'Attribute and tag name',
      steps: ['Update parameter sku with value of data-sku attribute from the element "Product card"', 'Store tag name of "Invoice total" in a variable tag'],
      expected: 'sku = "SKU-778"; tag = "strong".',
    },
    {
      id: 'VA4',
      title: 'Generated string',
      steps: ['Generate a 8 character string and store it in the uniqueName variable', 'Enter ${uniqueName} in the "Unique name" field'],
      expected: 'state.uniqueName has 8 characters (state.uniqueNameLength = 8).',
    },
    {
      id: 'VA5',
      title: 'Custom step and note',
      steps: ['Note: reading the app version', 'Custom step: return window.testPlayground.version'],
      expected: 'The custom step returns "1.0.0"; the note has no effect on the page.',
    },
  ],
}

export default function VariablesPage() {
  const t = useTraps('variables')
  const { state, merge } = usePageState()
  const version = (window as unknown as { testPlayground?: { version?: string } }).testPlayground?.version ?? 'unknown'

  const invoice = (
    <div data-ui="field" key="invoice">
      <span id={t.id('invoice-total-label')} data-ui="hint">
        Invoice total
      </span>
      <strong id={t.id('invoice-total')} className={t.cls('amount amount--total')} data-testid="invoice-total" aria-labelledby={t.id('invoice-total-label')}>
        $1,234.50
      </strong>
    </div>
  )
  const customer = (
    <div data-ui="field" key="customer">
      <span id={t.id('customer-name-label')} data-ui="hint">
        Customer name
      </span>
      <span id={t.id('customer-name')} className={t.cls('customer')} data-testid="customer-name" aria-labelledby={t.id('customer-name-label')}>
        Grace Hopper
      </span>
    </div>
  )

  return (
    <>
      <Card title="Values to store">
        {t.v(
          <>
            {invoice}
            {customer}
          </>,
          <div data-variant="wrapper">
            {customer}
            {invoice}
          </div>,
        )}
        <label data-ui="field">
          <span>Reference code</span>
          <input id={t.id(t.v('reference-code', 'ref-code'))} className={t.cls('input input--ref')} data-testid="reference-code" readOnly value="REF-42-ALPHA" />
        </label>
        <article
          id={t.id('product-card')}
          className={t.cls('product-card')}
          data-testid="product-card"
          data-sku="SKU-778"
          aria-label="Product card"
          data-ui="card"
          style={{ maxWidth: 320 }}
        >
          <strong>Product card</strong>
          <div>{t.v('Mechanical keyboard', 'Mechanical keyboard (new)')}</div>
          <div data-ui="hint">Stock keeping unit is in the data-sku attribute.</div>
        </article>
      </Card>

      <Card title="Echo stored values">
        <label data-ui="field">
          <span>Echo field</span>
          <input id={t.id('echo-field')} className={t.cls('input input--echo')} data-testid="echo-field" onChange={(e) => merge({ echo: e.target.value })} />
        </label>
        <label data-ui="field">
          <span>Unique name</span>
          <input
            id={t.id('unique-name')}
            className={t.cls('input input--unique')}
            data-testid="unique-name"
            onChange={(e) => merge({ uniqueName: e.target.value, uniqueNameLength: e.target.value.length })}
          />
        </label>
        {state.echo !== undefined ? <p data-testid="echo-output">Echo: {String(state.echo)}</p> : null}
      </Card>

      <Card title="Custom code">
        <p>
          The app exposes <code>window.testPlayground.version</code> for custom steps. Current value: <code data-testid="app-version">{version}</code>
        </p>
      </Card>
    </>
  )
}
