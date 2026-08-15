// ONE request per place: campgrounds + sights + food in a single Overpass
// call, cached for a week. This is what makes Quick Trip, road-trip planning
// and Discover feel instant instead of three-round-trips-slow.

import { cacheGet, cacheSet, dedupe, DAY } from './netcache.js'
import { parseMaxLengthFt } from './geo.js'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const AREA_TTL = 7 * DAY

function areaKey(lat, lon, radiusMi) {
  // Snap to ~1 km so nearby taps share a cache entry.
  return `area:${lat.toFixed(2)},${lon.toFixed(2)},${radiusMi}`
}

// Try the primary mirror; on failure (429/5xx/timeout) fall through to the
// next. Sequential on purpose — racing both doubles the load that causes the
// throttling in the first place.
export async function overpass(query, { signal, timeoutMs = 20000 } = {}) {
  let lastErr = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
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
      return data.elements || []
    } catch (err) {
      if (signal?.aborted) throw new DOMException('aborted', 'AbortError')
      lastErr = err
    }
  }
  throw new Error('The map service is busy — try again in a moment.', { cause: lastErr })
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
    const query = `[out:json][timeout:22];
nwr["tourism"="caravan_site"](around:${rc},${lat},${lon});
out center tags 60;
nwr["tourism"="camp_site"]["backcountry"!="yes"](around:${rc},${lat},${lon});
out center tags 80;
nwr["tourism"~"^(attraction|viewpoint|museum)$"]["name"](around:${r},${lat},${lon});
out center tags 60;
nwr["natural"~"^(waterfall|arch|hot_spring)$"]["name"](around:${r},${lat},${lon});
out center tags 25;
nwr["historic"~"^(monument|fort|castle|ruins|lighthouse)$"]["name"](around:${r},${lat},${lon});
out center tags 25;
nwr["amenity"~"^(restaurant|cafe)$"]["name"](around:${Math.round(Math.min(radiusMi, 10) * 1609.34)},${lat},${lon});
out center tags 80;`
    const els = await overpass(query, { signal })
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
