// Quick Trip curation: given a destination and the traveler's setup, assemble
// a complete trip proposal — where to stay, what to see, where to eat, the
// weather and the drive — from keyless sources, each part failing softly.

import { fetchArea } from './area.js'
import { topPOIs, poiTypeLabel } from './pois.js'
import { fetchForecast } from './weather.js'
import { topPicks } from './recommend.js'
import { haversineMiles, roadMilesEstimate, driveTimeEstimate } from './geo.js'

// Turn a POI into place-record fields for a trip's itinerary.
export function poiToPlaceFields(p, tripId, day) {
  const category =
    p.kind === 'food'
      ? 'food'
      : p.tourism === 'museum' || p.historic
        ? 'historic-site'
        : 'landmark'
  return {
    name: p.name,
    category,
    visited: false,
    tripId,
    day,
    notes: poiTypeLabel(p),
    lat: p.lat,
    lon: p.lon,
  }
}

async function soft(promise, fallback) {
  try {
    return await promise
  } catch (err) {
    console.warn('curate: part failed', err)
    return fallback
  }
}

// ONE combined map request (cached a week) — resolves as soon as the map data
// is in; the forecast arrives via `onForecast` so it never delays the sheet.
export async function curateTrip(dest, origin, { rvMode = true, rvLen = null, signal, onForecast } = {}) {
  const forecastP = soft(fetchForecast(dest.lat, dest.lon, { signal }), null)
  forecastP.then((f) => f && onForecast?.(f.slice(0, 5)))
  const area = await soft(fetchArea(dest.lat, dest.lon, 15, { signal }), null)
  const camps = area?.camps || null
  const sights = area?.sights || null
  const food = area?.food || null

  const campPicks = camps
    ? topPicks(
        camps.map((r) => ({ ...r, distance: haversineMiles(dest, r) })),
        { rvLen, rvMode },
        3
      )
    : []
  const sightPicks = sights ? topPOIs(sights, dest, 4) : []
  const foodPicks = food ? topPOIs(food, dest, 3) : []

  const miles = origin ? roadMilesEstimate(origin, dest) : null
  const driveTime = miles != null ? driveTimeEstimate(miles, { rv: rvMode }) : null

  const nights = miles == null ? 2 : miles < 120 ? 2 : miles < 300 ? 3 : 4

  return {
    campPicks,
    sightPicks,
    foodPicks,
    forecast: null, // arrives via onForecast
    miles,
    driveTime,
    nights,
    partial: !area,
  }
}

// Plan every stop of a road trip: one combined request per stop, two stops
// in flight at a time (the free service allows ~2 slots), results streamed
// back through `onStop(index, result)` so the UI fills in as they land.
export async function planRoadTrip(stops, { rvMode = true, rvLen = null, signal, onStop, onProgress } = {}) {
  const results = new Array(stops.length).fill(null)
  let done = 0
  const worker = async (queue) => {
    for (const i of queue) {
      const s = stops[i]
      onProgress?.(done, stops.length, s.name)
      const area = await soft(fetchArea(s.lat, s.lon, 15, { signal }), null)
      const res = {
        stop: s,
        camp: area
          ? topPicks(
              area.camps.map((r) => ({ ...r, distance: haversineMiles(s, r) })),
              { rvLen, rvMode },
              1
            )[0] || null
          : null,
        sights: area ? topPOIs(area.sights, s, 3) : [],
        food: area ? topPOIs(area.food, s, 2) : [],
        missing: !area,
      }
      results[i] = res
      done++
      onStop?.(i, res)
      onProgress?.(done, stops.length, null)
    }
  }
  const idx = stops.map((_, i) => i)
  await Promise.all([worker(idx.filter((i) => i % 2 === 0)), worker(idx.filter((i) => i % 2 === 1))])
  return results
}
