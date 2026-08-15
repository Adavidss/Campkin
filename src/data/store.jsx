import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { dbAll, dbPut, dbBulkPut, dbDelete, dbBulkDelete, dbGet, dbReplaceAll } from './db.js'
import {
  newTrip, newCampground, newPlace, newParkRecord, defaultSettings,
  normalizeTrip, normalizeCampground, normalizePlace, normalizeParkRecord,
  tripStatus,
} from './model.js'
import { defaultChecklist } from './checklists.js'
import { PARK_BY_ID, findParkByName } from './parks.js'
import { uid, normalizeName } from '../lib/util.js'
import { todayISO } from '../lib/dates.js'
import { parseStateFrom, stateName, STATE_BY_AB } from '../lib/states.js'
import { compressImage } from '../lib/images.js'
import { buildSampleData, SAMPLE_PREFIX } from './sample.js'

const AppCtx = createContext(null)

function reportDbError(err) {
  console.error('Campkin storage error:', err)
  window.dispatchEvent(new CustomEvent('campkin:storage-error', { detail: err }))
}

function persistPut(store, value) {
  dbPut(store, value).catch(reportDbError)
}

// Count meaningful edits so the app can nudge for a backup — batched so a
// burst of writes (a whole curated trip) counts once.
let changeTick = null
function noteChange(stateRef, setState) {
  if (changeTick) return
  changeTick = setTimeout(() => {
    changeTick = null
    const s = stateRef.current
    if (!s?.settings) return
    const settings = { ...s.settings, changesSinceBackup: (s.settings.changesSinceBackup || 0) + 1 }
    stateRef.current = { ...s, settings }
    setState(stateRef.current)
    dbPut('settings', settings).catch(reportDbError)
  }, 1500)
}

export function AppProvider({ children }) {
  const [state, setState] = useState(null)
  const stateRef = useRef(null)
  stateRef.current = state

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [trips, campgrounds, places, parkRows, photoRows, settingsRows] = await Promise.all([
          dbAll('trips'), dbAll('campgrounds'), dbAll('places'),
          dbAll('parks'), dbAll('photos'), dbAll('settings'),
        ])
        let settings = settingsRows.find((s) => s.key === 'settings')
        if (!settings) {
          settings = defaultSettings()
          await dbPut('settings', settings)
        } else {
          settings = { ...defaultSettings(), ...settings }
        }
        const parks = {}
        for (const row of parkRows) parks[row.id] = normalizeParkRecord(row)
        if (cancelled) return
        // Sample records written by an older version may lack fields newer
        // features rely on (map coordinates). Quietly refresh them from the
        // current sample set — never touches the user's own records.
        let cgs = campgrounds.map(normalizeCampground)
        const staleSample = cgs.filter((c) => c.sample && c.lat == null)
        if (staleSample.length) {
          const fresh = buildSampleData().campgrounds
          cgs = cgs.map((c) => {
            if (!c.sample || c.lat != null) return c
            const f = fresh.find((x) => x.id === c.id)
            return f ? { ...c, lat: f.lat, lon: f.lon } : c
          })
          dbBulkPut('campgrounds', cgs.filter((c) => c.sample)).catch(reportDbError)
        }
        setState({
          trips: trips.map(normalizeTrip),
          campgrounds: cgs,
          places: places.map(normalizePlace),
          parks,
          photos: photoRows.map(({ blob, ...meta }) => meta),
          settings,
        })
      } catch (err) {
        console.error(err)
        if (!cancelled) setState({ error: err.message || 'Storage unavailable' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const actions = useMemo(() => makeActions(stateRef, setState), [])

  return <AppCtx.Provider value={{ state, actions }}>{children}</AppCtx.Provider>
}

export function useApp() {
  return useContext(AppCtx)
}

// ---------------------------------------------------------------------------
// Actions: every mutation updates React state and writes through to IndexedDB.

function makeActions(stateRef, setState) {
  const get = () => stateRef.current

  // The ref is updated synchronously so that several actions in the same tick
  // (e.g. rapid checklist taps) never read stale state while React batches.
  function patchState(patch) {
    stateRef.current = { ...stateRef.current, ...patch }
    setState(stateRef.current)
    if (!('settings' in patch)) noteChange(stateRef, setState)
  }

  function replaceIn(list, updated) {
    return list.map((x) => (x.id === updated.id ? updated : x))
  }

  // --- campground upsert shared by trip flows -----------------------------

  function upsertCampgroundByName(fields, { sample = false } = {}) {
    const s = get()
    const norm = normalizeName(fields.name)
    let cg = s.campgrounds.find((c) => normalizeName(c.name) === norm)
    if (cg) {
      cg = { ...cg, ...stripEmpty(fields), name: fields.name.trim() }
      patchState({ campgrounds: replaceIn(s.campgrounds, cg) })
    } else {
      cg = newCampground({ ...fields, name: fields.name.trim(), sample })
      if (!cg.location && cg.address) cg.location = shortLocation(cg.address)
      patchState({ campgrounds: [...get().campgrounds, cg] })
    }
    persistPut('campgrounds', cg)
    return cg
  }

  function ensureCampgroundStamp(cg, { date, tripId, sample = false }) {
    const s = get()
    let stamp = s.places.find((p) => p.source === 'campground' && p.refId === cg.id)
    if (stamp) return stamp
    stamp = newPlace({
      name: cg.name,
      category: 'campground',
      state: parseStateFrom(cg.location) || parseStateFrom(cg.address),
      dateVisited: date || todayISO(),
      tripId: tripId || null,
      source: 'campground',
      refId: cg.id,
      sample,
    })
    patchState({ places: [...s.places, stamp] })
    persistPut('places', stamp)
    return stamp
  }

  function upsertParkVisit(parkId, { date, tripId, notes, sample = false }) {
    const s = get()
    const park = PARK_BY_ID[parkId]
    if (!park) return null
    const rec = s.parks[parkId] ? { ...s.parks[parkId] } : newParkRecord(parkId, { sample })
    rec.status = 'visited'
    const visitDate = date || todayISO()
    if (!rec.visits.some((v) => v.date === visitDate)) {
      rec.visits = [...rec.visits, { date: visitDate, tripId: tripId || null }].sort((a, b) =>
        a.date < b.date ? -1 : 1
      )
    }
    patchState({ parks: { ...s.parks, [parkId]: rec } })
    persistPut('parks', rec)

    // One passport stamp per park, ever.
    let stamp = get().places.find((p) => p.source === 'park' && p.refId === parkId)
    if (!stamp) {
      stamp = newPlace({
        name: park.name,
        category: 'national-park',
        state: park.states[0] in STATE_BY_AB ? park.states[0] : null,
        dateVisited: rec.visits[0]?.date || visitDate,
        tripId: tripId || null,
        notes: notes || '',
        source: 'park',
        refId: parkId,
        sample,
      })
      patchState({ places: [...get().places, stamp] })
      persistPut('places', stamp)
    }
    return rec
  }

  // Defined as `api` (not `this`) so methods survive destructuring in views.
  const api = {
    // --- trips -------------------------------------------------------------

    createTrip({ name, destination, startDate, endDate, notes }) {
      const s = get()
      const trip = newTrip({
        name: name.trim(),
        destination: destination.trim(),
        startDate,
        endDate,
        notes: notes || '',
        checklist: defaultChecklist(s.settings.savedChecklistItems, { rv: s.settings.rvMode }),
      })
      patchState({ trips: [...s.trips, trip] })
      persistPut('trips', trip)
      return trip
    },

    updateTrip(id, patch) {
      const s = get()
      const prev = s.trips.find((t) => t.id === id)
      if (!prev) return null
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() }
      patchState({ trips: replaceIn(s.trips, next) })
      persistPut('trips', next)
      return next
    },

    deleteTrip(id) {
      const s = get()
      const photoIds = s.photos.filter((p) => p.entityId === id).map((p) => p.id)
      const places = s.places.map((p) => (p.tripId === id ? { ...p, tripId: null } : p))
      patchState({
        trips: s.trips.filter((t) => t.id !== id),
        photos: s.photos.filter((p) => p.entityId !== id),
        places,
      })
      dbDelete('trips', id).catch(reportDbError)
      dbBulkDelete('photos', photoIds).catch(reportDbError)
      dbBulkPut('places', places.filter((p) => s.places.find((o) => o.id === p.id)?.tripId === id)).catch(reportDbError)
    },

    duplicateTrip(id) {
      const s = get()
      const src = s.trips.find((t) => t.id === id)
      if (!src) return null
      const trip = newTrip({
        name: src.name,
        destination: src.destination,
        campgroundId: src.campgroundId,
        siteNumber: src.siteNumber,
        route: src.route ? { ...src.route } : null,
        checklist: src.checklist.map((i) => ({ ...i, id: uid(), done: false })),
      })
      patchState({ trips: [...s.trips, trip] })
      persistPut('trips', trip)
      return trip
    },

    setTripCampground(tripId, form) {
      const cg = upsertCampgroundByName({
        name: form.name,
        address: form.address || '',
        phone: form.phone || '',
        website: form.website || '',
        hookups: form.hookups || '',
        location: form.location || '',
      })
      const trip = api.updateTrip(tripId, {
        campgroundId: cg.id,
        siteNumber: form.siteNumber || '',
        reservation: form.reservation || '',
        checkIn: form.checkIn || '',
        checkOut: form.checkOut || '',
      })
      // If the trip is already completed, keep the keepsake book in sync.
      if (trip && trip.completed) ensureCampgroundStamp(cg, { date: trip.endDate, tripId })
      return cg
    },

    clearTripCampground(tripId) {
      api.updateTrip(tripId, {
        campgroundId: null, siteNumber: '', reservation: '', checkIn: '', checkOut: '',
      })
    },

    completeTrip(id, recap = {}) {
      const s = get()
      const trip = s.trips.find((t) => t.id === id)
      if (!trip) return null
      const next = api.updateTrip(id, {
        completed: true,
        completedAt: new Date().toISOString(),
        rating: recap.rating ?? trip.rating,
        wouldReturn: recap.wouldReturn ?? trip.wouldReturn,
        favoritePart: recap.favoritePart ?? trip.favoritePart,
        favoriteMeal: recap.favoriteMeal ?? trip.favoriteMeal,
        favoritePlace: recap.favoritePlace ?? trip.favoritePlace,
        memory: recap.memory ?? trip.memory,
        rememberNextTime: recap.rememberNextTime ?? trip.rememberNextTime,
      })
      const cg = get().campgrounds.find((c) => c.id === next.campgroundId)
      if (cg) ensureCampgroundStamp(cg, { date: next.endDate, tripId: id })
      // Mark any trip places that were still "to do" as up to the user; leave them.
      return next
    },

    reopenTrip(id) {
      return api.updateTrip(id, { completed: false, completedAt: null })
    },

    // --- checklist -----------------------------------------------------------

    toggleChecklistItem(tripId, itemId) {
      const s = get()
      const trip = s.trips.find((t) => t.id === tripId)
      if (!trip) return
      const checklist = trip.checklist.map((i) => (i.id === itemId ? { ...i, done: !i.done } : i))
      api.updateTrip(tripId, { checklist })
    },

    addChecklistItem(tripId, cat, label, saveForFuture) {
      const s = get()
      const trip = s.trips.find((t) => t.id === tripId)
      if (!trip || !label.trim()) return
      const item = { id: uid(), cat, label: label.trim(), done: false, custom: true }
      api.updateTrip(tripId, { checklist: [...trip.checklist, item] })
      if (saveForFuture) {
        const saved = s.settings.savedChecklistItems
        if (!saved.some((x) => x.cat === cat && normalizeName(x.label) === normalizeName(label))) {
          api.updateSettings({ savedChecklistItems: [...saved, { cat, label: label.trim() }] })
        }
      }
    },

    removeChecklistItem(tripId, itemId) {
      const trip = get().trips.find((t) => t.id === tripId)
      if (!trip) return
      api.updateTrip(tripId, { checklist: trip.checklist.filter((i) => i.id !== itemId) })
    },

    resetChecklist(tripId) {
      const trip = get().trips.find((t) => t.id === tripId)
      if (!trip) return
      api.updateTrip(tripId, { checklist: trip.checklist.map((i) => ({ ...i, done: false })) })
    },

    restoreDefaultChecklist(tripId) {
      const s = get()
      const trip = s.trips.find((t) => t.id === tripId)
      if (!trip) return
      const existing = new Set(trip.checklist.map((i) => `${i.cat}::${normalizeName(i.label)}`))
      const merged = [...trip.checklist]
      for (const item of defaultChecklist(s.settings.savedChecklistItems)) {
        if (!existing.has(`${item.cat}::${normalizeName(item.label)}`)) merged.push(item)
      }
      api.updateTrip(tripId, { checklist: merged })
    },

    removeSavedChecklistItem(cat, label) {
      const saved = get().settings.savedChecklistItems.filter(
        (x) => !(x.cat === cat && x.label === label)
      )
      api.updateSettings({ savedChecklistItems: saved })
    },

    // --- campgrounds ---------------------------------------------------------

    addCampground(fields) {
      return upsertCampgroundByName(fields)
    },

    // Save a campground found on the Find Nearby map into the book.
    saveCampgroundFromMap(found) {
      const s = get()
      const existing = s.campgrounds.find(
        (c) => (found.osmId && c.osmId === found.osmId) || normalizeName(c.name) === normalizeName(found.name)
      )
      const fields = {
        name: found.name,
        location: found.state ? stateName(found.state) : '',
        phone: found.phone || '',
        website: found.website || '',
        lat: found.lat,
        lon: found.lon,
        osmId: found.osmId || null,
        rvMaxLengthFt: found.maxLengthFt ?? null,
      }
      if (existing) {
        return api.updateCampground(existing.id, stripEmpty(fields))
      }
      const cg = newCampground(fields)
      patchState({ campgrounds: [...s.campgrounds, cg] })
      persistPut('campgrounds', cg)
      return cg
    },

    updateCampground(id, patch) {
      const s = get()
      const prev = s.campgrounds.find((c) => c.id === id)
      if (!prev) return null
      const next = { ...prev, ...patch }
      patchState({ campgrounds: replaceIn(s.campgrounds, next) })
      persistPut('campgrounds', next)
      // Keep the stamp name in sync if renamed.
      if (patch.name) {
        const stamp = s.places.find((p) => p.source === 'campground' && p.refId === id)
        if (stamp) api.updatePlace(stamp.id, { name: patch.name })
      }
      return next
    },

    deleteCampground(id) {
      const s = get()
      const stamp = s.places.find((p) => p.source === 'campground' && p.refId === id)
      const trips = s.trips.map((t) =>
        t.campgroundId === id ? { ...t, campgroundId: null } : t
      )
      patchState({
        campgrounds: s.campgrounds.filter((c) => c.id !== id),
        trips,
        places: stamp ? s.places.filter((p) => p.id !== stamp.id) : s.places,
        photos: s.photos.filter((p) => p.entityId !== id),
      })
      dbDelete('campgrounds', id).catch(reportDbError)
      if (stamp) dbDelete('places', stamp.id).catch(reportDbError)
      dbBulkPut('trips', trips.filter((t, i) => t !== s.trips[i])).catch(reportDbError)
      dbBulkDelete('photos', s.photos.filter((p) => p.entityId === id).map((p) => p.id)).catch(reportDbError)
    },

    // --- places / passport ---------------------------------------------------

    addPlace(fields) {
      // A *visited* National Park place becomes (or updates) the park's stamp.
      // Unvisited ("want to go") park stops stay ordinary list items until done.
      if (fields.category === 'national-park' && fields.visited !== false) {
        const park = findParkByName(fields.name)
        if (park) {
          upsertParkVisit(park.id, {
            date: fields.dateVisited,
            tripId: fields.tripId,
            notes: fields.notes,
          })
          const stamp = get().places.find((p) => p.source === 'park' && p.refId === park.id)
          if (stamp && fields.notes && !stamp.notes) api.updatePlace(stamp.id, { notes: fields.notes })
          return stamp
        }
      }
      const place = newPlace(fields)
      patchState({ places: [...get().places, place] })
      persistPut('places', place)
      return place
    },

    updatePlace(id, patch) {
      const s = get()
      const prev = s.places.find((p) => p.id === id)
      if (!prev) return null
      // Checking off a planned National Park stop records the real park visit
      // and folds the list item into the park's single passport stamp.
      if (
        patch.visited === true &&
        prev.visited === false &&
        prev.category === 'national-park' &&
        prev.source === 'manual'
      ) {
        const park = findParkByName(prev.name)
        if (park) {
          upsertParkVisit(park.id, {
            date: patch.dateVisited || todayISO(),
            tripId: prev.tripId,
            notes: prev.notes,
          })
          patchState({ places: get().places.filter((p) => p.id !== id) })
          dbDelete('places', id).catch(reportDbError)
          return get().places.find((p) => p.source === 'park' && p.refId === park.id)
        }
      }
      const next = { ...prev, ...patch }
      patchState({ places: replaceIn(get().places, next) })
      persistPut('places', next)
      return next
    },

    // --- itinerary -------------------------------------------------------------

    // Move a place to a day (null = unscheduled) at the end of that day.
    setPlaceDay(id, day) {
      const s = get()
      const place = s.places.find((p) => p.id === id)
      if (!place) return
      const siblings = s.places.filter((p) => p.tripId === place.tripId && p.day === day && p.id !== id)
      const order = siblings.length ? Math.max(...siblings.map((p) => p.order || 0)) + 1 : 0
      api.updatePlace(id, { day, order })
    },

    // Nudge a place up/down within its day.
    movePlace(id, dir) {
      const s = get()
      const place = s.places.find((p) => p.id === id)
      if (!place) return
      const list = s.places
        .filter((p) => p.tripId === place.tripId && p.day === place.day)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt < b.createdAt ? -1 : 1))
      const i = list.findIndex((p) => p.id === id)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return
      const reordered = [...list]
      ;[reordered[i], reordered[j]] = [reordered[j], reordered[i]]
      const updated = reordered.map((p, idx) => ({ ...p, order: idx }))
      const byId = Object.fromEntries(updated.map((p) => [p.id, p]))
      patchState({ places: s.places.map((p) => byId[p.id] || p) })
      dbBulkPut('places', updated).catch(reportDbError)
    },

    deletePlace(id) {
      const s = get()
      const place = s.places.find((p) => p.id === id)
      if (!place) return
      patchState({ places: s.places.filter((p) => p.id !== id) })
      dbDelete('places', id).catch(reportDbError)
      // Removing a park stamp also clears that park's visited record.
      if (place.source === 'park' && place.refId && s.parks[place.refId]) {
        const parks = { ...s.parks }
        delete parks[place.refId]
        patchState({ parks })
        dbDelete('parks', place.refId).catch(reportDbError)
      }
    },

    // --- national parks ------------------------------------------------------

    markParkVisited(parkId, { date, tripId } = {}) {
      return upsertParkVisit(parkId, { date, tripId })
    },

    setParkWantToVisit(parkId, want) {
      const s = get()
      const rec = s.parks[parkId] ? { ...s.parks[parkId] } : newParkRecord(parkId)
      if (rec.status === 'visited') return rec // visited wins; use clearPark to undo
      rec.status = want ? 'want' : null
      patchState({ parks: { ...s.parks, [parkId]: rec } })
      persistPut('parks', rec)
      return rec
    },

    clearParkRecord(parkId) {
      const s = get()
      const stamp = s.places.find((p) => p.source === 'park' && p.refId === parkId)
      const parks = { ...s.parks }
      delete parks[parkId]
      patchState({
        parks,
        places: stamp ? s.places.filter((p) => p.id !== stamp.id) : s.places,
      })
      dbDelete('parks', parkId).catch(reportDbError)
      if (stamp) dbDelete('places', stamp.id).catch(reportDbError)
    },

    addParkVisit(parkId, date, tripId) {
      return upsertParkVisit(parkId, { date, tripId })
    },

    removeParkVisit(parkId, date) {
      const s = get()
      const rec = s.parks[parkId]
      if (!rec) return
      const next = { ...rec, visits: rec.visits.filter((v) => v.date !== date) }
      patchState({ parks: { ...s.parks, [parkId]: next } })
      persistPut('parks', next)
    },

    toggleParkFavorite(parkId) {
      const s = get()
      const rec = s.parks[parkId] ? { ...s.parks[parkId] } : newParkRecord(parkId)
      rec.favorite = !rec.favorite
      patchState({ parks: { ...s.parks, [parkId]: rec } })
      persistPut('parks', rec)
    },

    // --- photos ----------------------------------------------------------------

    async addPhoto(entityType, entityId, file) {
      const { blob, width, height } = await compressImage(file)
      const record = {
        id: uid(), entityType, entityId, width, height,
        createdAt: new Date().toISOString(), blob,
      }
      await dbPut('photos', record)
      const { blob: _b, ...meta } = record
      patchState({ photos: [...get().photos, meta] })
      return meta
    },

    async getPhotoBlob(id) {
      const rec = await dbGet('photos', id)
      return rec?.blob || null
    },

    deletePhoto(id) {
      const s = get()
      const trips = s.trips.map((t) => (t.coverPhotoId === id ? { ...t, coverPhotoId: null } : t))
      patchState({ photos: s.photos.filter((p) => p.id !== id), trips })
      dbDelete('photos', id).catch(reportDbError)
      for (let i = 0; i < trips.length; i++) {
        if (trips[i] !== s.trips[i]) persistPut('trips', trips[i])
      }
    },

    // --- states (manual corrections) -------------------------------------------

    toggleStateManual(ab, currentlyVisited) {
      const s = get()
      const { statesAdded, statesRemoved } = s.settings
      let added = statesAdded.filter((x) => x !== ab)
      let removed = statesRemoved.filter((x) => x !== ab)
      if (currentlyVisited) {
        // turning OFF: if it was manually added just drop it, else suppress the derived value
        if (!statesAdded.includes(ab)) removed = [...removed, ab]
      } else {
        if (!statesRemoved.includes(ab)) added = [...added, ab]
      }
      api.updateSettings({ statesAdded: added, statesRemoved: removed })
    },

    // --- settings ----------------------------------------------------------------

    updateSettings(patch) {
      const s = get()
      const settings = { ...s.settings, ...patch }
      patchState({ settings })
      persistPut('settings', settings)
    },

    markBackedUp() {
      api.updateSettings({ lastBackupAt: new Date().toISOString(), changesSinceBackup: 0 })
    },

    // --- sample data ----------------------------------------------------------------

    loadSampleData() {
      const s = get()
      const sample = buildSampleData()
      const trips = [...s.trips.filter((t) => !t.sample), ...sample.trips]
      const campgrounds = [...s.campgrounds.filter((c) => !c.sample), ...sample.campgrounds]
      const places = [...s.places.filter((p) => !p.sample), ...sample.places]
      const parks = { ...s.parks }
      for (const rec of sample.parks) parks[rec.id] = rec
      patchState({ trips, campgrounds, places, parks })
      dbBulkPut('trips', sample.trips).catch(reportDbError)
      dbBulkPut('campgrounds', sample.campgrounds).catch(reportDbError)
      dbBulkPut('places', sample.places).catch(reportDbError)
      dbBulkPut('parks', sample.parks).catch(reportDbError)
    },

    removeSampleData() {
      const s = get()
      const parkIds = Object.keys(s.parks).filter((id) => s.parks[id].sample)
      const parks = {}
      for (const [id, rec] of Object.entries(s.parks)) if (!rec.sample) parks[id] = rec
      patchState({
        trips: s.trips.filter((t) => !t.sample),
        campgrounds: s.campgrounds.filter((c) => !c.sample),
        places: s.places.filter((p) => !p.sample),
        parks,
      })
      dbBulkDelete('trips', s.trips.filter((t) => t.sample).map((t) => t.id)).catch(reportDbError)
      dbBulkDelete('campgrounds', s.campgrounds.filter((c) => c.sample).map((c) => c.id)).catch(reportDbError)
      dbBulkDelete('places', s.places.filter((p) => p.sample).map((p) => p.id)).catch(reportDbError)
      dbBulkDelete('parks', parkIds).catch(reportDbError)
    },

    hasSampleData() {
      const s = get()
      return s.trips.some((t) => t.sample) || s.places.some((p) => p.sample)
    },

    // --- backup / restore -------------------------------------------------------------

    async snapshotForBackup() {
      const s = get()
      const photoRows = await dbAll('photos')
      return { state: s, photoRows }
    },

    async restoreAll({ trips, campgrounds, places, parks, photos, settings }) {
      await dbReplaceAll({
        trips, campgrounds, places,
        parks,
        photos,
        settings: [settings],
      })
      setState({
        trips: trips.map(normalizeTrip),
        campgrounds: campgrounds.map(normalizeCampground),
        places: places.map(normalizePlace),
        parks: Object.fromEntries(parks.map((r) => [r.id, normalizeParkRecord(r)])),
        photos: photos.map(({ blob, ...meta }) => meta),
        settings: { ...defaultSettings(), ...settings },
      })
    },

    async resetAll() {
      const settings = defaultSettings()
      await dbReplaceAll({ trips: [], campgrounds: [], places: [], parks: [], photos: [], settings: [settings] })
      setState({ trips: [], campgrounds: [], places: [], parks: {}, photos: [], settings })
    },
  }

  return api
}

function stripEmpty(obj) {
  const out = {}
  for (const [k, v] of Object.entries(obj)) {
    if (v !== '' && v !== null && v !== undefined) out[k] = v
  }
  return out
}

function shortLocation(address) {
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean)
  if (parts.length >= 2) return parts.slice(-2).join(', ')
  return address
}

// ---------------------------------------------------------------------------
// Derived helpers (selectors)

export { tripStatus }

export function tripsByStatus(trips) {
  const today = todayISO()
  const current = []
  const upcoming = []
  const past = []
  for (const t of trips) {
    const st = tripStatus(t, today)
    if (st === 'active') current.push(t)
    else if (st === 'completed' || st === 'past-due') past.push(t)
    else upcoming.push(t)
  }
  upcoming.sort((a, b) => (a.startDate || '9999') < (b.startDate || '9999') ? -1 : 1)
  past.sort((a, b) => (a.endDate || a.startDate || '') > (b.endDate || b.startDate || '') ? -1 : 1)
  return { current, upcoming, past }
}

export function campgroundVisits(state, campgroundId) {
  return state.trips
    .filter((t) => t.campgroundId === campgroundId && (t.completed || tripStatus(t) !== 'planned'))
    .sort((a, b) => ((a.startDate || '') > (b.startDate || '') ? -1 : 1))
}

export function visitedStates(state) {
  const set = new Set()
  for (const p of state.places) {
    if (p.visited && p.state) set.add(p.state)
  }
  for (const t of state.trips) {
    if (t.completed) {
      const ab = parseStateFrom(t.destination)
      if (ab) set.add(ab)
    }
  }
  for (const ab of state.settings.statesAdded) set.add(ab)
  for (const ab of state.settings.statesRemoved) set.delete(ab)
  // Territories aren't part of the 50-state map.
  for (const ab of [...set]) if (!STATE_BY_AB[ab]) set.delete(ab)
  return set
}

export function passportCounts(state) {
  const stamps = state.places.filter((p) => p.visited)
  const parksVisited = Object.values(state.parks).filter((r) => r.status === 'visited').length
  return {
    places: stamps.length,
    parks: parksVisited,
    states: visitedStates(state).size,
    campgrounds: state.places.filter((p) => p.visited && p.category === 'campground').length,
  }
}

export function coverPhotoOf(state, trip) {
  if (trip.coverPhotoId) {
    const p = state.photos.find((x) => x.id === trip.coverPhotoId)
    if (p) return p
  }
  return state.photos.find((x) => x.entityType === 'trip' && x.entityId === trip.id) || null
}

export function photosFor(state, entityType, entityId) {
  return state.photos
    .filter((p) => p.entityType === entityType && p.entityId === entityId)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
}
