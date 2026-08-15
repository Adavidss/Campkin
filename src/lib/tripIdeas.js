// Trip ideas: rank National Parks around a location as candidate RV trips,
// with visible reasoning — distance at RV pace, passport status, favorites.

import { NATIONAL_PARKS } from '../data/parks.js'
import { haversineMiles, roadMilesEstimate, driveTimeEstimate } from './geo.js'
import { stateName } from './states.js'

const MAX_RANGE_MI = 550 // roughly a long RV day, one-way

export function parkTripIdeas(center, parkRecords, { rvMode = true, limit = 6 } = {}) {
  const scored = []
  for (const park of NATIONAL_PARKS) {
    if (park.lat == null) continue
    const crow = haversineMiles(center, park)
    if (crow > 2000) continue // other side of an ocean, effectively
    const miles = roadMilesEstimate(center, park)
    const rec = parkRecords[park.id]
    const reasons = []
    let score = 0

    const time = driveTimeEstimate(miles, { rv: rvMode })
    if (miles <= 160) {
      score += 3
      reasons.push({ text: `An easy hop — about ${time}${rvMode ? ' at RV pace' : ''}`, tone: 'good' })
    } else if (miles <= 320) {
      score += 2.4
      reasons.push({ text: `A comfortable day's drive — about ${time}${rvMode ? ' at RV pace' : ''}`, tone: 'good' })
    } else if (miles <= MAX_RANGE_MI) {
      score += 1.4
      reasons.push({ text: `A long day or an overnight stop — about ${time}`, tone: 'info' })
    } else {
      score += 0.2
      reasons.push({ text: `A proper journey — about ${time} of driving`, tone: 'info' })
    }

    if (rec?.status === 'want') {
      score += 3
      reasons.push({ text: 'On your Want to Visit list', tone: 'good' })
    } else if (!rec?.status) {
      score += 1.5
      reasons.push({ text: 'A new stamp for your passport', tone: 'good' })
    } else if (rec?.status === 'visited') {
      score += 0.4
      reasons.push({
        text: rec.favorite ? 'A favorite — worth a return' : `You've been — return trip?`,
        tone: 'info',
      })
      if (rec.favorite) score += 1
    }

    scored.push({
      park,
      state: park.states.map((ab) => stateName(ab)).join(', '),
      miles,
      driveTime: time,
      status: rec?.status || null,
      favorite: !!rec?.favorite,
      score,
      reasons,
    })
  }

  scored.sort((a, b) => b.score - a.score || a.miles - b.miles)
  const inRange = scored.filter((i) => i.miles <= MAX_RANGE_MI)
  // If the area is park-sparse, still show the closest few honestly.
  return (inRange.length >= 3 ? inRange : scored).slice(0, limit)
}
