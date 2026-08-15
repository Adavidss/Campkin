// Wikipedia summaries — photo + first paragraph + link — for parks, sights,
// campgrounds and towns. Keyless, CORS-open, cached for a month.
//   • Prefer an explicit OSM `wikipedia=en:Title` tag (exact article).
//   • Fall back to a title search for anything else (state parks, towns).

import { cacheGet, cacheSet, dedupe, DAY } from './netcache.js'

const TTL = 30 * DAY
const HEADERS = { Accept: 'application/json', 'Api-User-Agent': 'Campkin/1.0 (https://www.kidsdc.org/Campkin/)' }

// Turn an OSM wikipedia tag ("en:Great Smoky Mountains National Park") into a title.
export function wikiTitleFromTag(tag) {
  if (!tag) return null
  const m = String(tag).match(/^(?:([a-z]{2,3}):)?(.+)$/)
  if (!m) return null
  if (m[1] && m[1] !== 'en') return null // only English articles
  return m[2].trim()
}

async function fetchSummaryByTitle(title, signal) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`
  const resp = await fetch(url, { headers: HEADERS, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) })
  if (!resp.ok) return null
  const d = await resp.json()
  if (!d || d.type === 'disambiguation' || !d.extract) return null
  // Use the summary's own thumbnail URL for both sizes — it's guaranteed to
  // resolve (Commons rejects some rewritten widths), and 320px is plenty for
  // a phone-width hero. Never the multi-megabyte original.
  const thumb = d.thumbnail?.source || null
  const image = thumb
  return {
    title: d.title,
    extract: d.extract,
    thumb,
    image,
    url: d.content_urls?.mobile?.page || d.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(d.title)}`,
  }
}

// Search when we don't know the exact title. Biased toward parks/places.
async function searchTitle(query, signal) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=1&srsearch=${encodeURIComponent(query)}`
  const resp = await fetch(url, { headers: HEADERS, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(8000)]) : AbortSignal.timeout(8000) })
  if (!resp.ok) return null
  const d = await resp.json()
  return d?.query?.search?.[0]?.title || null
}

// Get a summary for a thing. `hint` = { wikipedia?: 'en:Title', name, state?, kind? }
// Hits are cached for a month; confirmed "no article" for a day; network
// failures are never cached (a blip must not blank a place for weeks).
const MISS = { none: true }
export async function wikiSummary(hint, { signal } = {}) {
  const exact = wikiTitleFromTag(hint.wikipedia)
  const key = `wiki:${exact ? 't:' + exact.toLowerCase() : 'q:' + `${hint.name} ${hint.state || ''} ${hint.kind || ''}`.trim().toLowerCase()}`
  const hit = await cacheGet(key, TTL)
  if (hit && !hit.none) return hit // a real article
  if (hit && hit.none) {
    // A recorded miss: honor it for a day, then look again.
    const fresh = await cacheGet(key, DAY)
    if (fresh) return null
  }
  return lookup()

  function lookup() {
    return dedupe(key, async () => {
      let result = null
      let failed = false
      try {
        if (exact) result = await fetchSummaryByTitle(exact, signal)
        // Most parks, landmarks and towns are exact article titles — try that
        // before searching (it's one cheap request and far more precise).
        if (!result && hint.name) result = await fetchSummaryByTitle(hint.name, signal)
        if (!result && hint.name && hint.kind && !hint.name.toLowerCase().includes(hint.kind.toLowerCase())) {
          result = await fetchSummaryByTitle(`${hint.name} ${hint.kind}`, signal)
        }
        if (!result && hint.name) {
          // Search with context so "Big Meadows" finds the campground, not a farm
          // (without repeating words the name already contains).
          const extra = [hint.kind, hint.state].filter((x) => x && !hint.name.toLowerCase().includes(String(x).toLowerCase()))
          const q = [hint.name, ...extra].join(' ')
          const title = await searchTitle(q, signal)
          if (title) {
            const s = await fetchSummaryByTitle(title, signal)
            // Guard against wildly wrong matches: the article title should share
            // a meaningful word with the name we asked about.
            if (s && sharesWord(hint.name, s.title)) result = s
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') throw err
        failed = true
      }
      if (result) await cacheSet(key, result)
      else if (!failed) await cacheSet(key, MISS)
      return result
    })
  }
}

function sharesWord(a, b) {
  const stop = new Set(['the', 'of', 'and', 'state', 'park', 'national', 'campground', 'area', 'recreation', 'forest', 'lake', 'river', 'mountain', 'mountains', 'creek', 'falls', 'point', 'trail', 'overlook', 'rv', 'resort', 'camp'])
  const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !stop.has(w)))
  const wa = words(a)
  const wb = words(b)
  for (const w of wa) if (wb.has(w)) return true
  return false
}
