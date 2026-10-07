import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Badge, Card, Modal, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nsKey, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useResetListener } from '../../core/reset'
import { LocalHint } from './uiPart1Helpers'

export const meta: PageMeta = {
  path: '/ui/crud',
  title: 'Tasks (create, edit, delete)',
  group: 'General UI',
  summary:
    'A small task manager on server-backed records: create and edit in a dialog, inline edit, delete with confirmation and undo, bulk delete, and an optimistic update that can be forced to fail and roll back.',
  covers: [26, 27, 30, 70, 138, 168, 467, 592],
  order: 15,
  samples: [
    {
      id: 'D1',
      title: 'Create a task',
      steps: [
        'Navigate to <base>/ui/crud/?ns=crud1',
        'Click on "New task"',
        'Enter Prepare demo data in the "Title" field',
        'Select option by text "High" in the list "Priority"',
        'Click on "Create task"',
        'Verify that the current page displays text "Prepare demo data"',
      ],
      expected: 'state.lastAction = "create", state.tasks contains {title:"Prepare demo data", priority:"High"} and the record survives a browser refresh.',
    },
    {
      id: 'D2',
      title: 'Inline edit persists',
      steps: ['Double click on "Write release notes"', 'Enter Write release notes v2 in the "Edit title" field', 'Press Enter/Return Key', 'Click on the Refresh button in the browser', 'Verify that the current page displays text "Write release notes v2"'],
      expected: 'state.lastAction = "inline-edit" and the new title is still there after reload. With bugs=savePersist the toast says saved but the old title returns after reload.',
    },
    {
      id: 'D3',
      title: 'Delete with confirmation and undo',
      steps: ['Click on the "Delete" located to the right of "Fix login bug"', 'Click on "Confirm delete"', 'Click on "Undo"'],
      expected: 'The task disappears, a 5-second snackbar offers Undo, and after Undo it is back: state.lastAction = "undo".',
    },
    {
      id: 'D4',
      title: 'Optimistic update rolls back',
      query: 'failNext=1',
      steps: ['Click on the "Edit" located to the right of "Plan sprint"', 'Enter Plan sprint 42 in the "Title" field', 'Click on "Save changes"', 'Wait until the text "Could not save – changes reverted" is present on the current page'],
      expected: 'The new title shows briefly, then reverts to "Plan sprint"; state.lastAction = "rollback" and state.error = "Could not save – changes reverted".',
    },
    {
      id: 'D5',
      title: 'Bulk delete',
      steps: ['Check the checkbox "Select all"', 'Click on "Delete selected"', 'Click on "Confirm delete"', 'Verify that the current page displays text "No tasks yet"'],
      expected: 'state.tasks = [] and state.lastAction = "bulk-delete".',
    },
  ],
}

type Priority = 'Low' | 'Medium' | 'High'
interface Task {
  id: string
  title: string
  priority: Priority
  due: string
}
const SEED: Omit<Task, 'id'>[] = [
  { title: 'Write release notes', priority: 'Medium', due: '2026-10-20' },
  { title: 'Fix login bug', priority: 'High', due: '2026-10-12' },
  { title: 'Plan sprint', priority: 'Low', due: '2026-10-15' },
]
const ROLLBACK_MSG = 'Could not save – changes reverted'

export default function CrudPage() {
  const t = useTraps('crud')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const [params] = useSearchParams()
  const failNext = useRef(params.get('failNext') === '1')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; task?: Task } | null>(null)
  const [draft, setDraft] = useState({ title: '', priority: 'Medium' as Priority, due: '' })
  const [draftError, setDraftError] = useState('')
  const [inline, setInline] = useState<{ id: string; value: string } | null>(null)
  const [confirm, setConfirm] = useState<{ ids: string[] } | null>(null)
  const [snack, setSnack] = useState<{ removed: Task[] } | null>(null)
  const snackTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [selected, setSelected] = useState<string[]>([])
  const savePersistBug = config.bugs.includes('savePersist')

  const publish = useCallback(
    (list: Task[], lastAction?: string, extra?: Record<string, unknown>) => {
      merge({ tasks: list.map(({ id, title, priority, due }) => ({ id, title, priority, due })), count: list.length, ...(lastAction ? { lastAction } : {}), ...(extra ?? {}) })
    },
    [merge],
  )

  const seeding = useRef<Promise<void> | null>(null)
  const load = useCallback(async () => {
    // StrictMode runs effects twice: share one in-flight load so the seed rows are created once
    if (seeding.current) return seeding.current
    seeding.current = (async () => {
    let rows = await backend.list(config.ns, 'tasks')
    const seededKey = nsKey(config, 'tasks_seeded')
    if (!rows.length && !localStorage.getItem(seededKey)) {
      for (const s of SEED) await backend.create(config.ns, 'tasks', { ...s })
      localStorage.setItem(seededKey, '1')
      rows = await backend.list(config.ns, 'tasks')
    }
    const list = rows.map((r) => ({ id: r.id, ...(r.data as Omit<Task, 'id'>) }))
    setTasks(list)
    setLoaded(true)
    publish(list, undefined, { loaded: true })
    })().finally(() => {
      seeding.current = null
    })
    return seeding.current
  }, [config, publish])

  useEffect(() => {
    void load()
  }, [load])
  useResetListener(config.ns, () => {
    setTasks([])
    setSelected([])
    publish([], 'reset')
  })

  /** optimistic update: show the change at once, roll back if the "server" fails */
  const saveTask = async (id: string, patch: Partial<Task>, action: string) => {
    const before = tasks
    const next = tasks.map((x) => (x.id === id ? { ...x, ...patch } : x))
    setTasks(next)
    setError(null)
    publish(next, action, { pending: true })
    try {
      if (failNext.current) {
        failNext.current = false
        await new Promise((r) => setTimeout(r, 600))
        throw new Error('simulated')
      }
      if (!savePersistBug) await backend.update(config.ns, 'tasks', id, patch)
      toast('Saved', { tone: 'success' })
      publish(next, action, { pending: false, error: null })
    } catch {
      setTasks(before)
      setError(ROLLBACK_MSG)
      publish(before, 'rollback', { pending: false, error: ROLLBACK_MSG })
    }
  }

  const openCreate = () => {
    setDraft({ title: '', priority: 'Medium', due: '' })
    setDraftError('')
    setModal({ mode: 'create' })
  }
  const openEdit = (task: Task) => {
    setDraft({ title: task.title, priority: task.priority, due: task.due })
    setDraftError('')
    setModal({ mode: 'edit', task })
  }
  const submitModal = async () => {
    if (!draft.title.trim()) {
      setDraftError('Enter a title')
      return
    }
    const m = modal
    setModal(null)
    if (m?.mode === 'edit' && m.task) {
      await saveTask(m.task.id, { title: draft.title.trim(), priority: draft.priority, due: draft.due }, 'edit')
      return
    }
    try {
      if (config.bugs.includes('api500')) throw new Error('500')
      const data = { title: draft.title.trim(), priority: draft.priority, due: draft.due }
      const row = savePersistBug ? { id: `tmp-${tasks.length + 1}` } : await backend.create(config.ns, 'tasks', data)
      const next = [...tasks, { id: row.id, ...data }]
      setTasks(next)
      toast('Task created', { tone: 'success' })
      publish(next, 'create')
    } catch {
      setError('Could not create task (server error 500)')
      publish(tasks, 'create-failed', { error: 'Could not create task (server error 500)' })
    }
  }

  const doDelete = async (ids: string[]) => {
    const removed = tasks.filter((x) => ids.includes(x.id))
    const next = tasks.filter((x) => !ids.includes(x.id))
    setTasks(next)
    setSelected([])
    setConfirm(null)
    publish(next, ids.length > 1 ? 'bulk-delete' : 'delete', { deleted: removed.map((r) => r.title) })
    for (const id of ids) await backend.remove(config.ns, 'tasks', id)
    if (snackTimer.current) clearTimeout(snackTimer.current)
    setSnack({ removed })
    snackTimer.current = setTimeout(() => setSnack(null), 5000)
  }
  const undo = async () => {
    if (!snack) return
    if (snackTimer.current) clearTimeout(snackTimer.current)
    const restored: Task[] = []
    for (const r of snack.removed) {
      const { id: _old, ...data } = r
      void _old
      const row = await backend.create(config.ns, 'tasks', data)
      restored.push({ ...r, id: row.id })
    }
    setSnack(null)
    const next = [...tasksRef.current, ...restored]
    setTasks(next)
    publish(next, 'undo')
  }

  const tasksRef = useRef(tasks)
  tasksRef.current = tasks
  const allSelected = tasks.length > 0 && selected.length === tasks.length

  return (
    <>
      <Card title="Tasks">
        <LocalHint />
        <div data-ui="inline" style={{ marginBottom: 8 }}>
          <button id={t.id('new-task')} className={t.cls('tasks__new')} data-variant="primary" onClick={openCreate}>
            {t.v('New task', 'Add task')}
          </button>
          <label data-ui="inline" htmlFor={t.id('select-all')}>
            <input
              id={t.id('select-all')}
              type="checkbox"
              checked={allSelected}
              disabled={!tasks.length}
              onChange={(e) => {
                const next = e.target.checked ? tasks.map((x) => x.id) : []
                setSelected(next)
                merge({ selected: next.length })
              }}
            />
            Select all
          </label>
          <button id={t.id('bulk-delete')} className={t.cls('tasks__bulk')} data-variant="danger" disabled={!selected.length} onClick={() => setConfirm({ ids: selected })}>
            Delete selected ({selected.length})
          </button>
        </div>
        {error ? (
          <p role="alert" data-ui="error" data-testid="crud-error">
            {error}
          </p>
        ) : null}
        {!loaded ? <p data-ui="hint">Loading…</p> : null}
        {loaded && !tasks.length ? <p data-testid="empty-tasks">No tasks yet</p> : null}
        {tasks.length ? (
          <table aria-label="Tasks">
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>
                    Selected
                  </span>
                </th>
                <th>Title</th>
                <th>{t.v('Priority', 'Importance')}</th>
                <th>Due</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} data-testid={`task-row-${task.title}`}>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Select ${task.title}`}
                      checked={selected.includes(task.id)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...selected, task.id] : selected.filter((s) => s !== task.id)
                        setSelected(next)
                        merge({ selected: next.length })
                      }}
                    />
                  </td>
                  <td onDoubleClick={() => setInline({ id: task.id, value: task.title })} title="Double-click to edit">
                    {inline?.id === task.id ? (
                      <input
                        autoFocus
                        aria-label="Edit title"
                        className={t.cls('tasks__inline')}
                        value={inline.value}
                        onChange={(e) => setInline({ id: task.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && inline.value.trim()) {
                            setInline(null)
                            void saveTask(task.id, { title: inline.value.trim() }, 'inline-edit')
                          } else if (e.key === 'Escape') {
                            setInline(null)
                            merge({ lastAction: 'inline-cancel' })
                          }
                        }}
                        onBlur={() => setInline(null)}
                      />
                    ) : (
                      <span data-testid="task-title">{task.title}</span>
                    )}
                  </td>
                  <td>
                    <Badge tone={task.priority === 'High' ? 'danger' : task.priority === 'Medium' ? 'warning' : 'info'}>{task.priority}</Badge>
                  </td>
                  <td>{task.due || '—'}</td>
                  <td>
                    <div data-ui="inline">
                      <button className={t.cls('tasks__edit')} onClick={() => openEdit(task)}>
                        Edit
                      </button>
                      <button className={t.cls('tasks__delete')} onClick={() => setConfirm({ ids: [task.id] })}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <p data-ui="hint">Double-click a title to edit it in place (Enter saves, Esc cancels). Add ?failNext=1 to make the next save fail.</p>
      </Card>

      <Modal open={!!modal} title={modal?.mode === 'edit' ? 'Edit task' : 'New task'} labelledBy="task-modal-title" onClose={() => setModal(null)}>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submitModal()
          }}
        >
          <div data-ui="field">
            <label htmlFor={t.id('task-title')} style={{ fontWeight: 600 }}>
              Title
            </label>
            <input id={t.id('task-title')} autoFocus value={draft.title} onChange={(e) => (setDraft({ ...draft, title: e.target.value }), setDraftError(''))} />
            {draftError ? (
              <span data-ui="error" role="alert">
                {draftError}
              </span>
            ) : null}
          </div>
          <div data-ui="field">
            <label htmlFor={t.id('task-priority')} style={{ fontWeight: 600 }}>
              Priority
            </label>
            <select id={t.id('task-priority')} value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: e.target.value as Priority })}>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <div data-ui="field">
            <label htmlFor={t.id('task-due')} style={{ fontWeight: 600 }}>
              Due date
            </label>
            <input id={t.id('task-due')} type="date" value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} />
          </div>
          <div data-ui="inline">
            <button type="submit" data-variant="primary" id={t.id('task-submit')}>
              {modal?.mode === 'edit' ? t.v('Save changes', 'Update task') : 'Create task'}
            </button>
            <button type="button" onClick={() => setModal(null)}>
              Cancel
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={!!confirm} title={confirm && confirm.ids.length > 1 ? `Delete ${confirm.ids.length} tasks?` : 'Delete task?'} labelledBy="delete-modal-title" onClose={() => setConfirm(null)}>
        <p>This removes the task from the list.</p>
        <div data-ui="inline">
          <button data-variant="danger" id={t.id('confirm-delete')} onClick={() => confirm && void doDelete(confirm.ids)}>
            Confirm delete
          </button>
          <button onClick={() => setConfirm(null)}>Keep task</button>
        </div>
      </Modal>

      {snack ? (
        <div role="status" data-testid="undo-snackbar" style={{ position: 'fixed', left: 16, bottom: 16, zIndex: 960, background: '#111827', color: '#fff', padding: '8px 12px', borderRadius: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
          {snack.removed.length > 1 ? `${snack.removed.length} tasks deleted` : 'Task deleted'}
          <button onClick={() => void undo()} style={{ background: 'transparent', color: '#fff' }}>
            Undo
          </button>
        </div>
      ) : null}
    </>
  )
}
