import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, Modal, fileInfo, useToast } from '../../components/ui'
import { backend } from '../../core/backend'
import { nowMs, useConfig, usePageState, useTraps } from '../../core/playground'
import type { PageMeta } from '../../core/registry'
import { useSyncedState } from './part2State'
import { useResetListener } from '../../core/reset'

export const meta: PageMeta = {
  path: '/ui/settings',
  title: 'Account settings',
  group: 'General UI',
  summary:
    'A typical account settings screen: profile with avatar crop, password change with validation, a notification preference matrix, language and time zone, and confirmation dialogs for destructive actions. Saved as backend records.',
  order: 12,
  samples: [
    {
      id: 'S1',
      title: 'Edit and save the profile',
      steps: [
        'Navigate to <base>/ui/settings/',
        'Enter Grace Hopper in the "Display name" field',
        'Enter Compiler pioneer in the "Bio" field',
        'Click on "Save profile"',
        'Verify that the current page displays text "Profile saved"',
      ],
      expected: 'state.profile = {displayName:"Grace Hopper", bio:"Compiler pioneer", persisted:true}; a settings record exists (reload shows the same name).',
    },
    {
      id: 'S2',
      title: 'Upload and crop an avatar',
      steps: ['Upload the file at "#avatar-upload" from URL <base>fixtures/avatar.png with name avatar.png', 'Verify that the "Crop preview" is visible'],
      expected: 'state.avatar = {name:"avatar.png", size>0, sha256 (64 hex), crop:{x,y,size}}; dragging the selection changes crop.x/crop.y.',
    },
    {
      id: 'S3',
      title: 'Password mismatch is rejected',
      steps: [
        'Enter Old-pass1 in the "Current password" field',
        'Enter NewPass2026 in the "New password" field',
        'Enter NewPass2027 in the "Confirm new password" field',
        'Click on "Change password"',
        'Verify that the current page displays text "Passwords do not match"',
      ],
      expected: 'state.password.status = "invalid" and errors include "mismatch".',
    },
    {
      id: 'S4',
      title: 'Notification matrix',
      steps: ['Click on "Billing SMS"', 'Click on "Save preferences"'],
      expected: 'state.matrix.Billing.SMS = true and state.preferences.saved = true.',
    },
    {
      id: 'S5',
      title: 'Delete account needs DELETE',
      steps: ['Click on "Delete account"', 'Enter DELETE in the "Type DELETE to confirm" field', 'Click on "Delete permanently"'],
      expected: 'state.account.deleted = true; "Delete permanently" stays disabled for any other text.',
    },
    {
      id: 'S6',
      title: 'Save shows success but does not persist (bug)',
      query: 'bugs=savePersist',
      steps: ['Enter Grace Hopper in the "Display name" field', 'Click on "Save profile"', 'Navigate to <base>/ui/settings/?bugs=savePersist', 'Verify that the "Display name" field has value "Grace Hopper"'],
      expected: 'Fails: the toast says saved but state.profile.persisted = false and the reloaded name is the default.',
    },
  ],
}

const ROWS = ['Comments', 'Mentions', 'Billing', 'Product news'] as const
const COLS = ['Email', 'Push', 'SMS'] as const
type Matrix = Record<string, Record<string, boolean>>
const defaultMatrix = (): Matrix => ({
  Comments: { Email: true, Push: false, SMS: false },
  Mentions: { Email: true, Push: true, SMS: false },
  Billing: { Email: true, Push: false, SMS: false },
  'Product news': { Email: false, Push: false, SMS: false },
})
const LANGUAGES = ['English', 'Deutsch', 'Français', 'Español', 'Português']
const ZONES = ['UTC', 'Europe/Berlin', 'America/New_York', 'Asia/Tokyo', 'Australia/Sydney']
const DEFAULT_NAME = 'Ada Lovelace'

interface Crop {
  x: number
  y: number
  size: number
}

export default function SettingsPage() {
  const t = useTraps('settings')
  const config = useConfig()
  const { state, merge } = usePageState()
  const toast = useToast()

  const [recordId, setRecordId] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(DEFAULT_NAME)
  const [bio, setBio] = useState('')
  const [matrix, setMatrix] = useState<Matrix>(defaultMatrix)
  const [language, setLanguage] = useState('English')
  const [zone, setZone] = useState('UTC')

  const load = useCallback(async () => {
    const rows = await backend.list(config.ns, 'settings')
    const row = rows[rows.length - 1]
    if (row) {
      setRecordId(row.id)
      const d = row.data as Record<string, unknown>
      if (typeof d.displayName === 'string') setDisplayName(d.displayName)
      if (typeof d.bio === 'string') setBio(d.bio)
      if (d.matrix) setMatrix(d.matrix as Matrix)
      if (typeof d.language === 'string') setLanguage(d.language)
      if (typeof d.timeZone === 'string') setZone(d.timeZone)
    } else {
      setRecordId(null)
      setDisplayName(DEFAULT_NAME)
      setBio('')
      setMatrix(defaultMatrix())
      setLanguage('English')
      setZone('UTC')
    }
    merge({ loaded: { records: rows.length, displayName: row ? (row.data as Record<string, unknown>).displayName ?? DEFAULT_NAME : DEFAULT_NAME } })
  }, [config.ns, merge])
  useEffect(() => {
    void load()
  }, [load])
  useResetListener(config.ns, load)

  const persist = async (patch: Record<string, unknown>): Promise<{ id: string | null; persisted: boolean }> => {
    if (config.bugs.includes('savePersist')) return { id: recordId, persisted: false }
    if (recordId) {
      const row = await backend.update(config.ns, 'settings', recordId, patch)
      return { id: row.id, persisted: true }
    }
    const row = await backend.create(config.ns, 'settings', patch)
    setRecordId(row.id)
    return { id: row.id, persisted: true }
  }

  // ---------- avatar ----------
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [crop, setCrop] = useState<Crop | null>(null)
  const avatarInfo = useRef<Record<string, unknown> | null>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const DISPLAY = 240
  const scale = img ? Math.min(1, DISPLAY / Math.max(img.naturalWidth, img.naturalHeight)) : 1
  const onAvatar = async (file: File | undefined) => {
    if (!file) return
    const info = await fileInfo(file)
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      const size = Math.floor(Math.min(image.naturalWidth, image.naturalHeight) * 0.6)
      const c = { x: Math.floor((image.naturalWidth - size) / 2), y: Math.floor((image.naturalHeight - size) / 2), size }
      avatarInfo.current = { name: info.name, size: info.size, sha256: info.sha256, width: image.naturalWidth, height: image.naturalHeight }
      setImg(image)
      setCrop(c)
    }
    image.onerror = () => merge({ avatar: { name: info.name, size: info.size, sha256: info.sha256, error: 'not an image' } })
    image.src = url
  }
  useEffect(() => {
    if (!img || !crop) return
    const cv = previewRef.current
    const ctx = cv?.getContext('2d')
    if (cv && ctx) {
      ctx.clearRect(0, 0, cv.width, cv.height)
      ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, cv.width, cv.height)
    }
    merge({ avatar: { ...avatarInfo.current, crop } })
  }, [img, crop, merge])
  const clampCrop = (c: Crop): Crop => {
    if (!img) return c
    const size = Math.max(16, Math.min(c.size, img.naturalWidth, img.naturalHeight))
    return {
      size,
      x: Math.round(Math.max(0, Math.min(img.naturalWidth - size, c.x))),
      y: Math.round(Math.max(0, Math.min(img.naturalHeight - size, c.y))),
    }
  }
  const drag = useRef<{ px: number; py: number; cx: number; cy: number } | null>(null)

  // ---------- password ----------
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' })
  const [pwErrors, setPwErrors] = useState<Record<string, string>>({})
  const changePassword = () => {
    const errs: Record<string, string> = {}
    if (!pw.current) errs.current = 'Enter your current password'
    if (pw.next.length < 8) errs.next = 'Use at least 8 characters'
    else if (!/[A-Z]/.test(pw.next) || !/\d/.test(pw.next)) errs.next = 'Include an uppercase letter and a digit'
    else if (pw.next === pw.current) errs.next = 'New password must differ from the current one'
    if (pw.confirm !== pw.next) errs.confirm = 'Passwords do not match'
    setPwErrors(errs)
    const codes = Object.entries(errs).map(([k, v]) => (k === 'confirm' ? 'mismatch' : k === 'current' ? 'currentRequired' : v.startsWith('Use') ? 'tooShort' : v.startsWith('Include') ? 'weak' : 'sameAsCurrent'))
    if (codes.length) merge({ password: { status: 'invalid', errors: codes } })
    else {
      merge({ password: { status: 'changed', errors: [], length: pw.next.length } })
      setPw({ current: '', next: '', confirm: '' })
      toast('Password changed', { tone: 'success' })
    }
  }

  // ---------- dialogs ----------
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteText, setDeleteText] = useState('')

  useSyncedState({ matrix, language, timeZone: zone })

  const zoneTime = (() => {
    try {
      return new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format(new Date(nowMs(config)))
    } catch {
      return '--:--'
    }
  })()

  const cols = t.v([...COLS], ['Push', 'Email', 'SMS'])
  const account = state.account as { deleted?: boolean } | undefined

  return (
    <>
      {account?.deleted ? (
        <div data-ui="card" data-tone="danger" role="status" data-testid="account-deleted">
          Account scheduled for deletion.
        </div>
      ) : null}

      <Card title="Profile">
        <div data-ui="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <div>
            <label data-ui="field">
              <span>{t.v('Display name', 'Public name')}</span>
              <input id={t.id('display-name')} data-testid="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>
            <label data-ui="field">
              <span>Bio</span>
              <textarea id={t.id('bio')} rows={3} value={bio} maxLength={160} onChange={(e) => setBio(e.target.value)} />
              <span data-ui="hint">{bio.length}/160</span>
            </label>
            <label data-ui="field">
              <span>Avatar</span>
              <input id="avatar-upload" data-testid="avatar-upload" type="file" accept="image/*" onChange={(e) => void onAvatar(e.target.files?.[0])} />
            </label>
          </div>
          <div>
            {img && crop ? (
              <>
                <p data-ui="hint">Drag the square (or focus it and use the arrow keys) to choose the crop.</p>
                <div style={{ position: 'relative', width: img.naturalWidth * scale, height: img.naturalHeight * scale, userSelect: 'none', touchAction: 'none' }}>
                  <img src={img.src} alt="Uploaded avatar" width={img.naturalWidth * scale} height={img.naturalHeight * scale} draggable={false} style={{ display: 'block' }} />
                  <div
                    role="slider"
                    tabIndex={0}
                    aria-label="Crop selection"
                    aria-valuetext={`x ${crop.x}, y ${crop.y}, size ${crop.size}`}
                    data-testid="crop-selection"
                    id={t.id('crop-selection')}
                    style={{
                      position: 'absolute',
                      left: crop.x * scale,
                      top: crop.y * scale,
                      width: crop.size * scale,
                      height: crop.size * scale,
                      border: '2px solid #fff',
                      boxShadow: '0 0 0 9999px rgba(0,0,0,.45)',
                      cursor: 'move',
                    }}
                    onPointerDown={(e) => {
                      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
                      drag.current = { px: e.clientX, py: e.clientY, cx: crop.x, cy: crop.y }
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current
                      if (!d) return
                      setCrop(clampCrop({ size: crop.size, x: d.cx + (e.clientX - d.px) / scale, y: d.cy + (e.clientY - d.py) / scale }))
                    }}
                    onPointerUp={() => {
                      drag.current = null
                    }}
                    onKeyDown={(e) => {
                      const step = 10
                      const m: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }
                      const mv = m[e.key]
                      if (!mv) return
                      e.preventDefault()
                      setCrop(clampCrop({ ...crop, x: crop.x + mv[0], y: crop.y + mv[1] }))
                    }}
                  />
                </div>
                <label data-ui="field" style={{ maxWidth: 240 }}>
                  <span>Crop size</span>
                  <input
                    type="range"
                    id={t.id('crop-size')}
                    min={16}
                    max={Math.min(img.naturalWidth, img.naturalHeight)}
                    value={crop.size}
                    onChange={(e) => setCrop(clampCrop({ ...crop, size: Number(e.target.value) }))}
                  />
                </label>
                <div>
                  <span>Crop preview</span>
                  <canvas ref={previewRef} width={96} height={96} aria-label="Crop preview" role="img" data-testid="crop-preview" style={{ display: 'block', borderRadius: '50%', border: '1px solid currentColor' }} />
                </div>
              </>
            ) : (
              <p data-ui="hint">No avatar uploaded yet.</p>
            )}
          </div>
        </div>
        <div data-ui="inline" style={{ marginTop: 8 }}>
          <button
            id={t.id(t.v('save-profile', 'update-profile'))}
            className={t.cls('btn btn--save-profile')}
            data-variant="primary"
            data-testid="save-profile"
            onClick={async () => {
              const name = displayName.trim()
              if (!name) {
                merge({ profile: { error: 'Display name is required' } })
                return
              }
              const r = await persist({ displayName: name, bio, avatar: crop ? { ...avatarInfo.current, crop } : null })
              merge({ profile: { displayName: name, bio, persisted: r.persisted, recordId: r.id } })
              toast('Profile saved', { tone: 'success' })
            }}
          >
            {t.v('Save profile', 'Update profile')}
          </button>
          {(state.profile as { error?: string } | undefined)?.error ? <span data-ui="error">{(state.profile as { error: string }).error}</span> : null}
          {(state.profile as { displayName?: string } | undefined)?.displayName ? <span role="status">Profile saved</span> : null}
          {t.dup ? (
            <button className={t.cls('btn btn--decoy')} style={{ opacity: 0.6 }} onClick={() => merge({ decoy: 'Save profile' })}>
              {t.v('Save profile', 'Update profile')}
            </button>
          ) : null}
        </div>
      </Card>

      <Card title="Change password">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            changePassword()
          }}
          style={{ maxWidth: 360 }}
        >
          {(
            [
              ['current', 'Current password', 'current-password'],
              ['next', 'New password', 'new-password'],
              ['confirm', 'Confirm new password', 'new-password'],
            ] as const
          ).map(([key, label, ac]) => (
            <label data-ui="field" key={key}>
              <span>{label}</span>
              <input
                type="password"
                autoComplete={ac}
                id={t.id(`pw-${key}`)}
                value={pw[key]}
                aria-invalid={!!pwErrors[key]}
                onChange={(e) => setPw({ ...pw, [key]: e.target.value })}
              />
              {pwErrors[key] ? (
                <span data-ui="error" role="alert">
                  {pwErrors[key]}
                </span>
              ) : null}
            </label>
          ))}
          <p data-ui="hint">At least 8 characters, one uppercase letter and one digit.</p>
          <button type="submit" id={t.id('change-password')} className={t.cls('btn btn--password')}>
            Change password
          </button>
          {(state.password as { status?: string } | undefined)?.status === 'changed' ? <span role="status"> Password updated</span> : null}
        </form>
      </Card>

      <Card title="Notification preferences">
        <table data-testid="notification-matrix" style={{ maxWidth: 480 }}>
          <thead>
            <tr>
              <th scope="col">Topic</th>
              {cols.map((c) => (
                <th scope="col" key={c}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r}>
                <th scope="row" style={{ textAlign: 'left' }}>
                  {r}
                </th>
                {cols.map((c) => (
                  <td key={c} style={{ textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      aria-label={`${r} ${c}`}
                      id={t.id(`pref-${r.replace(/\s+/g, '-').toLowerCase()}-${c.toLowerCase()}`)}
                      checked={matrix[r]?.[c] ?? false}
                      onChange={(e) => setMatrix({ ...matrix, [r]: { ...matrix[r], [c]: e.target.checked } })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div data-ui="inline" style={{ marginTop: 12, alignItems: 'flex-end' }}>
          <label data-ui="field">
            <span>Language</span>
            <select id={t.id('language')} value={language} onChange={(e) => setLanguage(e.target.value)}>
              {LANGUAGES.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label data-ui="field">
            <span>Time zone</span>
            <select id={t.id('time-zone')} value={zone} onChange={(e) => setZone(e.target.value)}>
              {ZONES.map((z) => (
                <option key={z}>{z}</option>
              ))}
            </select>
          </label>
          <span data-testid="zone-time">Local time: {zoneTime}</span>
        </div>
        <div data-ui="inline" style={{ marginTop: 8 }}>
          <button
            id={t.id('save-preferences')}
            className={t.cls('btn btn--save-prefs')}
            data-variant="primary"
            onClick={async () => {
              const r = await persist({ matrix, language, timeZone: zone })
              merge({ preferences: { saved: true, persisted: r.persisted, recordId: r.id } })
              toast('Preferences saved', { tone: 'success' })
            }}
          >
            Save preferences
          </button>
          <button id={t.id('reset-preferences')} className={t.cls('btn btn--reset-prefs')} onClick={() => setResetStep(1)}>
            {t.v('Reset preferences', 'Restore defaults')}
          </button>
        </div>
      </Card>

      <Card title="Danger zone" data-tone="danger">
        <p>Deleting your account removes all profiles and preferences in this namespace.</p>
        <button id={t.id('delete-account')} className={t.cls('btn btn--delete')} data-variant="danger" onClick={() => {
          setDeleteText('')
          setDeleteOpen(true)
          merge({ account: { ...(account ?? {}), dialogOpened: true } })
        }}>
          Delete account
        </button>
      </Card>

      <Modal open={resetStep === 1} title="Are you sure?" labelledBy="reset-step-1" onClose={() => setResetStep(0)} data-testid="reset-dialog-1">
        <p>All notification preferences, the language and the time zone go back to their defaults.</p>
        <div data-ui="inline">
          <button data-variant="primary" onClick={() => setResetStep(2)}>
            Continue
          </button>
          <button
            onClick={() => {
              setResetStep(0)
              merge({ preferencesReset: 'cancelled-step-1' })
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
      <Modal open={resetStep === 2} title="Really reset everything?" labelledBy="reset-step-2" onClose={() => setResetStep(0)} data-testid="reset-dialog-2">
        <p>This is the last step. It cannot be undone.</p>
        <div data-ui="inline">
          <button
            data-variant="danger"
            onClick={async () => {
              const m = defaultMatrix()
              setMatrix(m)
              setLanguage('English')
              setZone('UTC')
              setResetStep(0)
              await persist({ matrix: m, language: 'English', timeZone: 'UTC' })
              merge({ preferencesReset: true })
            }}
          >
            Yes, reset everything
          </button>
          <button
            onClick={() => {
              setResetStep(0)
              merge({ preferencesReset: 'cancelled-step-2' })
            }}
          >
            Keep my settings
          </button>
        </div>
      </Modal>

      <Modal open={deleteOpen} title="Delete your account?" labelledBy="delete-dialog-title" onClose={() => setDeleteOpen(false)} data-testid="delete-dialog">
        <label data-ui="field">
          <span>Type DELETE to confirm</span>
          <input id={t.id('delete-confirm')} value={deleteText} autoComplete="off" onChange={(e) => setDeleteText(e.target.value)} />
        </label>
        <div data-ui="inline">
          <button
            data-variant="danger"
            disabled={deleteText !== 'DELETE'}
            id={t.id('delete-permanently')}
            onClick={async () => {
              setDeleteOpen(false)
              const r = await persist({ deleted: true, deletedAt: new Date(nowMs(config)).toISOString() })
              merge({ account: { deleted: true, persisted: r.persisted } })
            }}
          >
            Delete permanently
          </button>
          <button
            onClick={() => {
              setDeleteOpen(false)
              merge({ account: { deleted: false, cancelled: true } })
            }}
          >
            Cancel
          </button>
        </div>
      </Modal>
    </>
  )
}
