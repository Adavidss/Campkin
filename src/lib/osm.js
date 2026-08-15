// Keyless OpenStreetMap services: Overpass (nearby campgrounds) and Nominatim
// (place search / geocoding). No API keys, no backend — requests go straight
// from the browser, with polite usage (explicit actions only, tiny result
// caches, single in-flight query).

import { parseMaxLengthFt } from './geo.js'
import { cacheGet, cacheSet, dedupe, DAY, HOUR } from './netcache.js'

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

// A stalled connection must fail fast, not hang a view forever.
function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

import { overpass } from './area.js'

async function overpassRace(query, opts) {
  try {
    return await overpass(query, opts)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new Error('The campground map service is busy right now — try again in a moment.', { cause: err })
  }
}

function cacheKey(lat, lon, radiusMi) {
  return `camps:${lat.toFixed(2)},${lon.toFixed(2)},${radiusMi}`
}

export async function fetchNearbyCampgrounds(lat, lon, radiusMi, { signal } = {}) {
  const key = cacheKey(lat, lon, radiusMi)
  const hit = await cacheGet(key, 7 * DAY)
  if (hit) return hit
  return dedupe(key, async () => {
    const radiusM = Math.round(radiusMi * 1609.34)
    // Queried separately with their own caps: in dense parks the hundreds of
    // backcountry camp_sites must never crowd RV parks out of a shared limit.
    const query = `[out:json][timeout:22];
nwr["tourism"="caravan_site"](around:${radiusM},${lat},${lon});
out center tags 80;
nwr["tourism"="camp_site"]["backcountry"!="yes"](around:${radiusM},${lat},${lon});
out center tags 120;`
    const els = await overpassRace(query, { signal })
    const results = els.map((el) => parseElement(el)).filter(Boolean)
    await cacheSet(key, results)
    return results
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
    backcountry: t.backcountry === 'yes',
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

// --- Destinations for Quick Trip: state parks, national forests, big
// protected areas around a point (national parks come from the built-in
// dataset). Relations only, so we get whole parks rather than every sign.

export async function fetchNearbyDestinations(lat, lon, radiusMi, { signal } = {}) {
  const key = `dests:${lat.toFixed(1)},${lon.toFixed(1)},${radiusMi}`
  const hit = await cacheGet(key, 14 * DAY)
  if (hit) return hit
  return dedupe(key, async () => {
    // Built-in datasets already cover the big names instantly; this only
    // enriches with lesser-known state parks, capped small and short so it
    // never holds anything up.
    const r = Math.round(Math.min(radiusMi, 120) * 1609.34)
    const query = `[out:json][timeout:12];
relation["leisure"="nature_reserve"]["name"~"State Park",i](around:${r},${lat},${lon});
out center tags 60;`
    const els = await overpassRace(query, { signal, timeoutMs: 14000 })
    {
      const seen = new Set()
      const out = []
      for (const el of els) {
        const t = el.tags || {}
        const c = el.center
        if (!c || !t.name) continue
        // Collapse sub-units ("CRNRA - Island Ford Unit", "Foo SP - North Loop")
        // to their parent so one big park doesn't flood the list.
        const name = t.name.replace(/\s+[-–—]\s+.*$/, '').trim()
        const k = name.toLowerCase()
        if (seen.has(k)) continue
        // Skip things that aren't camping-trip destinations.
        if (/historic site|battlefield|memorial|monument|cemetery|historical park|visitor center/i.test(t.name)) continue
        seen.add(k)
        out.push({
          id: `${el.type}/${el.id}`,
          name,
          lat: c.lat,
          lon: c.lon,
          kind: classifyDestination({ ...t, name }),
          state: t['addr:state'] || null,
          website: t.website || '',
        })
      }
      await cacheSet(key, out)
      return out
    }
  })
}

function classifyDestination(t) {
  const n = (t.name || '').toLowerCase()
  if (/national park$/.test(n)) return 'national-park'
  if (/national forest|national grassland/.test(n)) return 'national-forest'
  if (/state park|state forest|state recreation/.test(n)) return 'state-park'
  if (/seashore|lakeshore|beach/.test(n)) return 'beach'
  return 'recreation'
}

// --- Nominatim place search ------------------------------------------------

export async function geocodePlace(query, { signal } = {}) {
  const q = query.trim()
  if (!q) return null
  const key = `geo:${q.toLowerCase()}`
  const hit = await cacheGet(key, 30 * DAY)
  if (hit !== undefined) return hit
  return dedupe(key, async () => {
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
        await cacheSet(key, result)
        return result
      }
    }
    await cacheSet(key, null)
    return null
  })
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
  const resp = await fetch(url, {
    signal: withTimeout(signal, 10000),
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) throw new Error('Place search is unavailable right now.')
  return resp.json()
}

function shortLabel(displayName) {
  const parts = (displayName || '').split(',').map((p) => p.trim())
  return parts.slice(0, 2).join(', ')
}

// Coordinates → a short place label ("Decatur, Georgia").
export async function reverseGeocode(lat, lon, { signal } = {}) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&lat=${lat}&lon=${lon}`
  const resp = await fetch(url, {
    signal: withTimeout(signal, 10000),
    headers: { Accept: 'application/json' },
  })
  if (!resp.ok) return null
  const data = await resp.json()
  const a = data.address || {}
  const town = a.city || a.town || a.village || a.county || ''
  const state = a.state || ''
  return [town, state].filter(Boolean).join(', ') || data.display_name?.split(',')[0] || null
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
