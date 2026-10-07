// Deterministic device rows for the network admin console (Grid page).
import { randFor } from '../../../core/rng'

export type DeviceStatus = 'online' | 'offline' | 'disabled'
export interface Device {
  id: string
  hostname: string
  ip: string
  protocol: 'UDP' | 'TCP'
  status: DeviceStatus
  lastSeen: number
  site: string
  model: string
  firmware: string
  uptimeDays: number
  rack: string
  ports: number
  vlan: number
  owner: string
  serial: string
}

const SITES = ['ams', 'fra', 'lon', 'nyc', 'sfo', 'sin', 'syd', 'tok']
const ROLES = ['edge', 'core', 'dist', 'acc']
const MODELS = ['NX-2400', 'NX-4800', 'RT-120', 'RT-360', 'AP-11ax', 'FW-900']
const OWNERS = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Edsger Dijkstra', 'Barbara Liskov', 'Donald Knuth']

export const DEVICE_COUNT = 500

export function makeDevices(seed: number, now: number): Device[] {
  const out: Device[] = []
  for (let i = 0; i < DEVICE_COUNT; i++) {
    const r = (k: string) => randFor(seed, `grid:${i}:${k}`)
    const siteIdx = Math.floor(r('site') * SITES.length)
    const site = SITES[siteIdx]
    const role = ROLES[Math.floor(r('role') * ROLES.length)]
    const s = r('status')
    const status: DeviceStatus = s < 0.7 ? 'online' : s < 0.9 ? 'offline' : 'disabled'
    const ago = status === 'online' ? Math.floor(r('seen') * 5 * 60_000) : Math.floor(r('seen') * 7 * 24 * 3600_000)
    out.push({
      id: `dev-${String(i + 1).padStart(3, '0')}`,
      hostname: `${role}-${site}-${String(i + 1).padStart(3, '0')}`,
      ip: `10.${siteIdx + 10}.${Math.floor(i / 250)}.${(i % 250) + 1}`,
      protocol: r('proto') < 0.5 ? 'UDP' : 'TCP',
      status,
      lastSeen: now - ago,
      site: site.toUpperCase(),
      model: MODELS[Math.floor(r('model') * MODELS.length)],
      firmware: `v${1 + Math.floor(r('fw1') * 4)}.${Math.floor(r('fw2') * 10)}.${Math.floor(r('fw3') * 20)}`,
      uptimeDays: status === 'online' ? Math.floor(r('up') * 400) : 0,
      rack: `R${1 + Math.floor(r('rack') * 40)}`,
      ports: r('ports') < 0.5 ? 24 : 48,
      vlan: 100 + Math.floor(r('vlan') * 30) * 10,
      owner: OWNERS[Math.floor(r('owner') * OWNERS.length)],
      serial: `SN${Math.floor(r('serial') * 1e9).toString(36).toUpperCase().padStart(6, '0')}`,
    })
  }
  return out
}

export const fmtTime = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
