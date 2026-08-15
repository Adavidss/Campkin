// Booking hand-offs. Campkin has no booking engine — it gets you to the right
// reservation site with the campground name pre-searched. Every link is a
// plain https URL, no keys, no tracking.

import { normalizeUrl } from './maps.js'

function q(s) {
  return encodeURIComponent((s || '').trim())
}

// Best-guess where a campground is booked from its name/operator/website.
export function bookingLinks(cg) {
  const name = cg.name || ''
  const state = cg.state || cg.location || ''
  const lower = `${name} ${cg.operator || ''} ${cg.website || ''}`.toLowerCase()
  const links = []

  if (cg.website) {
    links.push({ id: 'site', label: 'Campground website', icon: 'globe', href: normalizeUrl(cg.website), primary: true })
  }

  const isFederal =
    /national (park|forest|recreation|seashore|lakeshore|monument)|nps\.gov|fs\.usda|blm|army corps|usace|recreation\.gov/.test(lower)
  const isKOA = /\bkoa\b/.test(lower)
  const isStatePark = /state park|state forest|state recreation|reserveamerica/.test(lower)

  const rec = { id: 'recgov', label: 'Recreation.gov', icon: 'external', href: `https://www.recreation.gov/search?q=${q(name)}` }
  const ra = { id: 'reserveamerica', label: 'ReserveAmerica', icon: 'external', href: `https://www.reserveamerica.com/explore/search?q=${q(name)}` }
  const koa = { id: 'koa', label: 'KOA', icon: 'external', href: `https://koa.com/campgrounds/search/?q=${q(name)}` }
  const hip = { id: 'hipcamp', label: 'Hipcamp', icon: 'external', href: `https://www.hipcamp.com/en-US/search?q=${q(name + (state ? ' ' + state : ''))}` }
  const camp = { id: 'campendium', label: 'Campendium reviews', icon: 'external', href: `https://www.campendium.com/search?q=${q(name)}` }
  const dyrt = { id: 'dyrt', label: 'The Dyrt', icon: 'external', href: `https://thedyrt.com/search?q=${q(name)}` }

  if (isKOA) links.push({ ...koa, primary: !cg.website })
  else if (isFederal) links.push({ ...rec, primary: !cg.website })
  else if (isStatePark) links.push({ ...ra, primary: !cg.website })

  // Always offer the general options too, minus any already added.
  for (const l of [rec, ra, koa, hip, camp, dyrt]) {
    if (!links.some((x) => x.id === l.id)) links.push(l)
  }
  return links
}

export function bookingPrimary(cg) {
  const links = bookingLinks(cg)
  return links.find((l) => l.primary) || links[0]
}
