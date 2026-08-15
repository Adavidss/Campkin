// Persistent cache for keyless map-service results (Overpass, Nominatim,
// Open-Meteo). Anything you've looked at once is instant next time — even
// after a reload or offline at the campground. Stored in its own IndexedDB
// database so backups/restores never touch it.

const DB_NAME = 'campkin-cache'
const STORE = 'entries'
let dbP = null

function open() {
  if (dbP) return dbP
  dbP = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'key' })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbP
}

const mem = new Map() // hot layer

export async function cacheGet(key, maxAgeMs) {
  const hot = mem.get(key)
  if (hot && Date.now() - hot.at < maxAgeMs) return hot.value
  try {
    const db = await open()
    const row = await new Promise((res, rej) => {
      const r = db.transaction(STORE).objectStore(STORE).get(key)
      r.onsuccess = () => res(r.result)
      r.onerror = () => rej(r.error)
    })
    if (row && Date.now() - row.at < maxAgeMs) {
      mem.set(key, row)
      return row.value
    }
  } catch {
    /* cache is best-effort */
  }
  return undefined
}

export async function cacheSet(key, value) {
  const row = { key, value, at: Date.now() }
  mem.set(key, row)
  try {
    const db = await open()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(row)
  } catch {
    /* ignore */
  }
}

// Only one request per key in flight — a second caller gets the same promise.
const inflight = new Map()

export function dedupe(key, fn) {
  if (inflight.has(key)) return inflight.get(key)
  const p = fn().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}

export const HOUR = 3600 * 1000
export const DAY = 24 * HOUR
