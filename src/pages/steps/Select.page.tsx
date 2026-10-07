import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/select',
  title: 'Select, check and radio',
  group: 'Step baselines',
  summary: 'Native single and multiple selects, a button group, a radio group and checkboxes for select-by-value/text/index and check/uncheck steps.',
  covers: [30, 417, 430, 432, 433, 434, 437, 438, 439, 440, 441, 442, 450, 451, 518, 519],
  order: 4,
  samples: [
    {
      id: 'S1',
      title: 'Select by text, value and index',
      steps: ['Select option by text "Germany" in the list "Country"', 'Select option by value "uk" in the list "Country"', 'Select option by index "3" in the list "Country"'],
      expected: 'state.country goes "de" -> "uk" -> "fr" (index 0 is the placeholder).',
    },
    {
      id: 'S2',
      title: 'Multiple selection',
      steps: ['Select multiple options by value "red,blue" in the list "Colours"'],
      expected: 'state.colours = ["red","blue"].',
    },
    {
      id: 'S3',
      title: 'Value containing and absent option',
      steps: ['Select option by value containing "us-" in the list "Region"', 'Verify that the option "Mars" is not present in dropdown "Country"'],
      expected: 'state.region = "us-east-1"; the option check passes.',
    },
    {
      id: 'S4',
      title: 'Button group and radio group',
      steps: ['Select element by text containing "Pro" in the button group "Plan"', 'Select element by label "Monthly" in the button group "Billing"'],
      expected: 'state.plan = "Professional" and state.billing = "monthly".',
    },
    {
      id: 'S5',
      title: 'Checkboxes and radios',
      steps: ['Check the checkbox "Accept terms"', 'Uncheck the checkbox "Subscribe to newsletter"', 'Check the radio button "Express shipping"'],
      expected: 'state.terms = true, state.newsletter = false, state.shipping = "express".',
    },
  ],
}

const COUNTRIES = [
  { value: 'us', label: 'United States' },
  { value: 'de', label: 'Germany' },
  { value: 'fr', label: 'France' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'es', label: 'Spain' },
  { value: 'jp', label: 'Japan' },
]
const REGIONS_A = ['eu-west-1', 'us-east-1', 'us-west-2', 'ap-south-1']
const REGIONS_B = ['ap-south-1', 'eu-west-1', 'us-east-1', 'us-west-2']
const PLANS = ['Starter', 'Professional', 'Enterprise']

export default function SelectPage() {
  const t = useTraps('select')
  const { state, merge } = usePageState()
  const plan = state.plan as string | undefined

  return (
    <>
      <Card title="Native selects">
        <label data-ui="field">
          <span>Country</span>
          <select
            id={t.id(t.v('country', 'country-select'))}
            className={t.cls('select select--country')}
            data-testid="country"
            defaultValue=""
            onChange={(e) => merge({ country: e.target.value, countryIndex: e.target.selectedIndex })}
          >
            <option value="">Choose a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label data-ui="field">
          <span>Colours</span>
          <select
            id={t.id('colours')}
            className={t.cls('select select--multi')}
            data-testid="colours"
            multiple
            size={3}
            onChange={(e) => merge({ colours: Array.from(e.target.selectedOptions).map((o) => o.value) })}
          >
            <option value="red">Red</option>
            <option value="green">Green</option>
            <option value="blue">Blue</option>
          </select>
        </label>
        <label data-ui="field">
          <span>Region</span>
          <select
            id={t.id('region')}
            className={t.cls('select select--region')}
            data-testid="region"
            defaultValue=""
            onChange={(e) => merge({ region: e.target.value })}
          >
            <option value="">Choose a region</option>
            {t.v(REGIONS_A, REGIONS_B).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card title="Groups">
        <div data-ui="field">
          <span id={t.id('plan-label')}>Plan</span>
          <div role="group" aria-labelledby={t.id('plan-label')} data-ui="inline" data-testid="plan-group">
            {PLANS.map((p) => (
              <button
                key={p}
                type="button"
                className={t.cls(plan === p ? 'segment segment--active' : 'segment')}
                data-variant={plan === p ? 'primary' : undefined}
                aria-pressed={plan === p}
                onClick={() => merge({ plan: p })}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <fieldset data-testid="billing-group" role="radiogroup" aria-label="Billing">
          <legend>Billing</legend>
          {['monthly', 'yearly'].map((b) => (
            <label key={b} data-ui="inline">
              <input type="radio" name="billing" value={b} id={t.id(`billing-${b}`)} onChange={() => merge({ billing: b })} />
              {b === 'monthly' ? 'Monthly' : 'Yearly'}
            </label>
          ))}
        </fieldset>
      </Card>

      <Card title={t.v('Checkboxes and radios', 'Options')}>
        <div data-ui="stack">
          <label data-ui="inline">
            <input type="checkbox" id={t.id('accept-terms')} className={t.cls('check')} data-testid="accept-terms" onChange={(e) => merge({ terms: e.target.checked })} />
            Accept terms
          </label>
          <label data-ui="inline">
            <input
              type="checkbox"
              id={t.id('newsletter')}
              className={t.cls('check')}
              data-testid="newsletter"
              defaultChecked
              onChange={(e) => merge({ newsletter: e.target.checked })}
            />
            {t.v('Subscribe to newsletter', 'Subscribe to the newsletter')}
          </label>
        </div>
        <fieldset aria-label="Shipping">
          <legend>Shipping</legend>
          {t
            .v(['standard', 'express'], ['express', 'standard'])
            .map((s) => (
              <label key={s} data-ui="inline">
                <input type="radio" name="shipping" value={s} id={t.id(`shipping-${s}`)} data-testid={`shipping-${s}`} defaultChecked={s === 'standard'} onChange={() => merge({ shipping: s })} />
                {s === 'express' ? 'Express shipping' : 'Standard shipping'}
              </label>
            ))}
        </fieldset>
      </Card>
    </>
  )
}
