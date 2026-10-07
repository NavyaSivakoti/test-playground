// static hosting has no SPA rewrites. Copy index.html into a folder per route so every deep link
// returns HTTP 200, keep 404.html for unknown routes (real 404 status), and write sitemap/robots.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { routes } from './routes.mjs'

const dist = 'dist'
const site = (process.env.SITE_URL ?? 'https://navyasivakoti.github.io/test-playground').replace(/\/$/, '')
const index = join(dist, 'index.html')
const all = routes()
for (const r of all) {
  if (r.path === '/') continue
  const dir = join(dist, r.path)
  mkdirSync(dir, { recursive: true })
  copyFileSync(index, join(dir, 'index.html'))
}
copyFileSync(index, join(dist, '404.html'))
mkdirSync(join(dist, 'coverage'), { recursive: true })
copyFileSync('coverage/steps.csv', join(dist, 'coverage', 'steps.csv'))
const urls = all.filter((r) => !r.hidden || r.path === '/').map((r) => `  <url><loc>${site}${r.path === '/' ? '/' : `${r.path}/`}</loc></url>`)
writeFileSync(join(dist, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`)
writeFileSync(join(dist, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${site}/sitemap.xml\n`)
writeFileSync(join(dist, '.nojekyll'), '')
console.log(`postbuild: ${all.length} routes, sitemap ${urls.length} urls, base ${site}`)
void readFileSync
