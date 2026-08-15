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

// The parts of a curated trip that need no network at all — instant.
export function curateInstant(dest, origin, { rvMode = true } = {}) {
  const miles = origin ? roadMilesEstimate(origin, dest) : null
  const driveTime = miles != null ? driveTimeEstimate(miles, { rv: rvMode }) : null
  const nights = miles == null ? 2 : miles < 120 ? 2 : miles < 300 ? 3 : 4
  return { miles, driveTime, nights }
}

// Rank an area's raw results for a destination.
export function curateFromArea(area, dest, { rvMode = true, rvLen = null } = {}) {
  return {
    campPicks: topPicks(
      area.camps.map((r) => ({ ...r, distance: haversineMiles(dest, r) })),
      { rvLen, rvMode },
      3
    ),
    sightPicks: topPOIs(area.sights, dest, 4),
    foodPicks: topPOIs(area.food, dest, 3),
  }
}

// Full curation (used by tests/other callers); the sheet itself streams
// the pieces via curateInstant + fetchArea + fetchForecast for instant open.
export async function curateTrip(dest, origin, { rvMode = true, rvLen = null, signal, onForecast } = {}) {
  const forecastP = soft(fetchForecast(dest.lat, dest.lon, { signal }), null)
  forecastP.then((f) => f && onForecast?.(f.slice(0, 5)))
  const area = await soft(fetchArea(dest.lat, dest.lon, 15, { signal }), null)
  const ranked = area ? curateFromArea(area, dest, { rvMode, rvLen }) : { campPicks: [], sightPicks: [], foodPicks: [] }
  return { ...ranked, ...curateInstant(dest, origin, { rvMode }), forecast: null, partial: !area }
}

// Points along a leg where it's worth looking for a break: the midpoint of
// legs 90+ miles, plus thirds of legs 250+ miles. Sight-seeing along the
// drive, not just at the parks.
export function legSamplePoints(a, b) {
  const miles = roadMilesEstimate(a, b)
  const at = (t) => ({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t })
  if (miles >= 250) return [{ ...at(1 / 3), t: 1 / 3 }, { ...at(2 / 3), t: 2 / 3 }]
  if (miles >= 90) return [{ ...at(0.5), t: 0.5 }]
  return []
}

// Best sights & a bite along a leg — a few strong picks near the samples,
// merged and de-duplicated, sorted by progress along the leg.
export async function planLegHighlights(a, b, { signal } = {}) {
  const samples = legSamplePoints(a, b)
  const out = { sights: [], food: [] }
  const seen = new Set()
  for (const s of samples) {
    const area = await soft(fetchArea(s.lat, s.lon, 15, { signal }), null)
    if (!area) continue
    for (const p of topPOIs(area.sights, s, 2)) {
      if (!seen.has(p.name)) {
        seen.add(p.name)
        out.sights.push({ ...p, t: s.t })
      }
    }
    for (const p of topPOIs(area.food, s, 1)) {
      if (!seen.has(p.name)) {
        seen.add(p.name)
        out.food.push({ ...p, t: s.t })
      }
    }
  }
  return out
}

// Plan every stop of a road trip: one combined request per stop, two stops
// in flight at a time (the free service allows ~2 slots), results streamed
// back through `onStop(index, result)` so the UI fills in as they land.
// `waypoints` includes the start; each result i covers the leg INTO stop i+1
// (highlights along the way) plus the stop itself (stay/sights/food).
export async function planRoadTrip(waypoints, { rvMode = true, rvLen = null, signal, onStop, onProgress } = {}) {
  const stops = waypoints.slice(1)
  const results = new Array(stops.length).fill(null)
  let done = 0
  const worker = async (queue) => {
    for (const i of queue) {
      const s = stops[i]
      const prev = waypoints[i]
      onProgress?.(done, stops.length, s.name)
      const [area, along] = await Promise.all([
        soft(fetchArea(s.lat, s.lon, 15, { signal }), null),
        soft(planLegHighlights(prev, s, { signal }), { sights: [], food: [] }),
      ])
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
        along,
        legFrom: prev.name,
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
