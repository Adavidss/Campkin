// Thin promise wrapper around IndexedDB. One database, one object store per
// entity. Structured data is small; photos are stored as Blobs.

const DB_NAME = 'campkin'
const DB_VERSION = 1

export const STORES = ['trips', 'campgrounds', 'places', 'parks', 'photos', 'settings']

let dbPromise = null

export function openDB() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) {
          const store = db.createObjectStore(name, { keyPath: name === 'settings' ? 'key' : 'id' })
          if (name === 'photos') store.createIndex('entityId', 'entityId', { unique: false })
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
    req.onblocked = () => reject(new Error('Campkin database is open in another tab.'))
  })
  return dbPromise
}

function tx(db, store, mode) {
  return db.transaction(store, mode).objectStore(store)
}

function asPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function dbAll(store) {
  const db = await openDB()
  return asPromise(tx(db, store, 'readonly').getAll())
}

export async function dbGet(store, id) {
  const db = await openDB()
  return asPromise(tx(db, store, 'readonly').get(id))
}

export async function dbPut(store, value) {
  const db = await openDB()
  return asPromise(tx(db, store, 'readwrite').put(value))
}

export async function dbBulkPut(store, values) {
  if (!values.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    for (const v of values) s.put(v)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function dbDelete(store, id) {
  const db = await openDB()
  return asPromise(tx(db, store, 'readwrite').delete(id))
}

export async function dbBulkDelete(store, ids) {
  if (!ids.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, 'readwrite')
    const s = t.objectStore(store)
    for (const id of ids) s.delete(id)
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

export async function dbClear(store) {
  const db = await openDB()
  return asPromise(tx(db, store, 'readwrite').clear())
}

// Replace the entire database contents in one transaction (used by restore).
export async function dbReplaceAll(payload) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORES, 'readwrite')
    for (const name of STORES) {
      const s = t.objectStore(name)
      s.clear()
      for (const v of payload[name] || []) s.put(v)
    }
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
    t.onabort = () => reject(t.error || new Error('Restore was interrupted.'))
  })
}
