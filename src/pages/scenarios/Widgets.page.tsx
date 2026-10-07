import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Card } from '../../components/ui'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { delayParam } from './shared'
import { CalendarField, Kanban, PortalSelect, ScrollList } from './widgets/Controls'

export const meta: PageMeta = {
  path: '/widgets',
  title: 'Custom widget lab',
  group: 'Scenarios',
  summary:
    'Hand-made controls instead of native ones: a portal dropdown, a slow autocomplete, chips, a prefilled select that must be cleared, two kinds of date pickers, a kanban board, role-less radios and toggles, a long scrolling list, a rich-text editor, a slider and an icon-only button with a tooltip.',
  covers: [432, 674, 559, 23, 186],
  order: 4,
  samples: [
    {
      id: 'W1',
      title: 'Portal dropdown',
      steps: ['Navigate to <base>/widgets/', 'Select option by text "Finance" in the list "Department"'],
      expected: 'state.department = "Finance". The options are rendered in document.body, not inside the field. With duplicateLabels a decoy "Department" writes state.decoy instead.',
    },
    {
      id: 'W2',
      title: 'Autocomplete with slow options',
      query: 'netDelay=1500',
      steps: ['Enter Lis in the "City" field', 'Wait until the text "Lisbon" is present on the current page', 'Click on "Lisbon"'],
      expected: 'Options arrive netDelay ms after typing (600 ms when unset). state.city = "Lisbon".',
    },
    {
      id: 'W3',
      title: 'Chips',
      steps: ['Click on "Skills"', 'Click on "Testing"', 'Click on "Design"', 'Clear all selected values (chips/tags) from the "Skills" field'],
      expected: 'state.skills goes ["Testing"] → ["Testing","Design"] → [] (state.skillsCleared = 1).',
    },
    {
      id: 'W4',
      title: 'Prefilled select that must be cleared first',
      steps: ['Click on "Clear Status"', 'Select option by text "Paused" in the list "Status"'],
      expected: 'state.status = "Paused" (starts "Active"; while a value is set the field cannot be opened).',
    },
    {
      id: 'W5',
      title: 'Native and custom date pickers',
      query: 'now=2026-03-10T09:00:00Z',
      steps: ['Enter 2026-03-15 in the "Start date" field', 'Click on "End date"', 'Click on "20"'],
      expected: 'state.startDate = "2026-03-15"; with the frozen clock the calendar opens on March 2026 and state.endDate = "2026-03-20". The grid re-mounts on hover (state.calendarRenders grows).',
    },
    {
      id: 'W6',
      title: 'Kanban drag',
      steps: ['Drag from "T-3" to "Done"'],
      expected: 'state.kanban = { card: "T-3", column: "Done", index: 1, method: "html5" or "pointer" }.',
    },
    {
      id: 'W7',
      title: 'Role-less radios and toggle',
      steps: ['Click on "Pro"', 'Click on "Email alerts"'],
      expected: 'state.plan = "Pro", state.emailAlerts = true. The elements are plain divs without roles.',
    },
    {
      id: 'W8',
      title: 'Long list, editor and slider',
      steps: ['Select option by text "(UTC+09:00) Tokyo" in the list "Timezone"', 'Enter Quarterly plan in the "Description" field', 'Mouseover on "Preferences"'],
      expected: 'state.timezone = "(UTC+09:00) Tokyo" (option 101 of 120, below the fold of the list); state.description = "Quarterly plan", state.plainNotes unchanged; tooltip "Open preferences" visible.',
    },
  ],
}

const DEPARTMENTS = ['Engineering', 'Finance', 'Operations', 'Sales', 'Support']
const CITIES = ['Amsterdam', 'Athens', 'Berlin', 'Bologna', 'Lisbon', 'Lille', 'Lima', 'London', 'Lyon', 'Madrid', 'Oslo', 'Porto', 'Prague', 'Vienna']
const SKILLS = ['Testing', 'Design', 'Automation', 'Accessibility', 'Performance']
const STATUSES = ['Active', 'Paused', 'Archived']
const pad = (n: number) => String(Math.abs(n)).padStart(2, '0')
const TIMEZONES = Array.from({ length: 120 }, (_, i) => {
  const mins = -12 * 60 + Math.round((i * 26 * 60) / 119 / 15) * 15
  const off = `UTC${mins < 0 ? '-' : '+'}${pad(Math.trunc(mins / 60))}:${pad(mins % 60)}`
  if (i === 0) return `(${off}) Baker Island`
  if (i === 100) return '(UTC+09:00) Tokyo'
  if (i === 119) return `(${off}) Kiritimati`
  return `(${off}) Region ${String(i + 1).padStart(3, '0')}`
})

export default function WidgetsPage() {
  const t = useTraps('widgets')
  const config = useConfig()
  const location = useLocation()
  const { merge } = usePageState()
  const netDelay = delayParam(location.search, 'netDelay', config.netDelay, 600)

  const [department, setDepartment] = useState<string | null>(null)
  const [decoyDept, setDecoyDept] = useState<string | null>(null)
  // W2
  const [cityQuery, setCityQuery] = useState('')
  const [cityOptions, setCityOptions] = useState<string[] | null>(null)
  const [cityLoading, setCityLoading] = useState(false)
  const cityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // W3
  const [skills, setSkills] = useState<string[]>([])
  const [skillsOpen, setSkillsOpen] = useState(false)
  const skillsCleared = useRef(0)
  const skillsPop = useRef<HTMLDivElement>(null)
  const skillsBox = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!skillsOpen) return
    const onDown = (e: MouseEvent) => {
      const n = e.target as Node
      if (!skillsPop.current?.contains(n) && !skillsBox.current?.contains(n)) setSkillsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [skillsOpen])
  // W4
  const [status, setStatus] = useState<string | null>('Active')
  const [statusOpen, setStatusOpen] = useState(false)
  // W5
  const [endDate, setEndDate] = useState<string | null>(null)
  const calRenders = useRef(0)
  // W7
  const [plan, setPlan] = useState('Basic')
  const [alerts, setAlerts] = useState(false)
  // W8
  const [tz, setTz] = useState<string | null>(null)
  const [tip, setTip] = useState(false)
  const settingsClicks = useRef(0)

  useEffect(() => {
    merge({ status: 'Active', plan: 'Basic', emailAlerts: false, volume: 30, skills: [] })
  }, [merge])

  const onCity = (q: string) => {
    setCityQuery(q)
    setCityOptions(null)
    merge({ cityQuery: q })
    if (cityTimer.current) clearTimeout(cityTimer.current)
    if (!q.trim()) {
      setCityLoading(false)
      return
    }
    setCityLoading(true)
    cityTimer.current = setTimeout(() => {
      setCityLoading(false)
      setCityOptions(CITIES.filter((c) => c.toLowerCase().startsWith(q.trim().toLowerCase())))
    }, netDelay)
  }
  const pickCity = (c: string) => {
    setCityQuery(c)
    setCityOptions(null)
    merge({ city: c })
  }
  const setSkillList = (next: string[]) => {
    setSkills(next)
    merge({ skills: next })
  }
  const onKanban = useCallback((m: Record<string, unknown>) => merge({ kanban: m }), [merge])

  const skillsId = t.id('skills')
  const deptOptions = t.shuffle(t.v(DEPARTMENTS, [...DEPARTMENTS].reverse()), 'departments')

  return (
    <>
      <div data-ui="grid">
        <Card title="Portal dropdown (W1)" data-testid="w1">
          {t.dup ? (
            <PortalSelect
              label="Department"
              options={deptOptions}
              value={decoyDept}
              placeholder="Select…"
              idBase={t.id('department-decoy')}
              testId="department-decoy"
              onSelect={(v) => {
                setDecoyDept(v)
                merge({ decoy: `department:${v}` })
              }}
            />
          ) : null}
          <PortalSelect
            label="Department"
            options={deptOptions}
            value={department}
            placeholder={t.v('Select…', 'Pick a department')}
            idBase={t.id(t.v('department', 'dept-select'))}
            testId={t.v('department', 'dept-select')}
            onSelect={(v) => {
              setDepartment(v)
              merge({ department: v })
            }}
          />
        </Card>

        <Card title="Autocomplete (W2)" data-testid="w2">
          <div style={{ position: 'relative' }}>
            <label data-ui="field">
              <span>{t.v('City', 'Town or city')}</span>
              <input
                id={t.id('city')}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={!!cityOptions?.length}
                aria-controls="city-options"
                autoComplete="off"
                value={cityQuery}
                onChange={(e) => onCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && cityOptions?.length) pickCity(cityOptions[0])
                }}
              />
            </label>
            {cityLoading ? <span data-ui="hint">Searching…</span> : null}
            {cityOptions ? (
              <div role="listbox" id="city-options" aria-label="City suggestions" data-ui="popover" style={{ top: '100%', left: 0 }}>
                {cityOptions.length ? (
                  cityOptions.map((c) => (
                    <div key={c} role="option" aria-selected={false} data-ui="menu-item" style={{ cursor: 'pointer' }} onClick={() => pickCity(c)}>
                      {c}
                    </div>
                  ))
                ) : (
                  <div data-ui="hint" style={{ padding: 6 }}>
                    No matches
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Chips (W3)" data-testid="w3">
          <div style={{ position: 'relative' }} ref={skillsBox}>
            <label id="skills-label" htmlFor={skillsId} style={{ fontWeight: 600, fontSize: '0.85rem' }}>
              Skills
            </label>
            <div
              data-ui="inline"
              data-testid="skills-field"
              style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 6, minHeight: 40, gap: 6, background: 'var(--surface)' }}
            >
              {skills.map((s) => (
                <span key={s} data-ui="badge" data-testid="chip">
                  {s}
                  <button
                    type="button"
                    aria-label={`Remove ${s}`}
                    data-variant="ghost"
                    style={{ padding: '0 0.2rem' }}
                    onClick={() => setSkillList(skills.filter((x) => x !== s))}
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id={skillsId}
                aria-labelledby="skills-label"
                placeholder={skills.length ? '' : t.v('Add skills', 'Type a skill')}
                onFocus={() => setSkillsOpen(true)}
                onClick={() => setSkillsOpen(true)}
                style={{ border: 'none', outline: 'none', flex: 1, minWidth: 80, background: 'transparent' }}
              />
              {skills.length ? (
                <button
                  type="button"
                  id={t.id('skills-clear')}
                  aria-label="Clear all"
                  onClick={() => {
                    skillsCleared.current++
                    setSkills([])
                    merge({ skills: [], skillsCleared: skillsCleared.current })
                  }}
                >
                  Clear all
                </button>
              ) : null}
            </div>
            {skillsOpen ? (
              <div role="listbox" aria-label="Skills options" data-ui="popover" style={{ top: '100%', left: 0 }} ref={skillsPop}>
                {SKILLS.filter((s) => !skills.includes(s)).map((s) => (
                  <div key={s} role="option" aria-selected={false} data-ui="menu-item" style={{ cursor: 'pointer' }} onClick={() => setSkillList([...skills, s])}>
                    {s}
                  </div>
                ))}
                <button type="button" data-variant="link" style={{ margin: 6 }} onClick={() => setSkillsOpen(false)}>
                  Done
                </button>
              </div>
            ) : null}
          </div>
        </Card>

        <Card title="Prefilled select (W4)" data-testid="w4">
          <div data-ui="field" style={{ position: 'relative' }}>
            <span id="status-label">Status</span>
            {status ? (
              <div data-ui="inline" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '0.3rem 0.5rem', background: 'var(--surface)' }}>
                <span data-testid="status-value" aria-labelledby="status-label">
                  {status}
                </span>
                <button
                  type="button"
                  id={t.id('status-clear')}
                  aria-label={t.v('Clear Status', 'Remove status')}
                  data-variant="ghost"
                  style={{ marginLeft: 'auto', padding: '0 0.4rem' }}
                  onClick={() => {
                    setStatus(null)
                    setStatusOpen(false)
                    merge({ status: null, statusCleared: true })
                  }}
                >
                  ×
                </button>
              </div>
            ) : (
              <>
                <button type="button" role="combobox" aria-labelledby="status-label" aria-expanded={statusOpen} id={t.id('status')} onClick={() => setStatusOpen((o) => !o)}>
                  Select status ▾
                </button>
                {statusOpen ? (
                  <div role="listbox" aria-label="Status options" data-ui="popover" style={{ top: '100%', left: 0 }}>
                    {STATUSES.map((s) => (
                      <div
                        key={s}
                        role="option"
                        aria-selected={false}
                        data-ui="menu-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => {
                          setStatus(s)
                          setStatusOpen(false)
                          merge({ status: s })
                        }}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </Card>

        <Card title="Dates (W5)" data-testid="w5">
          <label data-ui="field">
            <span>Start date</span>
            <input type="date" id={t.id('start-date')} onChange={(e) => merge({ startDate: e.target.value })} />
          </label>
          <CalendarField
            label="End date"
            idBase={t.id('end-date')}
            nowMs={nowMs(config)}
            value={endDate}
            prevLabel={t.v('Previous month', 'Earlier')}
            nextLabel={t.v('Next month', 'Later')}
            onRender={() => {
              calRenders.current++
              if (calRenders.current % 5 === 1) merge({ calendarRenders: calRenders.current })
            }}
            onSelect={(iso) => {
              setEndDate(iso)
              merge({ endDate: iso, calendarRenders: calRenders.current })
            }}
          />
        </Card>

        <Card title="Role-less controls (W7)" data-testid="w7">
          <p data-ui="hint">These are plain divs with click handlers and no ARIA roles, on purpose.</p>
          <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Plan</div>
          <div style={{ display: 'flex', gap: 8, margin: '4px 0 10px' }}>
            {t.v(['Basic', 'Pro', 'Enterprise'], ['Enterprise', 'Pro', 'Basic']).map((p) => (
              <div
                key={p}
                data-plan={p}
                data-selected={plan === p}
                id={t.id(`plan-${p.toLowerCase()}`)}
                onClick={() => {
                  setPlan(p)
                  merge({ plan: p })
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', padding: '0.3rem 0.6rem', border: '1px solid var(--border)', borderRadius: 8, borderColor: plan === p ? 'var(--accent)' : undefined }}
              >
                <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px solid var(--accent)', background: plan === p ? 'var(--accent)' : 'transparent' }} />
                {p}
              </div>
            ))}
          </div>
          <div
            id={t.id('email-alerts')}
            data-on={alerts}
            onClick={() => {
              setAlerts(!alerts)
              merge({ emailAlerts: !alerts })
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
          >
            <span style={{ width: 36, height: 20, borderRadius: 10, background: alerts ? 'var(--accent)' : 'var(--border)', position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', top: 2, left: alerts ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff' }} />
            </span>
            Email alerts
          </div>
        </Card>

        <Card title="Long list (W8)" data-testid="w8">
          <ScrollList
            label="Timezone"
            options={TIMEZONES}
            value={tz}
            idBase={t.id('timezone')}
            onSelect={(v) => {
              setTz(v)
              merge({ timezone: v, timezoneIndex: TIMEZONES.indexOf(v) })
            }}
          />
          <p data-ui="hint">120 options; most are below the fold of the list and need scrolling inside it.</p>
        </Card>
      </div>

      <Card title="Kanban (W6)" data-testid="w6">
        <Kanban
          columns={['Todo', 'Doing', 'Done']}
          columnLabel={(c) => (c === 'Done' ? t.v('Done', 'Completed') : c)}
          initial={{ Todo: ['T-1', 'T-2', 'T-3'], Doing: ['T-4'], Done: ['T-5'] }}
          onMove={onKanban}
        />
      </Card>

      <div data-ui="grid">
        <Card title="Editors" data-testid="w9">
          <div data-ui="field">
            <span id="description-label">Description</span>
            <div
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-labelledby="description-label"
              id={t.id('description')}
              data-testid="rich-description"
              onInput={(e) => merge({ description: (e.currentTarget as HTMLDivElement).innerText.trim(), lastEditor: 'description' })}
              style={{ minHeight: 70, border: '1px solid var(--border)', borderRadius: 8, padding: 8, background: 'var(--surface)' }}
            />
            <span data-ui="hint">Rich text (contenteditable), not a textarea.</span>
          </div>
          <label data-ui="field">
            <span>Plain notes</span>
            <textarea id={t.id('plain-notes')} rows={3} onChange={(e) => merge({ plainNotes: e.target.value, lastEditor: 'plainNotes' })} />
          </label>
        </Card>

        <Card title="Slider and icon button" data-testid="w10">
          <label data-ui="field">
            <span>Volume</span>
            <input type="range" min={0} max={100} step={1} defaultValue={30} id={t.id('volume')} onChange={(e) => merge({ volume: Number(e.target.value) })} />
          </label>
          <span style={{ position: 'relative', display: 'inline-block' }}>
            <button
              type="button"
              id={t.id('settings-icon')}
              aria-label={t.v('Preferences', 'Options')}
              aria-describedby={tip ? 'settings-tip' : undefined}
              onMouseEnter={() => {
                setTip(true)
                merge({ tooltipShown: true })
              }}
              onMouseLeave={() => setTip(false)}
              onFocus={() => setTip(true)}
              onBlur={() => setTip(false)}
              onClick={() => {
                settingsClicks.current++
                merge({ settingsClicks: settingsClicks.current })
              }}
              style={{ fontSize: '1.1rem', padding: '0.35rem 0.55rem' }}
            >
              <span aria-hidden="true">⚙</span>
            </button>
            {tip ? (
              <span id="settings-tip" role="tooltip" data-ui="popover" style={{ top: '110%', left: 0, minWidth: 0, whiteSpace: 'nowrap', padding: '0.2rem 0.5rem' }}>
                Open preferences
              </span>
            ) : null}
          </span>
          <p data-ui="hint">The button has an icon only; its name comes from aria-label.</p>
        </Card>
      </div>
    </>
  )
}
