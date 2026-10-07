// Helpers shared by the Windows page and its child / popup pages.
import type { PlaygroundConfig } from '../../core/config'

export const windowsChannel = (ns: string) => `tp-windows-${ns}`

export function childQuery(config: PlaygroundConfig): string {
  const p = new URLSearchParams()
  p.set('seed', String(config.seed))
  if (config.ns !== 'default') p.set('ns', config.ns)
  if (config.variant !== 'a') p.set('variant', config.variant)
  return p.toString()
}

export function routeUrl(route: string, config: PlaygroundConfig): string {
  return `${import.meta.env.BASE_URL}${route.replace(/^\//, '')}/?${childQuery(config)}`
}
