// ONE request per place: campgrounds + sights + food in a single Overpass
// call, cached for a week. This is what makes Quick Trip, road-trip planning
// and Discover feel instant instead of three-round-trips-slow.

import { cacheGet, cacheSet, dedupe, DAY } from './netcache.js'
import { parseMaxLengthFt } from './geo.js'

// Benchmarked 2026-08: primary ~2–5s; private.coffee ~3s; mail.ru ~2s.
// (kumi.systems was 13–40s — dropped.)
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
]

const AREA_TTL = 7 * DAY

function areaKey(lat, lon, radiusMi) {
  // Snap to ~1 km so nearby taps share a cache entry.
  return `area:${lat.toFixed(2)},${lon.toFixed(2)},${radiusMi}`
}

// Try the primary mirror; on failure (429/5xx/timeout) fall through to the
// next. Sequential on purpose — racing both doubles the load that causes the
// throttling in the first place. (kumi is ~7× slower; fallback only.)
// Remember a mirror that just failed so the next request skips straight to
// one that works (cleared after a minute).
const cooling = new Map()

export async function overpass(query, { signal, timeoutMs = 20000 } = {}) {
  let lastErr = null
  const now = Date.now()
  const order = [
    ...OVERPASS_ENDPOINTS.filter((e) => (cooling.get(e) || 0) < now),
    ...OVERPASS_ENDPOINTS.filter((e) => (cooling.get(e) || 0) >= now),
  ]
  for (const endpoint of order) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
      })
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`)
      const data = await resp.json()
      cooling.delete(endpoint)
      return data.elements || []
    } catch (err) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      cooling.set(endpoint, Date.now() + 60000)
      lastErr = err
    }
  }
  throw new Error('The map service is busy — try again in a moment.', { cause: lastErr })
}

// Is this area already cached? (Sync-ish check for UI decisions.)
export async function hasArea(lat, lon, radiusMi = 15) {
  return (await cacheGet(areaKey(lat, lon, radiusMi), AREA_TTL)) !== undefined
}

// Warm the cache for several points, politely: one at a time, skipping
// anything already cached, abandoning quietly on failure. Used to prefetch
// the closest destinations while the user is still looking at the map.
let prefetchToken = 0
export async function prefetchAreas(points, radiusMi = 15) {
  const token = ++prefetchToken
  for (const p of points) {
    if (token !== prefetchToken) return // a newer prefetch superseded this one
    if (await hasArea(p.lat, p.lon, radiusMi)) continue
    try {
      await fetchArea(p.lat, p.lon, radiusMi)
    } catch {
      return // service is busy — stop being a bother
    }
  }
}

// Everything worth knowing around a point, in one shot.
export async function fetchArea(lat, lon, radiusMi = 15, { signal, force = false } = {}) {
  const key = areaKey(lat, lon, radiusMi)
  if (!force) {
    const hit = await cacheGet(key, AREA_TTL)
    if (hit) return hit
  }
  return dedupe(key, async () => {
    const r = Math.round(radiusMi * 1609.34)
    const rc = Math.round(Math.max(radiusMi, 25) * 1609.34) // campgrounds a bit wider
    const rf = r // food: same radius as sights — park centers are far from towns
    // Nodes+ways only (relations are what make Overpass slow); restaurants are
    // nodes. Measured ~2s per area on an unthrottled connection.
    const query = `[out:json][timeout:15];
(
  nw["tourism"="caravan_site"](around:${rc},${lat},${lon});
  nw["tourism"="camp_site"]["backcountry"!="yes"](around:${rc},${lat},${lon});
);
out center tags 100;
(
  nw["tourism"~"^(attraction|viewpoint|museum)$"]["name"](around:${r},${lat},${lon});
  nw["natural"~"^(waterfall|arch|hot_spring)$"]["name"](around:${r},${lat},${lon});
  nw["historic"~"^(monument|fort|castle|ruins|lighthouse)$"]["name"](around:${r},${lat},${lon});
);
out center tags 70;
node["amenity"~"^(restaurant|cafe)$"]["name"](around:${rf},${lat},${lon});
out tags 60;`
    // 11s per mirror: enough for a normal answer, quick enough that a stuck
    // mirror hands off to the next before the user gives up.
    const els = await overpass(query, { signal, timeoutMs: 11000 })
    const area = { camps: [], sights: [], food: [], at: Date.now() }
    for (const el of els) {
      const t = el.tags || {}
      const plat = el.lat ?? el.center?.lat
      const plon = el.lon ?? el.center?.lon
      if (plat == null) continue
      if (t.tourism === 'camp_site' || t.tourism === 'caravan_site') {
        area.camps.push(parseCamp(el, t, plat, plon))
      } else if (t.amenity === 'restaurant' || t.amenity === 'cafe') {
        if (t.name) area.food.push(parsePOI(el, t, plat, plon, 'food'))
      } else if (t.name) {
        area.sights.push(parsePOI(el, t, plat, plon, 'sights'))
      }
    }
    await cacheSet(key, area)
    return area
  })
}

function parseCamp(el, t, lat, lon) {
  const isCaravanSite = t.tourism === 'caravan_site'
  return {
    osmId: `${el.type}/${el.id}`,
    name: t.name || (isCaravanSite ? 'RV Park' : 'Campground'),
    lat,
    lon,
    kind: isCaravanSite ? 'rv-park' : 'campground',
    caravans: t.caravans === 'yes' || isCaravanSite ? 'yes' : t.caravans === 'no' ? 'no' : null,
    tents: t.tents === 'yes' ? 'yes' : t.tents === 'no' ? 'no' : isCaravanSite ? null : 'yes',
    backcountry: t.backcountry === 'yes',
    maxLengthFt: parseMaxLengthFt(t.maxlength),
    power: !!(t.power_supply && t.power_supply !== 'no'),
    water: t.drinking_water === 'yes' || t.water_point === 'yes',
    dump: t.sanitary_dump_station === 'yes',
    fee: t.fee === 'yes' ? true : t.fee === 'no' ? false : null,
    reservation: t.reservation || null,
    phone: t.phone || t['contact:phone'] || '',
    website: t.website || t['contact:website'] || '',
    operator: t.operator || '',
    state: t['addr:state'] || null,
  }
}

function parsePOI(el, t, lat, lon, kind) {
  return {
    id: `${el.type}/${el.id}`,
    name: t.name.split(';')[0].trim(),
    lat,
    lon,
    kind,
    tourism: t.tourism || null,
    historic: t.historic || null,
    natural: t.natural || null,
    amenity: t.amenity || null,
    cuisine: t.cuisine || null,
    ele: t.ele ? Math.round(parseFloat(t.ele) * 3.28084) : null,
    wiki: !!(t.wikipedia || t.wikidata),
    website: t.website || t['contact:website'] || '',
    phone: t.phone || t['contact:phone'] || '',
    outdoor: t.outdoor_seating === 'yes',
    fee: t.fee === 'no' ? false : t.fee ? true : null,
  }
}
