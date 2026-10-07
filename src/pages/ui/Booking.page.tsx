import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { LocalHint } from './uiPart1Helpers'

export const meta: PageMeta = {
  path: '/ui/booking',
  title: 'Booking calendar',
  group: 'General UI',
  summary:
    'A month calendar and week view with past dates disabled, 30-minute time slots (some already booked, from the seed), a time-zone select, recurring options and server-backed bookings. Use the frozen clock (now=) for repeatable dates.',
  covers: [26, 138, 432, 549, 590],
  order: 16,
  samples: [
    {
      id: 'B1',
      title: 'Book a slot',
      query: 'now=2026-10-06T08:00:00Z&ns=book1',
      steps: [
        'Navigate to <base>/ui/booking/?now=2026-10-06T08:00:00Z&ns=book1',
        'Click on "Wednesday, October 14, 2026"',
        'Click on "10:00"',
        'Click on "Book"',
        'Verify that the current page displays text "Booked 2026-10-14 at 10:00 (UTC)"',
      ],
      expected: 'state.booking = {date:"2026-10-14", slot:"10:00", tz:"UTC", utc:"2026-10-14T10:00:00.000Z"}; the 10:00 button is now disabled and labelled booked; a "bookings" record exists.',
    },
    {
      id: 'B2',
      title: 'Past dates are disabled',
      query: 'now=2026-10-06T08:00:00Z',
      steps: ['Verify that the "Friday, October 2, 2026" is disabled or not clickable.', 'Click on "Next month"', 'Verify that the current page displays text "November 2026"'],
      expected: 'state.month = "2026-11". The frozen clock makes the result the same every day.',
    },
    {
      id: 'B3',
      title: 'Time zone',
      query: 'now=2026-10-06T08:00:00Z',
      steps: ['Click on "Thursday, October 15, 2026"', 'Select option by text "Asia/Kolkata (UTC+05:30)" in the list "Time zone"', 'Click on "09:30"'],
      expected: 'state.tz = "Asia/Kolkata", state.slot = "09:30" and state.slotUtc = "2026-10-15T04:00:00.000Z".',
    },
    {
      id: 'B4',
      title: 'Recurring booking with validation',
      query: 'now=2026-10-06T08:00:00Z',
      steps: ['Click on "Thursday, October 15, 2026"', 'Click on "11:00"', 'Check the checkbox "Repeat"', 'Enter 2026-10-01 in the "End date" field', 'Click on "Book"'],
      expected: 'Shows "End date must be after the booking date" and nothing is booked (state.booking unchanged, state.bookingError set).',
    },
    {
      id: 'B5',
      title: 'Week view',
      query: 'now=2026-10-06T08:00:00Z',
      steps: ['Click on "Week view"', 'Click on "Next week"', 'Verify that the current page displays text "Oct 12 – Oct 18, 2026"'],
      expected: 'state.view = "week" and state.weekStart = "2026-10-12".',
    },
  ],
}

const TZS = [
  { tz: 'UTC', label: 'UTC' },
  { tz: 'Europe/London', label: 'Europe/London' },
  { tz: 'America/New_York', label: 'America/New_York' },
  { tz: 'Asia/Kolkata', label: 'Asia/Kolkata' },
  { tz: 'Australia/Sydney', label: 'Australia/Sydney' },
]
const SLOTS = Array.from({ length: 16 }, (_, i) => `${String(9 + Math.floor(i / 2)).padStart(2, '0')}:${i % 2 ? '30' : '00'}`)
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** minutes to add to UTC to get local time in tz, at the given instant */
function tzOffsetMin(tz: string, utcMs: number): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(utcMs))
  const g = (k: string) => Number(parts.find((p) => p.type === k)?.value)
  const asUtc = Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'))
  return Math.round((asUtc - Math.floor(utcMs / 60000) * 60000) / 60000)
}
/** UTC instant for a wall-clock date+time in tz */
function wallToUtc(date: string, time: string, tz: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, d, hh, mm)
  const off1 = tzOffsetMin(tz, guess)
  const off2 = tzOffsetMin(tz, guess - off1 * 60000)
  return guess - off2 * 60000
}
const offsetLabel = (min: number) => `UTC${min >= 0 ? '+' : '-'}${String(Math.floor(Math.abs(min) / 60)).padStart(2, '0')}:${String(Math.abs(min) % 60).padStart(2, '0')}`
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
const parse = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}
const addDays = (s: string, n: number) => {
  const d = parse(s)
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}
const longLabel = (s: string) => {
  const d = parse(s)
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`
}
const to12h = (s: string) => {
  const [h, m] = s.split(':').map(Number)
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

export default function BookingPage() {
  const t = useTraps('booking')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [tz, setTz] = useState('UTC')
  const now = nowMs(config)
  // "today" in the selected time zone
  const today = useMemo(() => {
    const local = new Date(now + tzOffsetMin(tz, now) * 60000)
    return iso(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz, config.now])
  const [month, setMonth] = useState(() => today.slice(0, 7))
  const [view, setView] = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState(() => {
    const d = parse(today)
    return addDays(today, -((d.getUTCDay() + 6) % 7))
  })
  const [date, setDate] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [repeat, setRepeat] = useState(false)
  const [freq, setFreq] = useState<'Weekly' | 'Monthly'>('Weekly')
  const [endDate, setEndDate] = useState('')
  const [booked, setBooked] = useState<{ date: string; slot: string }[]>([])
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)

  const loadBookings = useCallback(async () => {
    const rows = await backend.list(config.ns, 'bookings')
    const list = rows.map((r) => ({ date: String(r.data.date), slot: String(r.data.slot) }))
    setBooked(list)
    merge({ serverBookings: list.length })
  }, [config.ns, merge])
  useEffect(() => {
    void loadBookings()
  }, [loadBookings])
  useEffect(() => {
    merge({ month, view, tz, today, date: null, slot: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSeedBooked = (d: string, s: string) => t.rand(`booked:${d}:${s}`) < 0.2
  const slotState = (d: string, s: string): 'free' | 'booked' | 'past' => {
    if (booked.some((b) => b.date === d && b.slot === s)) return 'booked'
    if (isSeedBooked(d, s)) return 'booked'
    if (wallToUtc(d, s, tz) < now) return 'past'
    return 'free'
  }

  const pickDate = (d: string) => {
    setDate(d)
    setSlot(null)
    setMessage(null)
    merge({ date: d, slot: null, slotUtc: null })
  }
  const pickSlot = (s: string) => {
    if (!date) return
    setSlot(s)
    setMessage(null)
    merge({ slot: s, slotUtc: new Date(wallToUtc(date, s, tz)).toISOString() })
  }

  const book = async () => {
    if (!date || !slot) {
      setMessage({ tone: 'danger', text: 'Choose a date and a time' })
      merge({ bookingError: 'Choose a date and a time' })
      return
    }
    if (repeat && (!endDate || endDate <= date)) {
      setMessage({ tone: 'danger', text: 'End date must be after the booking date' })
      merge({ bookingError: 'End date must be after the booking date' })
      return
    }
    if (slotState(date, slot) !== 'free') {
      setMessage({ tone: 'danger', text: 'That time is no longer available' })
      return
    }
    setBusy(true)
    const utc = new Date(wallToUtc(date, slot, tz)).toISOString()
    const data = { date, slot, tz, utc, recurrence: repeat ? { frequency: freq, until: endDate } : null }
    const row = await backend.create(config.ns, 'bookings', data)
    setBooked((b) => [...b, { date, slot }])
    const text = `Booked ${date} at ${slot} (${tz})`
    setMessage({ tone: 'success', text })
    toast('Booking confirmed', { tone: 'success' })
    merge({ booking: { ...data, id: row.id }, bookingError: null })
    setSlot(null)
    setBusy(false)
  }

  // month grid (Mon-first)
  const [my, mm] = month.split('-').map(Number)
  const first = new Date(Date.UTC(my, mm - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const daysIn = new Date(Date.UTC(my, mm, 0)).getUTCDate()
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => iso(my, mm - 1, i + 1))]
  while (cells.length % 7) cells.push(null)

  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(my, mm - 1 + n, 1))
    const next = iso(d.getUTCFullYear(), d.getUTCMonth(), 1).slice(0, 7)
    setMonth(next)
    merge({ month: next })
  }
  const shiftWeek = (n: number) => {
    const next = addDays(weekStart, 7 * n)
    setWeekStart(next)
    merge({ weekStart: next })
  }

  const dayButton = (d: string, compact: boolean) => {
    const past = d < today
    const selected = d === date
    return (
      <button
        key={d}
        type="button"
        aria-label={longLabel(d)}
        aria-pressed={selected}
        disabled={past}
        data-testid={`day-${d}`}
        className={t.cls('cal__day')}
        data-variant={selected ? 'primary' : undefined}
        onClick={() => pickDate(d)}
        style={{ width: '100%', justifyContent: 'center', padding: compact ? '0.45rem 0' : '0.6rem 0', fontWeight: d === today ? 700 : 400 }}
      >
        {compact ? parse(d).getUTCDate() : `${DAYS[parse(d).getUTCDay()].slice(0, 3)} ${parse(d).getUTCDate()}`}
      </button>
    )
  }

  const weekEnd = addDays(weekStart, 6)
  const shortMd = (s: string) => `${MONTHS[parse(s).getUTCMonth()].slice(0, 3)} ${parse(s).getUTCDate()}`

  const tzSelect = (
    <div data-ui="field" key="tz">
      <label htmlFor={t.id('tz')} style={{ fontWeight: 600 }}>
        Time zone
      </label>
      <select
        id={t.id('tz')}
        className={t.cls('booking__tz')}
        value={tz}
        onChange={(e) => {
          const next = e.target.value
          setTz(next)
          setSlot(null)
          merge({ tz: next, slot: null, slotUtc: null })
        }}
      >
        {TZS.map((z) => (
          <option key={z.tz} value={z.tz}>
            {z.tz === 'UTC' ? 'UTC' : `${z.label} (${offsetLabel(tzOffsetMin(z.tz, now))})`}
          </option>
        ))}
      </select>
    </div>
  )

  const viewSwitch = (
    <div data-ui="inline" key="views" role="group" aria-label="Calendar view">
      <button aria-pressed={view === 'month'} data-variant={view === 'month' ? 'primary' : undefined} onClick={() => (setView('month'), merge({ view: 'month' }))}>
        Month view
      </button>
      <button aria-pressed={view === 'week'} data-variant={view === 'week' ? 'primary' : undefined} onClick={() => (setView('week'), merge({ view: 'week', weekStart }))}>
        Week view
      </button>
    </div>
  )

  return (
    <>
      <Card title="Pick a date">
        <LocalHint />
        <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
          {t.v([viewSwitch, tzSelect], [tzSelect, viewSwitch])}
        </div>
        <p data-ui="hint">
          Today is <span data-testid="today">{today}</span> ({tz}).
        </p>
        {view === 'month' ? (
          <div style={{ maxWidth: 420 }}>
            <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
              <button id={t.id('prev-month')} aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                ‹
              </button>
              <strong data-testid="month-label" aria-live="polite">
                {MONTHS[mm - 1]} {my}
              </strong>
              <button id={t.id('next-month')} aria-label="Next month" onClick={() => shiftMonth(1)}>
                ›
              </button>
            </div>
            <div role="grid" aria-label={`${MONTHS[mm - 1]} ${my}`} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} role="columnheader" data-ui="hint" style={{ textAlign: 'center' }}>
                  {d}
                </div>
              ))}
              {cells.map((c, i) => (c ? <div key={c} role="gridcell">{dayButton(c, true)}</div> : <div key={`e${i}`} role="gridcell" />))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 640 }}>
            <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
              <button id={t.id('prev-week')} aria-label="Previous week" onClick={() => shiftWeek(-1)}>
                ‹
              </button>
              <strong data-testid="week-label">
                {shortMd(weekStart)} – {shortMd(weekEnd)}, {parse(weekEnd).getUTCFullYear()}
              </strong>
              <button id={t.id('next-week')} aria-label="Next week" onClick={() => shiftWeek(1)}>
                ›
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginTop: 8 }}>
              {Array.from({ length: 7 }, (_, i) => dayButton(addDays(weekStart, i), false))}
            </div>
          </div>
        )}
      </Card>

      <Card title="Pick a time">
        {!date ? (
          <p data-ui="hint">Choose a date first.</p>
        ) : (
          <>
            <p>
              Times for <strong data-testid="selected-date">{date}</strong> in {tz}
            </p>
            <div role="group" aria-label="Time slots" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))', gap: 6 }}>
              {SLOTS.map((s) => {
                const st = slotState(date, s)
                const label = t.v(s, to12h(s))
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={st !== 'free'}
                    aria-pressed={slot === s}
                    aria-label={st === 'booked' ? `${label} booked` : label}
                    data-testid={`slot-${s}`}
                    data-slot-state={st}
                    className={t.cls('slot')}
                    data-variant={slot === s ? 'primary' : undefined}
                    onClick={() => pickSlot(s)}
                    style={{ justifyContent: 'center', textDecoration: st === 'booked' ? 'line-through' : undefined }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <p data-ui="hint">Struck-through times are already booked; earlier times today are disabled.</p>
          </>
        )}

        <h3>Repeat</h3>
        <label data-ui="inline" htmlFor={t.id('repeat')}>
          <input id={t.id('repeat')} type="checkbox" checked={repeat} onChange={(e) => (setRepeat(e.target.checked), merge({ repeat: e.target.checked }))} />
          Repeat
        </label>
        {repeat ? (
          <div data-ui="row">
            <div data-ui="field">
              <label htmlFor={t.id('freq')} style={{ fontWeight: 600 }}>
                Frequency
              </label>
              <select id={t.id('freq')} value={freq} onChange={(e) => (setFreq(e.target.value as 'Weekly' | 'Monthly'), merge({ frequency: e.target.value }))}>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
            </div>
            <div data-ui="field">
              <label htmlFor={t.id('end-date')} style={{ fontWeight: 600 }}>
                End date
              </label>
              <input id={t.id('end-date')} type="date" value={endDate} onChange={(e) => (setEndDate(e.target.value), merge({ endDate: e.target.value }))} />
            </div>
          </div>
        ) : null}

        <div data-ui="inline" style={{ marginTop: 12 }}>
          <button id={t.id(t.v('book', 'confirm-booking'))} className={t.cls('booking__submit')} data-variant="primary" disabled={busy} onClick={() => void book()}>
            {t.v('Book', 'Confirm booking')}
          </button>
          {t.dup ? (
            <button className={t.cls('booking__decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'Book' })}>
              {t.v('Book', 'Confirm booking')}
            </button>
          ) : null}
        </div>
        {message ? (
          <p role={message.tone === 'success' ? 'status' : 'alert'} data-testid="booking-message" style={{ color: message.tone === 'success' ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
            {message.text}
          </p>
        ) : null}
      </Card>
    </>
  )
}
