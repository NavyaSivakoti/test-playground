import { useEffect, useState } from 'react'
import { Badge, Card, publicUrl } from '../../components/ui'
import { usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'

export const meta: PageMeta = {
  path: '/steps/extension',
  title: 'Browser extension',
  group: 'Step baselines',
  summary: 'A tiny test extension that marks every page it runs on. This page tells you whether the extension is loaded in the current browser.',
  covers: [540, 542],
  order: 26,
  samples: [
    {
      id: 'E1',
      title: 'Upload the test extension',
      steps: ['Upload the extension', 'Navigate to <base>/steps/extension/', 'Verify that the current page displays text "Extension detected"'],
      expected: 'Banner "Test extension active" at the top; state.extension = "active".',
    },
    {
      id: 'E2',
      title: 'Download the extension from a URL',
      steps: ['Download the extension from URL <base>fixtures/extension/test-extension.zip', 'Navigate to <base>/steps/extension/', 'Verify that the current page displays text "Test extension active"'],
      expected: 'Same banner; state.extension = "active".',
    },
    {
      id: 'E3',
      title: 'Without the extension',
      steps: ['Navigate to <base>/steps/extension/', 'Verify that the current page displays text "Extension not detected"'],
      expected: 'state.extension = "none".',
    },
  ],
}

export default function ExtensionPage() {
  const t = useTraps('extension')
  const { merge } = usePageState()
  const [active, setActive] = useState(false)

  useEffect(() => {
    const check = () => {
      const on = document.documentElement.dataset.tpExtension === 'active'
      setActive(on)
      merge({ extension: on ? 'active' : 'none' })
    }
    const first = setTimeout(check, 0)
    const timer = setInterval(check, 500)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [merge])

  const status = (
    <p data-testid="extension-status" id={t.id('extension-status')}>
      {active ? <Badge tone="success">Extension detected</Badge> : <Badge tone="warning">Extension not detected</Badge>}
    </p>
  )

  return (
    <>
      <Card title={t.v('Status', 'Extension status')}>
        {status}
        <p data-ui="hint">Checked every half second via the data-tp-extension attribute on the html element.</p>
      </Card>
      <Card title="The test extension">
        <p>
          <a id={t.id(t.v('extension-zip', 'extension-download'))} className={t.cls('link link--zip')} href={publicUrl('fixtures/extension/test-extension.zip')} download>
            {t.v('test-extension.zip', 'Download test-extension.zip')}
          </a>
        </p>
        <p>A Manifest V3 content-script extension with two files. On every page it:</p>
        <ul>
          <li>adds a small “Test extension active” banner at the top centre;</li>
          <li>sets <code>data-tp-extension="active"</code> on the html element.</li>
        </ul>
        <p data-ui="hint">It requests no permissions and reads no data. Load it with the platform's extension steps, or unpacked in a local browser.</p>
      </Card>
    </>
  )
}
