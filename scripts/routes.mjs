// Lists every route declared by src/pages/**/*.page.tsx (meta.path) with its hidden flag.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

function walk(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.page.tsx') ? [p] : []
  })
}

export function routes(root = 'src/pages') {
  return walk(root)
    .map((file) => {
      const src = readFileSync(file, 'utf8')
      const m = src.match(/export const meta[^=]*=\s*\{[\s\S]*?path:\s*['"`]([^'"`]+)['"`]/)
      if (!m) return null
      const metaBlock = src.slice(src.indexOf('export const meta'), src.indexOf('export const meta') + 4000)
      return { path: m[1], hidden: /hidden:\s*true/.test(metaBlock), file }
    })
    .filter(Boolean)
}
