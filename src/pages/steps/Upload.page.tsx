import { Card, fileInfo, useToast } from '../../components/ui'
import { useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/upload',
  title: 'File upload',
  group: 'Step baselines',
  summary: 'Two plain file inputs addressed by CSS id: one records the received file, the other also shows a short-lived toast about a second after the file arrives.',
  covers: [547, 672],
  order: 24,
  samples: [
    {
      id: 'U1',
      title: 'Upload from URL',
      steps: ['Navigate to <base>/steps/upload/', 'Upload the file at "#file-plain" from URL <base>fixtures/sample.csv with name sample.csv', 'Verify that the current page displays text "sample.csv"'],
      expected: 'state.files.plain = { name: "sample.csv", size, type, sha256 } of the real fixture.',
    },
    {
      id: 'U2',
      title: 'Upload and verify the toast',
      steps: ['Upload the file at "#file-toast" from URL <base>fixtures/notes.txt with name notes.txt and verify that the toaster "Upload complete" is visible within 5 seconds.'],
      expected: 'Passes; the toast appears ~1 s after the upload and stays 3 s. state.files.toast.name = "notes.txt".',
    },
    {
      id: 'U3',
      title: 'Toast window is short',
      steps: ['Upload the file at "#file-toast" from URL <base>fixtures/notes.txt with name notes.txt', 'Wait for 6 seconds', 'Verify that the current page displays text "Upload complete"'],
      expected: 'Fails: the toast has gone after ~4 s. A step that "passes" here is a false positive.',
    },
    {
      id: 'U4',
      title: 'Wrong toast wording bug',
      query: 'bugs=toastText',
      steps: ['Upload the file at "#file-toast" from URL <base>fixtures/notes.txt with name notes.txt and verify that the toaster "Upload complete" is visible within 5 seconds.'],
      expected: 'Fails: the toast says "Upload finished".',
    },
  ],
}

type Info = Awaited<ReturnType<typeof fileInfo>>

export default function UploadPage() {
  const t = useTraps('upload')
  const config = useConfig()
  const toast = useToast()
  const { state, merge } = usePageState()
  const files = (state.files as Record<string, Info>) ?? {}

  const record = async (slot: 'plain' | 'toast', list: FileList | null) => {
    const f = list?.[0]
    if (!f) return
    const info = await fileInfo(f)
    merge({ files: { ...((state.files as Record<string, Info>) ?? {}), ...files, [slot]: info } })
    if (slot === 'toast') {
      toast(config.bugs.includes('toastText') ? 'Upload finished' : 'Upload complete', { tone: 'success', delayMs: 1000, ms: 3000 })
    }
  }

  const summary = (i?: Info) =>
    i ? (
      <p data-testid="file-summary">
        Received <strong>{i.name}</strong> ({i.size} bytes, {i.type}) sha256 <code>{i.sha256.slice(0, 16)}…</code>
      </p>
    ) : (
      <p data-ui="hint">No file yet.</p>
    )

  const plain = (
    <Card title={t.v('Plain upload', 'Upload a file')}>
      <label data-ui="field">
        <span>{t.v('Plain file', 'Choose a plain file')}</span>
        <input type="file" id={t.id('file-plain')} className={t.cls('file file--plain')} data-testid="file-plain" onChange={(e) => void record('plain', e.target.files)} />
      </label>
      {summary(files.plain)}
    </Card>
  )
  const withToast = (
    <Card title="Upload with toast">
      <label data-ui="field">
        <span>File with toast</span>
        <input type="file" id={t.id('file-toast')} className={t.cls('file file--toast')} data-testid="file-toast" onChange={(e) => void record('toast', e.target.files)} />
      </label>
      <p data-ui="hint">A toast appears about 1 second after the file is received and stays for 3 seconds.</p>
      {summary(files.toast)}
    </Card>
  )

  return t.v(
    <>
      {plain}
      {withToast}
    </>,
    <div data-wrapper="upload-v2">
      {withToast}
      {plain}
    </div>,
  )
}
