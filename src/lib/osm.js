// Keyless OpenStreetMap services: Overpass (nearby campgrounds) and Nominatim
// (place search / geocoding). No API keys, no backend — requests go straight
// from the browser, with polite usage (explicit actions only, tiny result
// caches, single in-flight query).

import { parseMaxLengthFt } from './geo.js'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const cache = new Map() // key → results (per session)

function cacheKey(lat, lon, radiusMi) {
  return `${lat.toFixed(3)},${lon.toFixed(3)},${radiusMi}`
}

export async function fetchNearbyCampgrounds(lat, lon, radiusMi, { signal } = {}) {
  const key = cacheKey(lat, lon, radiusMi)
  if (cache.has(key)) return cache.get(key)

  const radiusM = Math.round(radiusMi * 1609.34)
  const query = `[out:json][timeout:25];
(
  nwr["tourism"="camp_site"](around:${radiusM},${lat},${lon});
  nwr["tourism"="caravan_site"](around:${radiusM},${lat},${lon});
);
out center tags 80;`

  let lastErr = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal,
      })
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`)
      const data = await resp.json()
      const results = (data.elements || [])
        .map((el) => parseElement(el))
        .filter(Boolean)
      cache.set(key, results)
      return results
    } catch (err) {
      if (err.name === 'AbortError') throw err
      lastErr = err
    }
  }
  throw new Error('The campground map service is busy right now — try again in a moment.', {
    cause: lastErr,
  })
}

function parseElement(el) {
  const t = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || lon == null) return null
  const isCaravanSite = t.tourism === 'caravan_site'
  const caravans = t.caravans === 'yes' || isCaravanSite ? 'yes' : t.caravans === 'no' ? 'no' : null
  const tents = t.tents === 'yes' ? 'yes' : t.tents === 'no' ? 'no' : isCaravanSite ? null : 'yes'
  return {
    osmId: `${el.type}/${el.id}`,
    name: t.name || (isCaravanSite ? 'RV Park' : 'Campground'),
    lat,
    lon,
    kind: isCaravanSite ? 'rv-park' : 'campground',
    caravans, // 'yes' | 'no' | null (unknown)
    tents,
    maxLengthFt: parseMaxLengthFt(t.maxlength),
    power: t.power_supply && t.power_supply !== 'no',
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

// --- Nominatim place search ------------------------------------------------

const geoCache = new Map()

export async function geocodePlace(query, { signal } = {}) {
  const q = query.trim()
  if (!q) return null
  if (geoCache.has(q.toLowerCase())) return geoCache.get(q.toLowerCase())
  // Nominatim matches literally, so fall back through simpler variants:
  // full query → first + last segment → drop the first segment → last two.
  for (const variant of queryVariants(q)) {
    const rows = await nominatimSearch(variant, signal)
    if (rows.length) {
      const r = rows[0]
      const result = {
        lat: parseFloat(r.lat),
        lon: parseFloat(r.lon),
        label: shortLabel(r.display_name),
      }
      geoCache.set(q.toLowerCase(), result)
      return result
    }
  }
  return null
}

function queryVariants(q) {
  const parts = q.split(',').map((p) => p.trim()).filter(Boolean)
  const variants = [q]
  if (parts.length > 2) {
    variants.push(`${parts[0]}, ${parts[parts.length - 1]}`)
    variants.push(parts.slice(1).join(', '))
    variants.push(parts.slice(-2).join(', '))
  } else if (parts.length === 2) {
    variants.push(parts[1])
  }
  return [...new Set(variants)]
}

async function nominatimSearch(q, signal) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=us&q=' +
    encodeURIComponent(q)
  const resp = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!resp.ok) throw new Error('Place search is unavailable right now.')
  return resp.json()
}

function shortLabel(displayName) {
  const parts = (displayName || '').split(',').map((p) => p.trim())
  return parts.slice(0, 2).join(', ')
}

export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('Location isn’t available in this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === 1
              ? 'Location access was declined — search for a place instead.'
              : 'Couldn’t get your location — search for a place instead.'
          )
        ),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    )
  })
}
