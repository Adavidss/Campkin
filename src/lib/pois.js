// Sights & food discovery via Overpass — keyless, scored, with visible
// reasons. A wikipedia/wikidata tag is the strongest "actually worth it"
// signal OSM has; the rest is honest heuristics.

import { haversineMiles, formatMiles } from './geo.js'

function withTimeout(signal, ms) {
  const timeout = AbortSignal.timeout(ms)
  return signal ? AbortSignal.any([signal, timeout]) : timeout
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

const cache = new Map()

export async function fetchPOIs(kind, lat, lon, radiusMi, { signal } = {}) {
  const key = `${kind}:${lat.toFixed(3)},${lon.toFixed(3)},${radiusMi}`
  if (cache.has(key)) return cache.get(key)
  const r = Math.round(radiusMi * 1609.34)
  const query =
    kind === 'food'
      ? `[out:json][timeout:20];
nwr["amenity"~"^(restaurant|cafe)$"]["name"](around:${r},${lat},${lon});
out center tags 120;`
      : `[out:json][timeout:20];
nwr["tourism"~"^(attraction|viewpoint|museum)$"]["name"](around:${r},${lat},${lon});
out center tags 80;
nwr["historic"~"^(monument|memorial|fort|castle|ruins|archaeological_site|ship|lighthouse)$"]["name"](around:${r},${lat},${lon});
out center tags 40;
nwr["natural"~"^(waterfall|arch|hot_spring)$"]["name"](around:${r},${lat},${lon});
out center tags 40;`

  let lastErr = null
  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: withTimeout(signal, 20000),
      })
      if (!resp.ok) throw new Error(`Overpass ${resp.status}`)
      const data = await resp.json()
      const out = (data.elements || []).map((el) => parsePOI(el, kind)).filter(Boolean)
      cache.set(key, out)
      return out
    } catch (err) {
      if (err.name === 'AbortError' && signal?.aborted) throw err
      lastErr = err
    }
  }
  throw new Error('The discovery service is busy — try again in a moment.', { cause: lastErr })
}

function parsePOI(el, kind) {
  const t = el.tags || {}
  const lat = el.lat ?? el.center?.lat
  const lon = el.lon ?? el.center?.lon
  if (lat == null || !t.name) return null
  return {
    id: `${el.type}/${el.id}`,
    name: t.name,
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

function prettyCuisine(c) {
  return c
    .split(';')[0]
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (m) => m.toUpperCase())
}

export function poiIcon(p) {
  if (p.kind === 'food') return 'food'
  if (p.natural === 'peak') return 'mountains'
  if (p.natural === 'waterfall' || p.natural === 'hot_spring') return 'waves'
  if (p.natural === 'arch') return 'arch'
  if (p.tourism === 'viewpoint') return 'camera'
  if (p.tourism === 'museum') return 'column'
  if (p.historic) return 'landmark'
  return 'sparkle'
}

export function poiTypeLabel(p) {
  if (p.kind === 'food') {
    const base = p.amenity === 'cafe' ? 'Café' : 'Restaurant'
    return p.cuisine ? `${base} · ${prettyCuisine(p.cuisine)}` : base
  }
  if (p.natural === 'peak') return 'Summit'
  if (p.natural === 'waterfall') return 'Waterfall'
  if (p.natural === 'hot_spring') return 'Hot spring'
  if (p.natural === 'arch') return 'Natural arch'
  if (p.tourism === 'viewpoint') return 'Viewpoint'
  if (p.tourism === 'museum') return 'Museum'
  if (p.historic) return 'Historic site'
  if (p.tourism === 'attraction') return 'Attraction'
  return 'Sight'
}

export function scorePOI(p, center) {
  let score = 0
  const reasons = []
  const push = (text, tone = 'good') => reasons.push({ text, tone })

  if (p.wiki) {
    score += 2.5
    push(p.kind === 'food' ? 'Locally famous — has a Wikipedia page' : 'A known landmark — has a Wikipedia page')
  }
  if (p.kind === 'food') {
    if (p.cuisine) {
      score += 1
      push(prettyCuisine(p.cuisine))
    }
    if (p.outdoor) {
      score += 0.7
      push('Outdoor seating')
    }
    if (p.website || p.phone) {
      score += 0.5
      push('Easy to look up', 'info')
    }
  } else {
    if (p.tourism === 'viewpoint') {
      score += 1.5
      push('Scenic viewpoint')
    }
    if (p.natural === 'waterfall') {
      score += 1.6
      push('Waterfall')
    }
    if (p.natural === 'peak') {
      score += 1
      push(p.ele ? `Summit — ${p.ele.toLocaleString()} ft` : 'Summit')
    }
    if (p.tourism === 'museum') {
      score += 1
      push('Museum — good rainy-day stop', 'info')
    }
    if (p.historic) {
      score += 0.8
      push('A piece of history', 'info')
    }
    if (p.fee === false) {
      score += 0.3
      push('Free', 'info')
    }
  }
  const d = haversineMiles(center, p)
  score += Math.max(0, 1.6 - d / 6)
  push(`${formatMiles(d)} away`, 'info')
  return { ...p, distance: d, score, reasons }
}

export function topPOIs(pois, center, n = 6) {
  const seen = new Set()
  return pois
    .map((p) => scorePOI(p, center))
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .filter((p) => {
      const k = p.name.toLowerCase()
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, n)
}
