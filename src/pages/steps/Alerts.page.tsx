import { useEffect, useState } from 'react'
import { Card } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/alerts',
  title: 'Alerts, confirms and prompts',
  group: 'Step baselines',
  summary: 'Native browser dialogs: a plain alert, an OK/Cancel confirm, a text prompt, a delayed alert and a leave-page warning.',
  covers: [103, 110, 147, 148, 410],
  order: 20,
  samples: [
    {
      id: 'A1',
      title: 'No alert before any click',
      steps: ['Navigate to <base>/steps/alerts/', 'Verify that the Alert is not present'],
      expected: 'Passes; state.alerts is unset.',
    },
    {
      id: 'A2',
      title: 'Verify the alert text',
      steps: ['Click on "Show alert"', 'Verify that an Alert with notification "Profile saved" is displayed', 'Click OK button in the alert'],
      expected: 'state.alerts = 1 and state.lastDialog = "alert".',
    },
    {
      id: 'A3',
      title: 'Accept a confirm',
      steps: ['Click on "Show confirm"', 'Click OK button in the alert', 'Verify that the current page displays text "Confirm result: OK"'],
      expected: 'state.confirm = true.',
    },
    {
      id: 'A4',
      title: 'Dismiss a confirm',
      steps: ['Click on "Show confirm"', 'Click on Cancel button in the alert', 'Verify that the current page displays text "Confirm result: Cancel"'],
      expected: 'state.confirm = false.',
    },
    {
      id: 'A5',
      title: 'Delayed alert',
      steps: ['Click on "Show alert in 1s"', 'Verify that the current page displays an Alert', 'Click OK button in the alert'],
      expected: 'Passes when the step waits at least 1 s; state.delayedAlert = true.',
    },
    {
      id: 'A6',
      title: 'Prompt value',
      steps: ['Click on "Show prompt"', 'Click OK button in the alert'],
      expected: 'state.promptValue = "Ada" (the default text) or the text the step typed into the prompt.',
    },
  ],
}

export default function AlertsPage() {
  const t = useTraps('alerts')
  const { state, merge } = usePageState()
  const [warn, setWarn] = useState(false)
  const [pending, setPending] = useState(false)
  const alerts = (state.alerts as number) ?? 0

  useEffect(() => {
    if (!warn) return
    const onBefore = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
      return ''
    }
    window.addEventListener('beforeunload', onBefore)
    return () => window.removeEventListener('beforeunload', onBefore)
  }, [warn])

  const showAlert = (
    <button
      id={t.id(t.v('show-alert', 'show-alert-v2'))}
      className={t.cls('btn btn--alert')}
      data-testid={t.v('show-alert', 'alert-open')}
      onClick={() => {
        window.alert('Profile saved')
        merge({ alerts: alerts + 1, lastDialog: 'alert' })
      }}
    >
      Show alert
    </button>
  )
  const showConfirm = (
    <button
      id={t.id('show-confirm')}
      className={t.cls('btn btn--confirm')}
      data-testid="show-confirm"
      onClick={() => {
        const ok = window.confirm('Delete the draft?')
        merge({ confirm: ok, lastDialog: 'confirm' })
      }}
    >
      Show confirm
    </button>
  )

  return (
    <>
      <Card title="Dialogs">
        <p data-ui="hint">Each button opens a native dialog. The page records what the dialog returned.</p>
        {t.v(
          <div data-ui="inline">
            {showAlert}
            {showConfirm}
          </div>,
          <div data-ui="inline" data-wrapper="dialogs-v2">
            <span data-ui="inline">{showConfirm}</span>
            <span data-ui="inline">{showAlert}</span>
          </div>,
        )}
        {t.dup ? (
          <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: true })}>
            Show alert
          </button>
        ) : null}
        {state.confirm !== undefined ? (
          <p data-testid="confirm-result">Confirm result: {state.confirm ? 'OK' : 'Cancel'}</p>
        ) : null}
      </Card>

      <Card title="Prompt">
        <button
          id={t.id('show-prompt')}
          className={t.cls('btn btn--prompt')}
          onClick={() => {
            const v = window.prompt('What is your first name?', 'Ada')
            merge({ promptValue: v, lastDialog: 'prompt' })
          }}
        >
          {t.v('Show prompt', 'Ask for name')}
        </button>
        {state.promptValue !== undefined ? (
          <p data-testid="prompt-result">Prompt result: {state.promptValue === null ? '(cancelled)' : String(state.promptValue)}</p>
        ) : null}
      </Card>

      <Card title="Delayed alert">
        <button
          id={t.id('show-alert-delayed')}
          className={t.cls('btn btn--delayed')}
          disabled={pending}
          onClick={() => {
            setPending(true)
            setTimeout(() => {
              window.alert('Delayed alert')
              setPending(false)
              merge({ delayedAlert: true, lastDialog: 'alert:delayed' })
            }, 1000)
          }}
        >
          Show alert in 1s
        </button>
        {pending ? <span data-ui="hint"> Alert opens in 1 second…</span> : null}
      </Card>

      <Card title="Leave-page warning">
        <label data-ui="inline">
          <input
            type="checkbox"
            id={t.id('warn-before-leaving')}
            checked={warn}
            onChange={(e) => {
              setWarn(e.target.checked)
              merge({ beforeunload: e.target.checked })
            }}
          />
          {t.v('Warn before leaving', 'Ask before leaving this page')}
        </label>
        <p data-ui="hint">When on, reloading or leaving the page triggers the browser's “Leave site?” dialog (a beforeunload dialog).</p>
      </Card>
    </>
  )
}
