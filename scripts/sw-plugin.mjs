import { readdirSync, statSync, writeFileSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createHash } from 'node:crypto'

// After the build, generate dist/sw.js with the full asset list baked in, so
// the app shell works offline. The cache name is derived from the content of
// the build — every deploy gets a fresh cache and old ones are cleaned up.

function walk(dir, base) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) out.push(...walk(full, base))
    else out.push(relative(base, full).split('\\').join('/'))
  }
  return out
}

export function serviceWorkerPlugin() {
  let outDir = 'dist'
  return {
    name: 'campkin-sw',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const files = walk(outDir, outDir).filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
      const hash = createHash('sha1')
      for (const f of files.sort()) {
        hash.update(f)
        hash.update(readFileSync(join(outDir, f)))
      }
      const version = hash.digest('hex').slice(0, 12)
      const assets = ['./', ...files.filter((f) => f !== 'index.html' && f !== '404.html')]
      const sw = `// Campkin service worker — generated at build time. Version ${version}
const CACHE = 'campkin-${version}'
const ASSETS = ${JSON.stringify(assets)}

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS.map((a) => new URL(a, self.registration.scope).href)))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k.startsWith('campkin-') && k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (req.mode === 'navigate') {
    const shell = new URL('./', self.registration.scope).href
    e.respondWith(caches.match(shell).then((r) => r || fetch(req)))
    return
  }
  e.respondWith(
    caches.match(req).then(
      (r) =>
        r ||
        fetch(req).then((resp) => {
          if (resp.ok && url.pathname.startsWith(new URL(self.registration.scope).pathname)) {
            const copy = resp.clone()
            caches.open(CACHE).then((c) => c.put(req, copy))
          }
          return resp
        })
    )
  )
})
`
      writeFileSync(join(outDir, 'sw.js'), sw)
      console.log(`  campkin-sw: precaching ${assets.length} assets (v${version})`)
    },
  }
}
