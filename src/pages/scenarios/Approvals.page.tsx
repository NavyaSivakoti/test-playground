import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Card, Modal, fileInfo, useToast } from '../../components/ui'
import { backend, type RecordRow } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { money, relTime, useMountMerge, Wrappers } from './advanced/util'
import { CANVAS_H, NODE_W, WorkflowCanvas, type WfEdge, type WfNode, type WfView } from './approvals/WorkflowCanvas'

export const meta: PageMeta = {
  path: '/approvals',
  title: 'Procurement approvals',
  group: 'Scenarios',
  summary:
    'A twelve-step purchase request wizard with generated field names and deep wrappers, an approval task list with confirm dialogs, a relative-time activity log and a canvas-only workflow builder.',
  order: 20,
  samples: [
    {
      id: 'PA1',
      title: 'Fill the first steps of the wizard',
      steps: [
        'Navigate to <base>/approvals/',
        'Enter Ada Lovelace in the "Requester name" field',
        'Enter ada@example.com in the "Requester email" field',
        'Click on "Next"',
        'Select option by text "General and Administrative" in the list "Department"',
        'Click on "Next"',
        'Verify that the current page displays text "Step 3 of 12: Vendor"',
      ],
      expected: 'state.step = 3; state.request.department = "General and Administrative"; state.request.requester = "Ada Lovelace".',
    },
    {
      id: 'PA2',
      title: 'Validation blocks Next',
      steps: ['Navigate to <base>/approvals/', 'Click on "Next"', 'Verify that the current page displays text "Enter the requester name"'],
      expected: 'state.step stays 1 and state.validationError = "Enter the requester name".',
    },
    {
      id: 'PA3',
      title: 'Submit and approve',
      steps: [
        'Complete all 12 steps (see the requirements doc for values) and click on "Submit request"',
        'Wait until the text "Request submitted" is present on the current page',
        'Click on the "Approve" located to the right of "Manager approval"',
        'Click on "Confirm"',
        'Verify that the current page displays text "Approved by Grace Hopper"',
      ],
      expected:
        'A purchase-requests record exists in the namespace; state.tasks[0].status = "approved"; the activity log shows the entry "just now".',
    },
    {
      id: 'PA4',
      title: 'Jump between steps',
      steps: ['Navigate to <base>/approvals/', 'Click on "7. Justification"', 'Verify that the current page displays text "Step 7 of 12: Justification"'],
      expected: 'state.step = 7 and state.lastJump = 7.',
    },
    {
      id: 'PA5',
      title: 'Connect workflow nodes on the canvas',
      steps: [
        'Navigate to <base>/approvals/',
        'Click on "Fit to view"',
        'AI Agent Drag from the right-hand dot of the "Finance approval" box on the canvas onto the "Legal review" box',
        'Verify that the current page displays text "Finance approval → Legal review"',
      ],
      expected:
        'state.canvas.edges contains ["finance","legal"]. A plain "Drag from … to …" step fails: canvas nodes are not DOM elements and state stays unchanged.',
    },
    {
      id: 'PA6',
      title: 'Link or plain text, by seed',
      query: 'seed=2',
      steps: ['Navigate to <base>/approvals/?seed=2', 'Click on "1 of 1 processed" if Present', 'Verify that the current page displays text "1 of 1 processed"'],
      expected: 'state.processedAs is "link" or "text" depending on the seed (always the same for the same seed); state.processedOpened = true only when it was a link.',
    },
  ],
}

const STEPS = ['Requester', 'Department', 'Vendor', 'Line items', 'Budget code', 'Cost centre', 'Justification', 'Attachments', 'Delivery', 'Approvers', 'Review', 'Submit']
const DEPARTMENTS = ['Engineering', 'Finance', 'General and Administrative', 'Marketing', 'Operations', 'Research']
const COST_CENTRES = ['CC-100 Head office', 'CC-210 Platform team', 'CC-340 Field operations', 'CC-415 Research lab']
const APPROVERS = [
  { key: 'manager', person: 'Grace Hopper', role: 'Manager approval' },
  { key: 'finance', person: 'Katherine Johnson', role: 'Finance approval' },
  { key: 'legal', person: 'Barbara Liskov', role: 'Legal review' },
]

interface Line {
  desc: string
  qty: string
  price: string
}
interface Req {
  requester: string
  email: string
  department: string
  vendor: string
  lines: Line[]
  budgetCode: string
  costCentre: string
  justification: string
  attachment: { name: string; size: number; sha256: string } | null
  deliveryDate: string
  deliveryAddress: string
  approvers: string[]
}
interface Task {
  id: string
  role: string
  person: string
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
}
interface LogEntry {
  at: number
  text: string
}

const EMPTY: Req = {
  requester: '',
  email: '',
  department: '',
  vendor: '',
  lines: [{ desc: '', qty: '1', price: '' }],
  budgetCode: '',
  costCentre: '',
  justification: '',
  attachment: null,
  deliveryDate: '',
  deliveryAddress: '',
  approvers: [],
}

const lineTotal = (l: Line) => Math.round((Number(l.qty) || 0) * (Number(l.price) || 0) * 100)
const reqTotal = (r: Req) => r.lines.reduce((s, l) => s + lineTotal(l), 0)

function validate(step: number, r: Req): string | null {
  switch (step) {
    case 1:
      if (!r.requester.trim()) return 'Enter the requester name'
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) return 'Enter a valid requester email'
      return null
    case 2:
      return r.department ? null : 'Choose a department'
    case 3:
      return r.vendor.trim() ? null : 'Enter the vendor name'
    case 4:
      return r.lines.some((l) => l.desc.trim() && Number(l.qty) > 0 && Number(l.price) > 0) ? null : 'Add at least one line item with a quantity and unit price'
    case 5:
      return /^BC-\d{4}$/.test(r.budgetCode) ? null : 'Budget code must look like BC-1234'
    case 6:
      return r.costCentre ? null : 'Choose a cost centre'
    case 7:
      return r.justification.trim().length >= 20 ? null : 'Justification must be at least 20 characters'
    case 9:
      if (!r.deliveryDate) return 'Choose a delivery date'
      return r.deliveryAddress.trim() ? null : 'Enter the delivery address'
    case 10:
      return r.approvers.length ? null : 'Select at least one approver'
    default:
      return null
  }
}

function initialNodes(variantB: boolean): WfNode[] {
  const base: [string, string][] = [
    ['request', 'Request'],
    ['manager', 'Manager approval'],
    ['finance', 'Finance approval'],
    ['legal', 'Legal review'],
    ['done', 'Done'],
  ]
  return base.map(([id, label], i) =>
    variantB ? { id, label, x: 140 + i * 640, y: i % 2 ? 230 : 70 } : { id, label, x: 80 + i * 620, y: 150 },
  )
}
const INITIAL_EDGES: WfEdge[] = [
  ['request', 'manager'],
  ['manager', 'finance'],
]

export default function ApprovalsPage() {
  const t = useTraps('approvals')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const variantB = config.variant === 'b'

  const [step, setStep] = useState(1)
  const [req, setReq] = useState<Req>(EMPTY)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [record, setRecord] = useState<RecordRow | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [log, setLog] = useState<LogEntry[]>([])
  const [confirm, setConfirm] = useState<{ task: Task; action: 'approve' | 'reject' } | null>(null)
  const [reason, setReason] = useState('')
  const [saved, setSaved] = useState<number | null>(null)
  const [, tick] = useState(0)
  const [nodes, setNodes] = useState<WfNode[]>(() => initialNodes(variantB))
  const [edges, setEdges] = useState<WfEdge[]>(INITIAL_EDGES)
  const [view, setView] = useState<WfView>({ zoom: 1, panX: 0, panY: 0 })
  const [connFrom, setConnFrom] = useState('finance')
  const [connTo, setConnTo] = useState('legal')
  const [processedOpen, setProcessedOpen] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const startedAt = useRef(nowMs(config))

  const processedAs: 'link' | 'text' = t.rand('processed') < 0.5 ? 'text' : 'link'
  const requestId = `PR-${1000 + Math.floor(t.rand('request-id') * 9000)}`

  // keep the relative dates fresh
  useEffect(() => {
    const i = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(i)
  }, [])

  const canvasState = (ns: WfNode[], es: WfEdge[]) => ({ nodes: ns.map(({ id, x, y }) => ({ id, x, y })), edges: es })

  useMountMerge(() => ({
    step: 1,
    processedAs,
    canvas: canvasState(nodes, edges),
  }))

  const refreshSaved = useCallback(() => {
    backend
      .list(config.ns, 'purchase-requests')
      .then((rows) => {
        setSaved(rows.length)
        merge({ savedRequests: rows.length })
      })
      .catch(() => setSaved(null))
  }, [config.ns, merge])
  useEffect(() => refreshSaved(), [refreshSaved])

  useResetListener(
    config.ns,
    useCallback(() => {
      setStep(1)
      setReq(EMPTY)
      setRecord(null)
      setTasks([])
      setLog([])
      setSaved(0)
    }, []),
  )

  const update = (patch: Partial<Req>) => {
    const next = { ...req, ...patch }
    setReq(next)
    merge({ request: { ...next, total: reqTotal(next) / 100 } })
  }

  const goTo = (n: number, via: 'next' | 'back' | 'jump') => {
    if (via === 'next') {
      const err = validate(step, req)
      setError(err)
      merge({ validationError: err })
      if (err) return
    } else {
      setError(null)
    }
    setStep(n)
    merge({ step: n, ...(via === 'jump' ? { lastJump: n } : {}), validationError: via === 'next' ? null : undefined })
  }

  const submit = async () => {
    for (let s = 1; s <= 10; s++) {
      const err = validate(s, req)
      if (err) {
        setError(`Fix step ${s} (${STEPS[s - 1]}): ${err}`)
        setStep(s)
        merge({ step: s, validationError: err, submitError: `step ${s}` })
        return
      }
    }
    setSubmitting(true)
    setError(null)
    try {
      if (config.bugs.includes('api500')) {
        await new Promise((r) => setTimeout(r, config.netDelay))
        throw new Error('API 500: Internal Server Error')
      }
      const newTasks: Task[] = APPROVERS.filter((a) => req.approvers.includes(a.key)).map((a) => ({
        id: `task-${a.key}`,
        role: a.role,
        person: a.person,
        status: 'pending',
      }))
      const row = await backend.create(config.ns, 'purchase-requests', {
        requestId,
        ...req,
        total: reqTotal(req) / 100,
        status: 'pending',
        tasks: newTasks,
      })
      const now = nowMs(config)
      const entries: LogEntry[] = [{ at: now, text: `Request ${requestId} submitted by ${req.requester}` }, ...log]
      setRecord(row)
      setTasks(newTasks)
      setLog(entries)
      merge({
        submitted: true,
        recordId: row.id,
        requestId,
        requestStatus: 'pending',
        tasks: newTasks,
        submitError: null,
        activity: entries.map((e) => e.text),
      })
      toast('Request submitted', { tone: 'success' })
      refreshSaved()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Submit failed: ${msg}`)
      merge({ submitError: msg })
    } finally {
      setSubmitting(false)
    }
  }

  const decide = async () => {
    if (!confirm || !record) return
    const { task, action } = confirm
    if (action === 'reject' && !reason.trim()) return
    const next = tasks.map((x) =>
      x.id === task.id ? { ...x, status: action === 'approve' ? ('approved' as const) : ('rejected' as const), reason: action === 'reject' ? reason : undefined } : x,
    )
    const status = next.some((x) => x.status === 'rejected') ? 'rejected' : next.every((x) => x.status === 'approved') ? 'approved' : 'pending'
    const text = action === 'approve' ? `Approved by ${task.person} (${task.role})` : `Rejected by ${task.person}: ${reason}`
    const entries = [{ at: nowMs(config), text }, ...log]
    setTasks(next)
    setLog(entries)
    setConfirm(null)
    setReason('')
    merge({ tasks: next, requestStatus: status, activity: entries.map((e) => e.text) })
    try {
      await backend.update(config.ns, 'purchase-requests', record.id, { tasks: next, status })
      merge({ recordStatus: status })
    } catch (e) {
      merge({ updateError: String(e) })
    }
  }

  // ---------- canvas ----------
  const setCanvas = (ns: WfNode[], es: WfEdge[], action: string) => {
    setNodes(ns)
    setEdges(es)
    merge({ canvas: canvasState(ns, es), lastCanvasAction: action })
  }
  const connect = (from: string, to: string) => {
    if (edges.some(([a, b]) => a === from && b === to)) {
      merge({ lastCanvasAction: `duplicate:${from}->${to}` })
      return
    }
    setCanvas(nodes, [...edges, [from, to]], `connected:${from}->${to}`)
  }
  const fit = () => {
    const el = scroller.current
    const cw = el ? el.clientWidth : 1000
    const minX = Math.min(...nodes.map((n) => n.x))
    const maxX = Math.max(...nodes.map((n) => n.x + NODE_W))
    const minY = Math.min(...nodes.map((n) => n.y))
    const zoom = Math.min(1, Math.round(((cw - 40) / (maxX - minX)) * 1000) / 1000)
    const v = { zoom, panX: 20 / zoom - minX, panY: Math.max(0, (CANVAS_H * 0.25) / zoom - minY) }
    setView(v)
    if (el) el.scrollLeft = 0
    merge({ view: { zoom, fitted: true }, lastCanvasAction: 'fit' })
  }
  const actual = () => {
    setView({ zoom: 1, panX: 0, panY: 0 })
    merge({ view: { zoom: 1, fitted: false }, lastCanvasAction: 'actual-size' })
  }
  const label = (id: string) => nodes.find((n) => n.id === id)?.label ?? id

  const now = nowMs(config)
  const overall = tasks.some((x) => x.status === 'rejected')
    ? 'Rejected'
    : tasks.length && tasks.every((x) => x.status === 'approved')
      ? 'Approved'
      : `Pending approval (${tasks.filter((x) => x.status === 'approved').length} of ${tasks.length})`

  // ---------- wizard fields ----------
  const fieldId = (k: string) => t.id(`pr-${k}`)
  const text = (k: keyof Req, labelText: string, extra?: { type?: string; placeholder?: string; multiline?: boolean }) => (
    <Wrappers scope="approvals" k={k}>
      <label data-ui="field" htmlFor={fieldId(k)}>
        <span>{labelText}</span>
        {extra?.multiline ? (
          <textarea
            id={fieldId(k)}
            name={t.uuid(k)}
            className={t.cls('form-control form-control--textarea')}
            rows={4}
            value={req[k] as string}
            onChange={(e) => update({ [k]: e.target.value } as Partial<Req>)}
          />
        ) : (
          <input
            id={fieldId(k)}
            name={t.uuid(k)}
            className={t.cls('form-control')}
            type={extra?.type ?? 'text'}
            placeholder={extra?.placeholder}
            value={req[k] as string}
            onChange={(e) => update({ [k]: e.target.value } as Partial<Req>)}
          />
        )}
      </label>
    </Wrappers>
  )

  const stepBody = () => {
    switch (step) {
      case 1:
        return (
          <>
            {text('requester', 'Requester name')}
            {text('email', 'Requester email', { type: 'email', placeholder: 'name@example.com' })}
          </>
        )
      case 2:
        return (
          <Wrappers scope="approvals" k="department">
            <label data-ui="field" htmlFor={fieldId('department')}>
              <span>Department</span>
              <select id={fieldId('department')} name={t.uuid('department')} value={req.department} onChange={(e) => update({ department: e.target.value })}>
                <option value="">Choose…</option>
                {t.shuffle(DEPARTMENTS, 'departments').map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </Wrappers>
        )
      case 3:
        return text('vendor', 'Vendor name', { placeholder: 'e.g. Summit Paper Co.' })
      case 4:
        return (
          <>
            {req.lines.map((l, i) => (
              <Wrappers scope="approvals" k={`line-${i}`} key={i} depth={3}>
                <div data-ui="inline" data-testid={`line-${i + 1}`}>
                  {(['desc', 'qty', 'price'] as const).map((f) => {
                    const lab = `Item ${i + 1} ${f === 'desc' ? 'description' : f === 'qty' ? 'quantity' : 'unit price'}`
                    const id = fieldId(`line-${i}-${f}`)
                    return (
                      <label data-ui="field" htmlFor={id} key={f} style={{ maxWidth: f === 'desc' ? 260 : 120 }}>
                        <span>{lab}</span>
                        <input
                          id={id}
                          name={t.uuid(`line-${i}-${f}`)}
                          inputMode={f === 'desc' ? 'text' : 'decimal'}
                          value={l[f]}
                          onChange={(e) => update({ lines: req.lines.map((x, j) => (j === i ? { ...x, [f]: e.target.value } : x)) })}
                        />
                      </label>
                    )
                  })}
                  <span data-testid={`line-${i + 1}-total`}>{money(lineTotal(l))}</span>
                </div>
              </Wrappers>
            ))}
            <div data-ui="inline">
              <button type="button" onClick={() => update({ lines: [...req.lines, { desc: '', qty: '1', price: '' }] })}>
                {t.v('Add line item', 'Add another line')}
              </button>
              <strong data-testid="lines-total">Total: {money(reqTotal(req))}</strong>
            </div>
          </>
        )
      case 5:
        return text('budgetCode', 'Budget code', { placeholder: 'BC-1234' })
      case 6:
        return (
          <Wrappers scope="approvals" k="costCentre">
            <label data-ui="field" htmlFor={fieldId('costCentre')}>
              <span>Cost centre</span>
              <select id={fieldId('costCentre')} name={t.uuid('costCentre')} value={req.costCentre} onChange={(e) => update({ costCentre: e.target.value })}>
                <option value="">Choose…</option>
                {COST_CENTRES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
          </Wrappers>
        )
      case 7:
        return text('justification', 'Business justification', { multiline: true })
      case 8:
        return (
          <Wrappers scope="approvals" k="attachment">
            <label data-ui="field" htmlFor={fieldId('attachment')}>
              <span>Attach quote</span>
              <input
                id={fieldId('attachment')}
                name={t.uuid('attachment')}
                type="file"
                data-testid="attach-quote"
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  update({ attachment: f ? await fileInfo(f) : null })
                }}
              />
              <span data-ui="hint">Optional. {req.attachment ? `Attached: ${req.attachment.name} (${req.attachment.size} bytes)` : 'No file attached.'}</span>
            </label>
          </Wrappers>
        )
      case 9:
        return (
          <>
            {text('deliveryDate', 'Delivery date', { type: 'date' })}
            {text('deliveryAddress', 'Delivery address', { multiline: true })}
          </>
        )
      case 10:
        return (
          <Wrappers scope="approvals" k="approvers">
            <fieldset>
              <legend>Approvers</legend>
              {APPROVERS.map((a) => (
                <label key={a.key} style={{ display: 'block' }}>
                  <input
                    type="checkbox"
                    name={t.uuid(`approver-${a.key}`)}
                    id={fieldId(`approver-${a.key}`)}
                    checked={req.approvers.includes(a.key)}
                    onChange={(e) =>
                      update({ approvers: e.target.checked ? [...req.approvers, a.key] : req.approvers.filter((x) => x !== a.key) })
                    }
                  />{' '}
                  {a.person} ({a.role.split(' ')[0]})
                </label>
              ))}
            </fieldset>
          </Wrappers>
        )
      case 11:
        return (
          <dl data-testid="review" style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '0.25rem 1rem' }}>
            {(
              [
                ['Requester', `${req.requester} <${req.email}>`],
                ['Department', req.department],
                ['Vendor', req.vendor],
                ['Line items', `${req.lines.filter((l) => l.desc).length} (${money(reqTotal(req))})`],
                ['Budget code', req.budgetCode],
                ['Cost centre', req.costCentre],
                ['Justification', req.justification],
                ['Attachment', req.attachment?.name ?? 'none'],
                ['Delivery', `${req.deliveryDate} – ${req.deliveryAddress}`],
                ['Approvers', req.approvers.join(', ')],
              ] as const
            ).map(([k, v]) => (
              <div key={k} style={{ display: 'contents' }}>
                <dt style={{ fontWeight: 600 }}>{k}</dt>
                <dd style={{ margin: 0 }} data-testid={`review-${k.toLowerCase().replace(/\s+/g, '-')}`}>
                  {v || '—'}
                </dd>
              </div>
            ))}
          </dl>
        )
      case 12:
        return (
          <div>
            <p>Submitting creates request {requestId} and approval tasks for the selected approvers.</p>
            <button data-variant="primary" disabled={submitting} onClick={submit} id={t.id('submit-request')} className={t.cls('btn btn--submit')}>
              {submitting ? 'Submitting…' : t.v('Submit request', 'Send for approval')}
            </button>
          </div>
        )
    }
  }

  const backBtn = (
    <button key="back" type="button" disabled={step === 1} onClick={() => goTo(step - 1, 'back')} id={t.id('wizard-back')} className={t.cls('btn btn--back')}>
      {t.v('Back', 'Previous')}
    </button>
  )
  const nextBtn =
    step < 12 ? (
      <button key="next" type="button" data-variant="primary" onClick={() => goTo(step + 1, 'next')} id={t.id('wizard-next')} className={t.cls('btn btn--next')}>
        {t.v('Next', 'Continue')}
      </button>
    ) : null

  return (
    <>
      <Card title="Batch import">
        <p data-testid="processed-line">
          Last batch:{' '}
          {processedAs === 'link' ? (
            <a
              href="#processed"
              id={t.id('processed-link')}
              onClick={(e) => {
                e.preventDefault()
                setProcessedOpen(true)
                merge({ processedOpened: true })
              }}
            >
              1 of 1 processed
            </a>
          ) : (
            <span id={t.id('processed-text')}>1 of 1 processed</span>
          )}
        </p>
        {processedOpen ? <p data-testid="processed-details">Batch BT-01: one purchase request imported without errors.</p> : null}
        <p data-ui="hint">Depending on the seed this renders as a link or as plain text (reproducible for the same seed).</p>
      </Card>

      {!record ? (
        <Card title="Purchase request" data-testid="wizard">
          <nav aria-label="Step jumper" data-testid="step-jumper">
            <Wrappers scope="approvals" k="jumper" depth={2}>
              <div data-ui="inline" style={{ gap: '0.3rem' }}>
                {STEPS.map((s, i) => (
                  <button
                    key={s}
                    type="button"
                    data-variant={step === i + 1 ? 'primary' : 'ghost'}
                    aria-current={step === i + 1 ? 'step' : undefined}
                    style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem' }}
                    onClick={() => goTo(i + 1, 'jump')}
                  >
                    {t.v(`${i + 1}. ${s}`, `${s} (${i + 1})`)}
                  </button>
                ))}
              </div>
            </Wrappers>
          </nav>
          <h3 data-testid="step-heading">
            Step {step} of 12: {STEPS[step - 1]}
          </h3>
          <Wrappers scope="approvals" k={`step-${step}`} depth={5}>
            <div data-testid="step-body">{stepBody()}</div>
          </Wrappers>
          {error ? (
            <p data-ui="error" role="alert" data-testid="wizard-error">
              {error}
            </p>
          ) : null}
          <div data-ui="inline" style={{ marginTop: '0.8rem' }}>
            {variantB ? [nextBtn, backBtn] : [backBtn, nextBtn]}
          </div>
          {t.dup ? (
            <button type="button" style={{ opacity: 0.5 }} onClick={() => merge({ decoy: true })}>
              {t.v('Next', 'Continue')}
            </button>
          ) : null}
        </Card>
      ) : (
        <Card title="Request submitted" data-testid="submitted">
          <p>
            <strong data-testid="request-id">{requestId}</strong> · {money(reqTotal(req))} · Status:{' '}
            <Badge tone={overall === 'Approved' ? 'success' : overall === 'Rejected' ? 'danger' : 'warning'} data-testid="request-status">
              {overall}
            </Badge>
          </p>
          <h3>Approval tasks</h3>
          <p data-ui="hint">Every card has the same “Approve” and “Reject” labels on purpose: target them relative to the task title.</p>
          <div data-ui="grid">
            {tasks.map((task) => (
              <div key={task.id} data-ui="card" data-testid={task.id} style={{ margin: 0 }}>
                <Wrappers scope="approvals" k={task.id} depth={3}>
                  <div data-ui="inline" style={{ justifyContent: 'space-between' }}>
                    <strong>{task.role}</strong>
                    <Badge tone={task.status === 'approved' ? 'success' : task.status === 'rejected' ? 'danger' : 'info'}>{task.status}</Badge>
                  </div>
                  <div data-ui="hint">Assigned to {task.person}</div>
                  {task.status === 'pending' ? (
                    <div data-ui="inline" style={{ marginTop: '0.5rem' }}>
                      <button data-variant="primary" onClick={() => setConfirm({ task, action: 'approve' })}>
                        {t.v('Approve', 'Approve request')}
                      </button>
                      <button data-variant="danger" onClick={() => setConfirm({ task, action: 'reject' })}>
                        {t.v('Reject', 'Reject request')}
                      </button>
                    </div>
                  ) : task.reason ? (
                    <div>Reason: {task.reason}</div>
                  ) : null}
                </Wrappers>
              </div>
            ))}
          </div>
          <button
            type="button"
            style={{ marginTop: '0.8rem' }}
            onClick={() => {
              setRecord(null)
              setReq(EMPTY)
              setStep(1)
              setTasks([])
              merge({ submitted: false, step: 1, request: null, tasks: [] })
            }}
          >
            New purchase request
          </button>
        </Card>
      )}

      <Card title="Activity log">
        <ol data-testid="activity-log" style={{ paddingLeft: '1.2rem' }}>
          {[...log, { at: startedAt.current - 3 * 86_400_000, text: 'Workflow template "Standard purchase" published' }].map((e, i) => (
            <li key={i}>
              {e.text} · <time dateTime={new Date(e.at).toISOString()}>{relTime(e.at, now)}</time>
            </li>
          ))}
        </ol>
        <p data-ui="hint" data-testid="saved-count">
          Saved purchase requests in namespace “{config.ns}”: {saved ?? '…'}
        </p>
      </Card>

      <Card title="Workflow builder">
        <p data-ui="hint">
          The boxes below are pixels on a 3000 px wide canvas, not DOM elements. Drag a box to move it; drag from a box’s right-hand dot onto another box to
          connect them.
        </p>
        <div data-ui="inline" style={{ marginBottom: '0.5rem' }}>
          <button type="button" onClick={fit} id={t.id('fit-view')}>
            {t.v('Fit to view', 'Fit all nodes')}
          </button>
          <button type="button" onClick={actual}>
            Actual size
          </button>
          <button type="button" onClick={() => setCanvas(initialNodes(variantB), INITIAL_EDGES, 'reset')}>
            Reset workflow
          </button>
        </div>
        <div
          ref={scroller}
          data-testid="canvas-scroller"
          aria-label="Workflow canvas scroller"
          style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8, maxWidth: '100%' }}
          onScroll={(e) => merge({ canvasScrollLeft: Math.round(e.currentTarget.scrollLeft) })}
        >
          <WorkflowCanvas
            nodes={nodes}
            edges={edges}
            view={view}
            accent={variantB ? '#7c3aed' : '#3554d1'}
            canvasId={t.id('workflow-canvas')}
            testId="workflow-canvas"
            onMove={(ns, id) => setCanvas(ns, edges, `moved:${id}`)}
            onConnect={connect}
            onCancel={(why) => merge({ lastCanvasAction: `cancelled:${why}` })}
          />
        </div>
        <div data-ui="row" style={{ marginTop: '0.8rem' }} data-testid="canvas-fallback">
          <div>
            <h3>Nodes (accessible list)</h3>
            <ul>
              {nodes.map((n) => (
                <li key={n.id}>
                  {n.label} at x {n.x}, y {n.y}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Connections</h3>
            <ul data-testid="edge-list">
              {edges.map(([a, b]) => (
                <li key={`${a}-${b}`}>
                  {label(a)} → {label(b)}
                </li>
              ))}
            </ul>
            <div data-ui="inline">
              <label data-ui="field">
                <span>Connect from</span>
                <select value={connFrom} onChange={(e) => setConnFrom(e.target.value)}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <label data-ui="field">
                <span>Connect to</span>
                <select value={connTo} onChange={(e) => setConnTo(e.target.value)}>
                  {nodes.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" onClick={() => (connFrom === connTo ? merge({ lastCanvasAction: 'cancelled:self' }) : connect(connFrom, connTo))}>
                Add connection
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        open={!!confirm}
        title={confirm?.action === 'approve' ? 'Confirm approval' : 'Confirm rejection'}
        onClose={() => setConfirm(null)}
        labelledBy="approval-confirm-title"
        data-testid="confirm-modal"
      >
        {confirm ? (
          <>
            <p>
              {confirm.action === 'approve' ? 'Approve' : 'Reject'} “{confirm.task.role}” for {requestId} as {confirm.task.person}?
            </p>
            {confirm.action === 'reject' ? (
              <label data-ui="field">
                <span>Rejection reason</span>
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
              </label>
            ) : null}
            <div data-ui="inline">
              <button data-variant={confirm.action === 'approve' ? 'primary' : 'danger'} onClick={decide} disabled={confirm.action === 'reject' && !reason.trim()}>
                {t.v('Confirm', 'Yes, continue')}
              </button>
              <button onClick={() => setConfirm(null)}>Cancel</button>
            </div>
          </>
        ) : null}
      </Modal>
    </>
  )
}

