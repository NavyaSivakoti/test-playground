import { useState } from 'react'
import { fileInfo } from '../../../components/ui'
import { useTraps } from '../../../core/playground'
import type { PageMeta } from '../../../core/registry'
import { postToParent } from '../shared'

export const meta: PageMeta = {
  path: '/embed/upload-frame',
  title: 'Upload frame (embedded)',
  group: 'Scenarios',
  summary: 'Bare page loaded inside an iframe on the uploads page.',
  hidden: true,
  bare: true,
}

export default function UploadFramePage() {
  const t = useTraps('upload-frame')
  const [got, setGot] = useState<string | null>(null)
  return (
    <div style={{ padding: 12, fontFamily: 'inherit' }}>
      <label data-ui="field">
        <span>{t.v('Framed file', 'File inside frame')}</span>
        <input
          type="file"
          id={t.id(t.v('framed-file', 'frame-file-input'))}
          data-testid={t.v('framed-file', 'frame-file-input')}
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (!f) return
            const info = await fileInfo(f)
            setGot(`${info.name} (${info.size} bytes)`)
            postToParent({ frame: 'upload-frame', type: 'upload', file: info })
          }}
        />
      </label>
      {got ? <div data-testid="framed-received">Received {got}</div> : null}
    </div>
  )
}
