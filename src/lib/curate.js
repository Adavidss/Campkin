// Quick Trip curation: given a destination and the traveler's setup, assemble
// a complete trip proposal — where to stay, what to see, where to eat, the
// weather and the drive — from keyless sources, each part failing softly.

import { fetchNearbyCampgrounds } from './osm.js'
import { fetchPOIs, topPOIs, poiTypeLabel } from './pois.js'
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

// Overpass rate-limits parallel requests from one client, so its calls run
// one after another (each is small); the forecast runs alongside. `onPart`
// lets the UI fill in progressively instead of waiting for everything.
export async function curateTrip(dest, origin, { rvMode = true, rvLen = null, signal, onPart } = {}) {
  const forecastP = soft(fetchForecast(dest.lat, dest.lon, { signal }), null)
  const camps = await soft(fetchNearbyCampgrounds(dest.lat, dest.lon, 25, { signal }), null)
  onPart?.('camps')
  const sights = await soft(fetchPOIs('sights', dest.lat, dest.lon, 15, { signal }), null)
  onPart?.('sights')
  const food = await soft(fetchPOIs('food', dest.lat, dest.lon, 12, { signal }), null)
  onPart?.('food')
  const forecast = await forecastP

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
    forecast: forecast ? forecast.slice(0, 5) : null,
    miles,
    driveTime,
    nights,
    partial: !camps || !sights || !food,
  }
}

// Plan every stop of a road trip: for each waypoint, a campground + a few
// sights + a couple of places to eat. Runs strictly one stop at a time (and
// one Overpass call at a time inside) so the map service doesn't throttle us.
// `onProgress(i, total, label)` drives the UI.
export async function planRoadTrip(stops, { rvMode = true, rvLen = null, signal, onProgress } = {}) {
  const out = []
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]
    onProgress?.(i, stops.length, s.name)
    const camps = await soft(fetchNearbyCampgrounds(s.lat, s.lon, 25, { signal }), null)
    const sights = await soft(fetchPOIs('sights', s.lat, s.lon, 15, { signal }), null)
    const food = await soft(fetchPOIs('food', s.lat, s.lon, 12, { signal }), null)
    out.push({
      stop: s,
      camp: camps
        ? topPicks(
            camps.map((r) => ({ ...r, distance: haversineMiles(s, r) })),
            { rvLen, rvMode },
            1
          )[0] || null
        : null,
      sights: sights ? topPOIs(sights, s, 3) : [],
      food: food ? topPOIs(food, s, 2) : [],
    })
  }
  onProgress?.(stops.length, stops.length, null)
  return out
}
