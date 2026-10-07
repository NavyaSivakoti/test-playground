import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Field, Modal, useToast } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { routeUrl, useStateLog } from './business/util'

export const meta: PageMeta = {
  path: '/windows',
  title: 'Tabs, windows and dialogs',
  group: 'Scenarios',
  summary:
    'A report that opens in a new tab and loads late, a popup sign-in window, a confirm-then-prompt deletion chain, stacked modals and an unsaved-changes guard on leaving the page.',
  covers: [34, 12, 541, 145, 172, 544, 464, 147, 148, 110, 410, 103, 54, 26],
  order: 13,
  samples: [
    {
      id: 'W1',
      title: 'Report in a new tab that loads late',
      steps: [
        'Navigate to <base>/windows/',
        'Click on "Open quarterly report" and switch to the new window',
        'Wait until the text "Revenue" is present on the current page',
        'Verify that the current page title is "Quarterly report"',
        'Close the current window',
      ],
      expected: 'The new tab is blank for 2 s, then shows the table. On the opener, state.reportOpened = 1 and state.reportLoaded = true.',
    },
    {
      id: 'W2',
      title: 'Popup sign-in',
      steps: [
        'Click "Sign in with popup" lcoator to open link in popup',
        'Enter viewer@example.com in the "Username" field',
        'Enter Playground!1 in the "Password" field',
        'Click on "Sign in"',
        'Switch to the window titled "Tabs, windows and dialogs | Test Playground"',
        'Verify that the current page displays text "Signed in via popup as viewer@example.com"',
      ],
      expected: 'state.popupLogin = "viewer@example.com"; the popup closes itself.',
    },
    {
      id: 'W3',
      title: 'Confirm then prompt',
      steps: ['Click on "Delete project"', 'Click OK button in the alert', 'Enter DELETE in the prompt and accept it', 'Verify that the current page displays text "Project deleted"'],
      expected: 'Dialogs in order: confirm "Delete project?", prompt "Type DELETE to confirm". state.projectDeleted = true; state.dialogs lists both with their results. Cancelling the confirm leaves projectDeleted = false.',
    },
    {
      id: 'W4',
      title: 'Stacked modals',
      steps: ['Click on "Open settings"', 'Click on "Advanced options"', 'Click on "Apply advanced"', 'Press Esc Key'],
      expected: 'state.modalDepth goes 1 → 2 → 1 → 0; state.advancedApplied = true. Esc closes only the top modal.',
    },
    {
      id: 'W5',
      title: 'Unsaved-changes guard',
      steps: ['Check the checkbox "Warn about unsaved changes"', 'Enter draft text in the "Draft note" field', 'Click on "Leave this page"'],
      expected: 'The browser shows a "Leave site?" beforeunload dialog; state.guard = true and state.dirty = true.',
    },
  ],
}

interface DialogEntry {
  type: 'alert' | 'confirm' | 'prompt'
  message: string
  result: boolean | string | null
}

export default function WindowsPage() {
  const t = useTraps('windows')
  const config = useConfig()
  const { merge } = usePageState()
  const toast = useToast()
  const dialogs = useStateLog<DialogEntry>('dialogs')
  const reports = useRef(0)
  const [reportLoaded, setReportLoaded] = useState(false)
  const [popupUser, setPopupUser] = useState<string | null>(null)
  const [deleted, setDeleted] = useState<boolean | null>(null)
  const [depth, setDepth] = useState(0)
  const [guard, setGuard] = useState(false)
  const [draft, setDraft] = useState('')

  const onChildMessage = useCallback(
    (data: unknown) => {
      const d = data as { type?: string; ns?: string; email?: string } | null
      if (!d || d.ns !== config.ns) return
      if (d.type === 'report-loaded') {
        setReportLoaded(true)
        merge({ reportLoaded: true })
      }
      if (d.type === 'popup-login' && d.email) {
        setPopupUser(d.email)
        merge({ popupLogin: d.email })
        toast(`Signed in as ${d.email}`, { tone: 'success' })
      }
    },
    [config.ns, merge, toast],
  )

  useEffect(() => {
    const onMessage = (e: MessageEvent) => e.origin === window.location.origin && onChildMessage(e.data)
    window.addEventListener('message', onMessage)
    let ch: BroadcastChannel | null = null
    if (typeof BroadcastChannel !== 'undefined') {
      ch = new BroadcastChannel('tp-windows')
      ch.onmessage = (e) => onChildMessage(e.data)
    }
    return () => {
      window.removeEventListener('message', onMessage)
      ch?.close()
    }
  }, [onChildMessage])

  useEffect(() => {
    if (!guard || !draft) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [guard, draft])

  const reportUrl = routeUrl(config, 'windows/report')

  const deleteProject = () => {
    const ok = window.confirm('Delete project?')
    dialogs.append({ type: 'confirm', message: 'Delete project?', result: ok })
    if (!ok) {
      setDeleted(false)
      merge({ projectDeleted: false, lastDialog: 'confirm-cancelled' })
      return
    }
    const typed = window.prompt('Type DELETE to confirm')
    dialogs.append({ type: 'prompt', message: 'Type DELETE to confirm', result: typed })
    if (typed === 'DELETE') {
      setDeleted(true)
      merge({ projectDeleted: true, lastDialog: 'prompt-accepted' })
    } else {
      setDeleted(false)
      window.alert('Deletion cancelled: the text did not match')
      dialogs.append({ type: 'alert', message: 'Deletion cancelled: the text did not match', result: null })
      merge({ projectDeleted: false, lastDialog: 'prompt-mismatch' })
    }
  }

  return (
    <>
      <Card title="New tabs and popups">
        <div data-ui="inline">
          <button
            id={t.id(t.v('open-report', 'report-tab'))}
            className={t.cls('win__report')}
            onClick={() => {
              const w = window.open(reportUrl, '_blank')
              reports.current += 1
              merge({ reportOpened: reports.current, reportBlocked: !w })
            }}
          >
            {t.v('Open quarterly report', 'View quarterly report')}
          </button>
          <a
            href={reportUrl}
            target="_blank"
            rel="opener"
            id={t.id('report-link')}
            onClick={() => {
              reports.current += 1
              merge({ reportOpened: reports.current, via: 'link' })
            }}
          >
            Report link (target=_blank)
          </a>
          <button
            id={t.id(t.v('popup-login', 'login-popup'))}
            className={t.cls('win__popup')}
            onClick={() => {
              const w = window.open(routeUrl(config, 'windows/login'), 'tp-popup-login', 'width=440,height=560')
              merge({ popupOpened: true, popupBlocked: !w })
            }}
          >
            {t.v('Sign in with popup', 'Sign in using a popup')}
          </button>
        </div>
        <p data-ui="hint">The report tab stays blank for 2 seconds before its content appears.</p>
        <p data-testid="report-status">{reportLoaded ? 'Report tab finished loading' : 'Report not loaded yet'}</p>
        {popupUser ? (
          <p role="status" data-testid="popup-user">
            Signed in via popup as {popupUser}
          </p>
        ) : null}
      </Card>

      <Card title="Browser dialogs">
        <div data-ui="inline">
          <button id={t.id('delete-project')} data-variant="danger" onClick={deleteProject}>
            Delete project
          </button>
          <button
            id={t.id('show-alert')}
            onClick={() => {
              window.alert('Heads up: maintenance tonight')
              dialogs.append({ type: 'alert', message: 'Heads up: maintenance tonight', result: null })
              merge({ alertShown: true })
            }}
          >
            {t.v('Show alert', 'Show notice')}
          </button>
        </div>
        {deleted === true ? <p data-testid="project-status">Project deleted</p> : null}
        {deleted === false ? <p data-testid="project-status">Project kept</p> : null}
      </Card>

      <Card title="Stacked modals">
        <button
          id={t.id('open-settings')}
          onClick={() => {
            setDepth(1)
            merge({ modalDepth: 1 })
          }}
        >
          Open settings
        </button>
      </Card>

      <Card title="Unsaved changes">
        <label data-ui="inline">
          <input
            type="checkbox"
            id={t.id('guard')}
            checked={guard}
            onChange={(e) => {
              setGuard(e.target.checked)
              merge({ guard: e.target.checked })
            }}
          />{' '}
          Warn about unsaved changes
        </label>
        <Field label="Draft note">
          <textarea
            id={t.id('draft')}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              merge({ dirty: e.target.value.length > 0 })
            }}
          />
        </Field>
        <a href={routeUrl(config, '')} id={t.id('leave')} data-testid="leave-link">
          Leave this page
        </a>
        <p data-ui="hint">A full page navigation; with the guard on and a draft, the browser asks before leaving.</p>
      </Card>

      <Modal
        open={depth >= 1}
        title="Settings"
        labelledBy="win-settings-title"
        onClose={depth === 1 ? () => (setDepth(0), merge({ modalDepth: 0 })) : undefined}
        data-testid="settings-modal"
      >
        <p>General settings for this project.</p>
        <div data-ui="inline">
          <button
            id={t.id('advanced')}
            onClick={() => {
              setDepth(2)
              merge({ modalDepth: 2 })
            }}
          >
            Advanced options
          </button>
          <button
            id={t.id('close-settings')}
            onClick={() => {
              setDepth(0)
              merge({ modalDepth: 0 })
            }}
          >
            Close settings
          </button>
        </div>
      </Modal>
      <Modal
        open={depth >= 2}
        title="Advanced options"
        labelledBy="win-advanced-title"
        onClose={() => (setDepth(1), merge({ modalDepth: 1 }))}
        data-testid="advanced-modal"
        style={{ zIndex: 960, marginTop: 40 }}
      >
        <p>These options apply to the whole workspace.</p>
        <div data-ui="inline">
          <button
            data-variant="primary"
            id={t.id('apply-advanced')}
            onClick={() => {
              setDepth(1)
              merge({ modalDepth: 1, advancedApplied: true })
              toast('Advanced options applied')
            }}
          >
            {t.v('Apply advanced', 'Apply advanced options')}
          </button>
          <button
            id={t.id('close-advanced')}
            onClick={() => {
              setDepth(1)
              merge({ modalDepth: 1 })
            }}
          >
            Close advanced
          </button>
        </div>
      </Modal>
    </>
  )
}
