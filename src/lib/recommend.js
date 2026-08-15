// Ranked campground recommendations with human-readable reasoning.
// Deterministic scoring over OpenStreetMap facts + the user's rig profile —
// every point a pick earns shows up as a visible reason, so the ranking is
// never a black box.

import { rvFit, formatMiles } from './geo.js'

// tone: 'good' (counts for it), 'warn' (worth knowing), 'info' (neutral fact)
function reason(text, tone = 'good') {
  return { text, tone }
}

// OSM sometimes has individual pitches mapped as their own "campground"
// ("Site 19", "Designated Campsite #6"). Fine on the map, but never a
// recommendation — and neither is an unnamed spot nobody can look up or call.
const PITCH_NAME = /(?:^|\s)(?:camp)?(?:site|pitch|spot|space|lot)\s*#?\d+[a-z]?$/i
const GENERIC_NAME = /^(campground|rv park)$/i

export function scoreCampground(r, { rvLen = null, rvMode = true } = {}) {
  const name = (r.name || '').trim()
  if (PITCH_NAME.test(name) || GENERIC_NAME.test(name)) return null

  let score = 0
  const reasons = []

  // --- RV suitability ------------------------------------------------------
  if (rvMode) {
    if (r.kind === 'rv-park') {
      score += 3
      reasons.push(reason('Dedicated RV park'))
    } else if (r.caravans === 'yes') {
      score += 2
      reasons.push(reason('RV sites listed'))
    } else if (r.caravans === 'no') {
      return null // not an RV option at all
    } else {
      score -= 0.5
      reasons.push(reason('RV suitability not listed — call ahead', 'warn'))
    }

    const fit = rvFit(r.maxLengthFt, rvLen)
    if (fit === 'fits') {
      score += 2
      reasons.push(reason(`Fits your ${rvLen} ft rig (max ${r.maxLengthFt} ft)`))
    } else if (fit === 'tight') {
      score += 0.5
      reasons.push(reason(`Tight for your ${rvLen} ft rig (max ${r.maxLengthFt} ft)`, 'warn'))
    } else if (fit === 'no') {
      score -= 3
      reasons.push(reason(`Max ${r.maxLengthFt} ft — under your ${rvLen} ft rig`, 'warn'))
    } else if (fit === 'unknown' && (r.kind === 'rv-park' || r.caravans === 'yes')) {
      reasons.push(reason('No length limit listed', 'info'))
    }
  } else {
    if (r.tents === 'yes') {
      score += 1.5
      reasons.push(reason('Tent camping'))
    }
    if (r.kind === 'rv-park' && r.tents !== 'yes') {
      score -= 1
      reasons.push(reason('RV park — may not take tents', 'warn'))
    }
  }

  // --- amenities -----------------------------------------------------------
  if (r.power) {
    score += 1.5
    reasons.push(reason('Electric hookups'))
  }
  if (r.dump) {
    score += 1.5
    reasons.push(reason('Dump station'))
  }
  if (r.water) {
    score += 1
    reasons.push(reason('Drinking water'))
  }
  if (r.fee === false) {
    score += 0.5
    reasons.push(reason('No fee listed'))
  }
  if (r.phone || r.website) {
    score += 0.5
    reasons.push(reason(r.phone ? 'Phone listed' : 'Website listed', 'info'))
  }
  if (r.reservation === 'required') {
    reasons.push(reason('Reservations required', 'info'))
  }

  // --- distance: closer is better, gently ---------------------------------
  const d = r.distance ?? 0
  score += Math.max(0, 2.5 - d / 8)
  reasons.push(reason(`${formatMiles(d)} away`, 'info'))

  // A real name suggests a real, findable operation.
  if (r.name && !/^(campground|rv park)$/i.test(r.name)) score += 0.5

  return { ...r, score, reasons }
}

export function topPicks(results, opts, n = 5) {
  return results
    .map((r) => scoreCampground(r, opts))
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.distance - b.distance)
    .slice(0, n)
}
