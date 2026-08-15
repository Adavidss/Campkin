// Backup & restore. A Campkin backup is a single JSON file containing every
// record plus photos (as data URLs). Validation happens *before* anything is
// touched, so a bad file can never corrupt existing data.

import { SCHEMA_VERSION, normalizeTrip, normalizeCampground, normalizePlace, normalizeParkRecord, defaultSettings } from '../data/model.js'
import { blobToDataURL, dataURLToBlob } from './images.js'
import { download } from './util.js'
import { todayISO } from './dates.js'

export async function buildBackupBlob({ state, photoRows }) {
  const photos = []
  for (const row of photoRows) {
    const { blob, ...meta } = row
    photos.push({ ...meta, dataURL: blob ? await blobToDataURL(blob) : null })
  }
  const payload = {
    app: 'campkin',
    kind: 'campkin-backup',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: {
      trips: state.trips,
      campgrounds: state.campgrounds,
      places: state.places,
      parks: Object.values(state.parks),
      settings: state.settings,
    },
    photos,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  return { blob, count: countRecords(payload), filename: `campkin-backup-${todayISO()}.json` }
}

// Get the backup onto the device's real file system, not just the browser:
//  • iPhone/iPad (and Android): the share sheet → "Save to Files" / Drive
//  • Desktop Chrome/Edge: a native Save dialog (File System Access API)
//  • Everything else: a regular download
// Returns how it was delivered so the UI can phrase the confirmation.
export async function saveBackupToDevice({ state, photoRows }) {
  const { blob, count, filename } = await buildBackupBlob({ state, photoRows })
  const file = new File([blob], filename, { type: 'application/json' })

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Campkin backup' })
      return { via: 'share', count, size: blob.size }
    } catch (err) {
      if (err.name === 'AbortError') return { via: 'cancelled', count, size: blob.size }
      // fall through to other methods
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'Campkin backup', accept: { 'application/json': ['.json'] } }],
      })
      const w = await handle.createWritable()
      await w.write(blob)
      await w.close()
      return { via: 'picker', count, size: blob.size }
    } catch (err) {
      if (err.name === 'AbortError') return { via: 'cancelled', count, size: blob.size }
    }
  }

  download(filename, blob)
  return { via: 'download', count, size: blob.size }
}

// Kept for callers that just want a download.
export async function createBackupFile(snapshot) {
  const { blob, count, filename } = await buildBackupBlob(snapshot)
  download(filename, blob)
  return { count, size: blob.size }
}

function countRecords(payload) {
  const d = payload.data
  return (d.trips?.length || 0) + (d.campgrounds?.length || 0) + (d.places?.length || 0)
}

// Parses and fully validates a backup file. Throws friendly errors.
export async function readBackupFile(file) {
  let payload
  try {
    payload = JSON.parse(await file.text())
  } catch {
    throw new Error('That file doesn’t look like a Campkin backup (it couldn’t be read).')
  }
  if (!payload || payload.app !== 'campkin' || !payload.data) {
    throw new Error('That file doesn’t look like a Campkin backup.')
  }
  if (typeof payload.schemaVersion !== 'number') {
    throw new Error('This backup is missing its version information.')
  }
  if (payload.schemaVersion > SCHEMA_VERSION) {
    throw new Error(
      'This backup was made by a newer version of Campkin. Update the app (refresh the page) and try again.'
    )
  }
  const d = payload.data
  for (const key of ['trips', 'campgrounds', 'places', 'parks']) {
    if (d[key] != null && !Array.isArray(d[key])) {
      throw new Error('This backup file appears to be damaged.')
    }
  }
  // Future migrations from older schema versions slot in here.
  const trips = (d.trips || []).map(normalizeTrip)
  const campgrounds = (d.campgrounds || []).map(normalizeCampground)
  const places = (d.places || []).map(normalizePlace)
  const parks = (d.parks || []).filter((r) => r && r.id).map(normalizeParkRecord)
  const settings = { ...defaultSettings(), ...(d.settings || {}), schemaVersion: SCHEMA_VERSION }

  const photos = []
  for (const p of payload.photos || []) {
    if (!p || !p.id || !p.dataURL) continue
    try {
      const { dataURL, ...meta } = p
      photos.push({ ...meta, blob: dataURLToBlob(dataURL) })
    } catch {
      // Skip a damaged photo rather than failing the whole restore.
    }
  }

  return {
    summary: {
      exportedAt: payload.exportedAt,
      trips: trips.length,
      campgrounds: campgrounds.length,
      places: places.length,
      photos: photos.length,
    },
    payload: { trips, campgrounds, places, parks, photos, settings },
  }
}
