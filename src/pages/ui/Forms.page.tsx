import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Card, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { LocalHint } from './uiPart1Helpers'

export const meta: PageMeta = {
  path: '/ui/forms',
  title: 'Registration form',
  group: 'General UI',
  summary:
    'A sign-up form with inline validation on blur and on submit, a password strength meter, a masked phone number, a dependent field, a character counter and a saved draft. It is the data-driven target for testdata/registration.csv and registration.xlsx.',
  covers: [13, 30, 70, 132, 138, 432, 467, 572],
  order: 10,
  samples: [
    {
      id: 'F1',
      title: 'Create an account (happy path)',
      steps: [
        'Navigate to <base>/ui/forms/',
        'Enter Ada in the "First name" field',
        'Enter Lovelace in the "Last name" field',
        'Enter ada.l@example.com in the "Email" field',
        'Enter Str0ng!Pass in the "Password" field',
        'Enter Str0ng!Pass in the "Confirm password" field',
        'Enter +44 20 7946 0001 in the "Phone" field',
        'Check the checkbox "I accept the terms"',
        'Click on "Create account"',
        'Verify that the current page displays text "Account created"',
      ],
      expected: 'state.submitted = true, state.accountId is set, state.values.phone = "+44 20 7946 0001" and one record of kind "accounts" exists in the namespace.',
    },
    {
      id: 'F2',
      title: 'Data-driven run with testdata/registration.csv (or .xlsx)',
      steps: [
        'Navigate to <base>/ui/forms/',
        'Enter ${firstName} in the "First name" field',
        'Enter ${lastName} in the "Last name" field',
        'Enter ${email} in the "Email" field',
        'Enter ${password} in the "Password" field',
        'Enter ${confirmPassword} in the "Confirm password" field',
        'Enter ${phone} in the "Phone" field',
        'Check the checkbox "I accept the terms"',
        'Click on "Create account"',
        'Verify that the current page displays text "${expectedMessage}"',
      ],
      expected:
        'Bind the test data profile to <base>/fixtures/testdata/registration.csv (6 rows). Each row shows its expectedMessage; for the no-terms row skip the checkbox step (acceptTerms=false) so "You must accept the terms" appears. state.errors lists exactly the failing field.',
    },
    {
      id: 'F3',
      title: 'Inline validation on blur',
      steps: ['Enter alan.example.com in the "Email" field', 'Press Tab Key', 'Verify that the current page displays text "Enter a valid email address"'],
      expected: 'state.errors.email = "Enter a valid email address" before any submit (state.submitted is not true).',
    },
    {
      id: 'F4',
      title: 'Dependent field and character counter',
      steps: [
        'Select option by text "Business" in the list "Account type"',
        'Enter Analytical Engines Ltd in the "Company name" field',
        'Enter Writes the first published algorithm in the "Bio" field',
        'Verify that the "Bio counter" displays text "36 / 160"',
      ],
      expected: 'state.values.accountType = "Business", state.values.company = "Analytical Engines Ltd", state.bioLength = 36.',
    },
    {
      id: 'F5',
      title: 'Draft survives a reload',
      steps: ['Enter Grace in the "First name" field', 'Click on "Save draft"', 'Click on the Refresh button in the browser', 'Verify that the "First name" inputbox has value "Grace"'],
      expected: 'After reload state.draftRestored = true and state.values.firstName = "Grace". "Reset" clears the form and the draft.',
    },
    {
      id: 'F6',
      title: 'Drifted layout',
      query: 'variant=b',
      steps: ['Enter Ada in the "First name" field', 'Click on "Create account"'],
      expected: 'In variant b the button reads "Sign up", the email label reads "Email address" and last name comes first; a self-healing run should still submit (state.submitAttempts = 1).',
    },
  ],
}

interface Values {
  firstName: string
  lastName: string
  email: string
  password: string
  confirmPassword: string
  countryCode: string
  phone: string
  dob: string
  accountType: 'Personal' | 'Business'
  company: string
  bio: string
  terms: boolean
}
type FieldName = keyof Values
type Errors = Partial<Record<FieldName, string>>

const EMPTY: Values = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  countryCode: '+1',
  phone: '',
  dob: '',
  accountType: 'Personal',
  company: '',
  bio: '',
  terms: false,
}

const COUNTRIES: { code: string; label: string; groups: number[] }[] = [
  { code: '+1', label: 'United States (+1)', groups: [3, 3, 4] },
  { code: '+44', label: 'United Kingdom (+44)', groups: [2, 4, 4] },
  { code: '+49', label: 'Germany (+49)', groups: [3, 4, 4] },
  { code: '+91', label: 'India (+91)', groups: [5, 5] },
  { code: '+61', label: 'Australia (+61)', groups: [1, 4, 4] },
]
const BIO_MAX = 160
const MSG = {
  firstName: 'Enter your first name',
  lastName: 'Enter your last name',
  email: 'Enter a valid email address',
  password: 'Password must be at least 8 characters',
  confirmPassword: 'Passwords do not match',
  phone: 'Enter a valid phone number',
  dob: 'Date of birth cannot be in the future',
  company: 'Enter a company name',
  terms: 'You must accept the terms',
}

function formatPhone(code: string, digits: string): string {
  const c = COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0]
  const out: string[] = []
  let i = 0
  for (const g of c.groups) {
    if (i >= digits.length) break
    out.push(digits.slice(i, i + g))
    i += g
  }
  return out.join(' ')
}
const maxDigits = (code: string) => (COUNTRIES.find((x) => x.code === code) ?? COUNTRIES[0]).groups.reduce((a, b) => a + b, 0)

function strength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '–' }
  let s = 0
  if (pw.length >= 8) s++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++
  if (/\d/.test(pw)) s++
  if (/[^A-Za-z0-9]/.test(pw)) s++
  if (pw.length >= 12) s++
  return { score: s, label: s <= 2 ? 'Weak' : s === 3 ? 'Fair' : 'Strong' }
}

function validate(v: Values, today: string): Errors {
  const e: Errors = {}
  if (!v.firstName.trim()) e.firstName = MSG.firstName
  if (!v.lastName.trim()) e.lastName = MSG.lastName
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = MSG.email
  if (v.password.length < 8) e.password = MSG.password
  if (v.confirmPassword !== v.password) e.confirmPassword = MSG.confirmPassword
  if (v.phone && v.phone.replace(/\D/g, '').length < 7) e.phone = MSG.phone
  if (v.dob && v.dob > today) e.dob = MSG.dob
  if (v.accountType === 'Business' && !v.company.trim()) e.company = MSG.company
  if (!v.terms) e.terms = MSG.terms
  return e
}

/** What goes into the observable state (never the raw passwords). */
function publicValues(v: Values) {
  return {
    firstName: v.firstName,
    lastName: v.lastName,
    email: v.email,
    passwordLength: v.password.length,
    confirmPasswordLength: v.confirmPassword.length,
    phone: v.phone ? `${v.countryCode} ${v.phone}` : '',
    dob: v.dob,
    accountType: v.accountType,
    company: v.accountType === 'Business' ? v.company : '',
    bio: v.bio,
    terms: v.terms,
  }
}

function FormField({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div data-ui="field">
      <label htmlFor={id} style={{ fontWeight: 600 }}>
        {label}
      </label>
      {children}
      {hint ? <span data-ui="hint">{hint}</span> : null}
      {error ? (
        <span data-ui="error" role="alert" id={`${id}-error`} data-testid={`error-${id}`}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export default function FormsPage() {
  const t = useTraps('forms')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const draftKey = nsKey(config, 'registration_draft')
  const [values, setValues] = useState<Values>(EMPTY)
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>({})
  const [submittedOnce, setSubmittedOnce] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [status, setStatus] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [restored, setRestored] = useState(false)
  const attempts = useRef(0)
  const today = new Date(nowMs(config)).toISOString().slice(0, 10)

  const allErrors = validate(values, today)
  const visibleErrors: Errors = {}
  for (const k of Object.keys(allErrors) as FieldName[]) if (submittedOnce || touched[k]) visibleErrors[k] = allErrors[k]

  // restore draft on load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey)
      if (raw) {
        const d = JSON.parse(raw) as Partial<Values>
        const next = { ...EMPTY, ...d, password: '', confirmPassword: '' }
        setValues(next)
        setRestored(true)
        merge({ draftRestored: true, values: publicValues(next) })
      }
    } catch {
      /* ignore broken drafts */
    }
  }, [draftKey, merge])

  // mirror visible errors into the observable state
  const errorsJson = JSON.stringify(visibleErrors)
  useEffect(() => {
    merge({ errors: JSON.parse(errorsJson) as Errors })
  }, [errorsJson, merge])

  const update = <K extends FieldName>(k: K, val: Values[K]) => {
    const next = { ...values, [k]: val }
    setValues(next)
    merge({ values: publicValues(next), bioLength: next.bio.length })
    setStatus(null)
  }
  const blur = (k: FieldName) => {
    setTouched((s) => ({ ...s, [k]: true }))
    merge({ lastBlur: k })
  }

  const onPhone = (raw: string) => {
    let code = values.countryCode
    let rest = raw
    const compact = raw.replace(/\s/g, '')
    if (compact.startsWith('+')) {
      const match = COUNTRIES.filter((c) => compact.startsWith(c.code)).sort((a, b) => b.code.length - a.code.length)[0]
      if (!match) {
        // still typing the country code (e.g. "+4"): keep it as typed
        if (/^\+\d{0,2}$/.test(compact)) return update('phone', compact)
      } else {
        code = match.code
        rest = compact.slice(match.code.length)
      }
    }
    const digits = rest.replace(/\D/g, '').slice(0, maxDigits(code))
    const formatted = formatPhone(code, digits)
    const next = { ...values, countryCode: code, phone: formatted }
    setValues(next)
    merge({ values: publicValues(next) })
  }

  const ids = {
    firstName: t.id(t.v('first-name', 'given-name')),
    lastName: t.id(t.v('last-name', 'family-name')),
    email: t.id(t.v('email', 'reg-email')),
    password: t.id('password'),
    confirmPassword: t.id('confirm-password'),
    countryCode: t.id('country-code'),
    phone: t.id('phone'),
    dob: t.id('dob'),
    accountType: t.id('account-type'),
    company: t.id('company'),
    bio: t.id('bio'),
    terms: t.id('terms'),
  }
  const describedBy = (k: FieldName) => (visibleErrors[k] ? `${ids[k]}-error` : undefined)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    attempts.current += 1
    setSubmittedOnce(true)
    const errs = validate(values, today)
    const failing = Object.keys(errs) as FieldName[]
    merge({ submitAttempts: attempts.current, errors: errs, values: publicValues(values) })
    if (failing.length) {
      setStatus({ tone: 'danger', text: `Please fix ${failing.length} field${failing.length === 1 ? '' : 's'}` })
      merge({ submitted: false })
      const first = document.getElementById(ids[failing[0]])
      first?.focus()
      return
    }
    setBusy(true)
    try {
      if (config.bugs.includes('api500')) throw new Error('500')
      const record = publicValues(values)
      let accountId: string
      if (config.bugs.includes('savePersist')) accountId = `acc-${Math.floor(t.rand('acc') * 1e6)}`
      else accountId = (await backend.create(config.ns, 'accounts', record)).id
      setStatus({ tone: 'success', text: 'Account created' })
      toast(config.bugs.includes('toastText') ? 'Account registered' : 'Account created', { tone: 'success' })
      merge({ submitted: true, accountId, errors: {} })
    } catch {
      setStatus({ tone: 'danger', text: 'Could not create account (server error 500)' })
      merge({ submitted: false, serverError: 500 })
    } finally {
      setBusy(false)
    }
  }

  const saveDraft = () => {
    const { password: _p, confirmPassword: _c, ...rest } = values
    void _p
    void _c
    try {
      localStorage.setItem(draftKey, JSON.stringify(rest))
    } catch {
      /* storage unavailable */
    }
    toast('Draft saved')
    merge({ draftSaved: true, draftKey })
  }

  const reset = () => {
    setValues(EMPTY)
    setTouched({})
    setSubmittedOnce(false)
    setStatus(null)
    setRestored(false)
    try {
      localStorage.removeItem(draftKey)
    } catch {
      /* ignore */
    }
    merge({ values: publicValues(EMPTY), errors: {}, submitted: false, reset: true, draftSaved: false, draftRestored: false, bioLength: 0 })
  }

  const pw = strength(values.password)

  const firstNameField = (
    <FormField key="fn" id={ids.firstName} label="First name" error={visibleErrors.firstName}>
      <input
        id={ids.firstName}
        className={t.cls('reg-form__input reg-form__input--first')}
        name="firstName"
        autoComplete="given-name"
        value={values.firstName}
        aria-invalid={!!visibleErrors.firstName}
        aria-describedby={describedBy('firstName')}
        onChange={(e) => update('firstName', e.target.value)}
        onBlur={() => blur('firstName')}
      />
    </FormField>
  )
  const lastNameField = (
    <FormField key="ln" id={ids.lastName} label="Last name" error={visibleErrors.lastName}>
      <input
        id={ids.lastName}
        className={t.cls('reg-form__input reg-form__input--last')}
        name="lastName"
        autoComplete="family-name"
        value={values.lastName}
        aria-invalid={!!visibleErrors.lastName}
        aria-describedby={describedBy('lastName')}
        onChange={(e) => update('lastName', e.target.value)}
        onBlur={() => blur('lastName')}
      />
    </FormField>
  )

  const body = (
    <>
      <div data-ui="row">{t.v([firstNameField, lastNameField], [lastNameField, firstNameField])}</div>

      <FormField id={ids.email} label={t.v('Email', 'Email address')} error={visibleErrors.email}>
        <input
          id={ids.email}
          className={t.cls('reg-form__input')}
          name="email"
          type="text"
          inputMode="email"
          autoComplete="email"
          value={values.email}
          aria-invalid={!!visibleErrors.email}
          aria-describedby={describedBy('email')}
          onChange={(e) => update('email', e.target.value)}
          onBlur={() => blur('email')}
        />
      </FormField>

      <FormField
        id={ids.password}
        label="Password"
        error={visibleErrors.password}
        hint={
          <span data-testid="password-strength" data-score={pw.score}>
            Strength: {pw.label}
          </span>
        }
      >
        <div data-ui="inline">
          <input
            id={ids.password}
            className={t.cls('reg-form__input reg-form__password')}
            name="password"
            type={showPw ? 'text' : 'password'}
            autoComplete="new-password"
            value={values.password}
            aria-invalid={!!visibleErrors.password}
            aria-describedby={describedBy('password')}
            onChange={(e) => {
              update('password', e.target.value)
              merge({ passwordStrength: strength(e.target.value).label })
            }}
            onBlur={() => blur('password')}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            id={t.id('toggle-password')}
            className={t.cls('reg-form__toggle')}
            aria-pressed={showPw}
            onClick={() => {
              setShowPw((s) => !s)
              merge({ passwordVisible: !showPw })
            }}
          >
            {showPw ? 'Hide password' : 'Show password'}
          </button>
        </div>
        <div aria-hidden="true" style={{ height: 6, borderRadius: 4, background: 'var(--surface-2)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${(pw.score / 5) * 100}%`,
              background: pw.label === 'Strong' ? 'var(--success)' : pw.label === 'Fair' ? 'var(--warning)' : 'var(--danger)',
            }}
          />
        </div>
      </FormField>

      <FormField id={ids.confirmPassword} label="Confirm password" error={visibleErrors.confirmPassword}>
        <input
          id={ids.confirmPassword}
          className={t.cls('reg-form__input')}
          name="confirmPassword"
          type={showPw ? 'text' : 'password'}
          autoComplete="new-password"
          value={values.confirmPassword}
          aria-invalid={!!visibleErrors.confirmPassword}
          aria-describedby={describedBy('confirmPassword')}
          onChange={(e) => update('confirmPassword', e.target.value)}
          onBlur={() => blur('confirmPassword')}
        />
      </FormField>

      <div data-ui="row">
        <FormField id={ids.countryCode} label="Country code">
          <select
            id={ids.countryCode}
            className={t.cls('reg-form__select')}
            name="countryCode"
            value={values.countryCode}
            onChange={(e) => {
              const code = e.target.value
              const digits = values.phone.replace(/\D/g, '').slice(0, maxDigits(code))
              const next = { ...values, countryCode: code, phone: formatPhone(code, digits) }
              setValues(next)
              merge({ values: publicValues(next) })
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
        </FormField>
        <FormField id={ids.phone} label="Phone" error={visibleErrors.phone} hint="Digits are grouped as you type; a leading +code selects the country.">
          <input
            id={ids.phone}
            className={t.cls('reg-form__input reg-form__phone')}
            name="phone"
            type="tel"
            autoComplete="tel-national"
            placeholder={formatPhone(values.countryCode, '2025550143207')}
            value={values.phone}
            aria-describedby={describedBy('phone')}
            onChange={(e) => onPhone(e.target.value)}
            onBlur={() => blur('phone')}
          />
        </FormField>
      </div>

      <FormField id={ids.dob} label="Date of birth" error={visibleErrors.dob}>
        <input
          id={ids.dob}
          className={t.cls('reg-form__input')}
          name="dob"
          type="date"
          max={today}
          value={values.dob}
          aria-describedby={describedBy('dob')}
          onChange={(e) => update('dob', e.target.value)}
          onBlur={() => blur('dob')}
        />
      </FormField>

      <FormField id={ids.accountType} label="Account type">
        <select
          id={ids.accountType}
          className={t.cls('reg-form__select')}
          name="accountType"
          value={values.accountType}
          onChange={(e) => update('accountType', e.target.value as Values['accountType'])}
        >
          <option value="Personal">Personal</option>
          <option value="Business">Business</option>
        </select>
      </FormField>

      {values.accountType === 'Business' ? (
        <FormField id={ids.company} label="Company name" error={visibleErrors.company}>
          <input
            id={ids.company}
            className={t.cls('reg-form__input')}
            name="company"
            value={values.company}
            aria-describedby={describedBy('company')}
            onChange={(e) => update('company', e.target.value)}
            onBlur={() => blur('company')}
          />
        </FormField>
      ) : null}

      <FormField
        id={ids.bio}
        label="Bio"
        hint={
          <span aria-label="Bio counter" data-testid="bio-counter" aria-live="polite">
            {values.bio.length} / {BIO_MAX}
          </span>
        }
      >
        <textarea
          id={ids.bio}
          className={t.cls('reg-form__textarea')}
          name="bio"
          rows={3}
          maxLength={BIO_MAX}
          value={values.bio}
          onChange={(e) => update('bio', e.target.value.slice(0, BIO_MAX))}
        />
      </FormField>

      <div data-ui="field">
        <label data-ui="inline" htmlFor={ids.terms}>
          <input
            id={ids.terms}
            className={t.cls('reg-form__terms')}
            name="terms"
            type="checkbox"
            checked={values.terms}
            aria-describedby={describedBy('terms')}
            onChange={(e) => {
              update('terms', e.target.checked)
              setTouched((s) => ({ ...s, terms: true }))
            }}
          />
          I accept the terms
        </label>
        {visibleErrors.terms ? (
          <span data-ui="error" role="alert" id={`${ids.terms}-error`} data-testid={`error-${ids.terms}`}>
            {visibleErrors.terms}
          </span>
        ) : null}
      </div>

      <div data-ui="inline" style={{ marginTop: 12 }}>
        {t.dup ? (
          <button type="button" className={t.cls('reg-form__decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'Create account' })}>
            {t.v('Create account', 'Sign up')}
          </button>
        ) : null}
        <button
          type="submit"
          id={t.id(t.v('create-account', 'sign-up'))}
          className={t.cls('reg-form__submit')}
          data-variant="primary"
          data-testid={t.v('create-account', 'sign-up')}
          disabled={busy}
        >
          {t.v('Create account', 'Sign up')}
        </button>
        <button type="button" id={t.id('save-draft')} className={t.cls('reg-form__draft')} onClick={saveDraft}>
          Save draft
        </button>
        <button type="button" id={t.id('reset-form')} className={t.cls('reg-form__reset')} onClick={reset}>
          Reset
        </button>
      </div>
      {status ? (
        <p role="status" data-testid="form-status" data-tone={status.tone} style={{ color: status.tone === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
          {status.text}
        </p>
      ) : null}
    </>
  )

  return (
    <Card title="Create your account">
      <LocalHint />
      {restored ? (
        <p data-ui="hint" data-testid="draft-restored">
          Draft restored from this browser.
        </p>
      ) : null}
      <form noValidate onSubmit={submit} id={t.id('registration-form')} className={t.cls('reg-form')} aria-label="Registration">
        {t.v(
          body,
          <fieldset style={{ border: 'none', padding: 0, margin: 0 }} data-testid="reg-wrapper">
            <legend data-ui="hint">All fields except phone, date of birth and bio are required.</legend>
            {body}
          </fieldset>,
        )}
      </form>
    </Card>
  )
}
