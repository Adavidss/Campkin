// Booking hand-offs. Campkin has no booking engine — it gets you to the right
// reservation page with the campground already searched.
//
// Every URL pattern here was verified against the live site (2026-08):
//   • recreation.gov/search?q=…            → real results, "Book Online"
//   • koa.com/search/?q=…                  → real results
//   • thedyrt.com/search?q=…               → real results
//   • reserveamerica.com, hipcamp.com, campendium.com ignore query params or
//     404 on search paths, so those go through a site-scoped web search that
//     always lands on the campground's actual page.

import { normalizeUrl } from './maps.js'

const q = (s) => encodeURIComponent((s || '').trim())

// Web search scoped to one site — dependable when a site has no linkable search.
function siteSearch(site, terms) {
  return `https://www.google.com/search?q=${q(`site:${site} ${terms}`)}`
}

export function bookingLinks(cg) {
  const name = (cg.name || '').trim()
  const place = cg.state || cg.location || ''
  const terms = place ? `${name} ${place}` : name
  const lower = `${name} ${cg.operator || ''} ${cg.website || ''}`.toLowerCase()

  const isKOA = /\bkoa\b/.test(lower)
  const isFederal = /national (park|forest|recreation|seashore|lakeshore|monument|grassland)|nps\.gov|fs\.usda|blm|army corps|usace|recreation\.gov|corps of engineers/.test(lower)
  const isStatePark = /state park|state forest|state recreation|state beach|reserveamerica/.test(lower)

  const site = cg.website
    ? { id: 'site', label: 'Campground website', sub: 'Book direct', icon: 'globe', href: normalizeUrl(cg.website) }
    : null
  const rec = { id: 'recgov', label: 'Recreation.gov', sub: 'Federal campgrounds — parks, forests, Corps lakes', icon: 'external', href: `https://www.recreation.gov/search?inventory_type=camping&q=${q(name)}` }
  const koa = { id: 'koa', label: 'KOA', sub: 'Kampgrounds of America', icon: 'external', href: `https://koa.com/search/?q=${q(name)}` }
  const ra = { id: 'reserveamerica', label: 'ReserveAmerica', sub: 'Most state parks', icon: 'external', href: siteSearch('reserveamerica.com', terms) }
  const dyrt = { id: 'dyrt', label: 'The Dyrt', sub: 'Reviews, photos & booking', icon: 'external', href: `https://thedyrt.com/search?q=${q(name)}` }
  const hip = { id: 'hipcamp', label: 'Hipcamp', sub: 'Private land, ranches, glamping', icon: 'external', href: siteSearch('hipcamp.com', terms) }
  const camp = { id: 'campendium', label: 'Campendium', sub: 'RV-focused reviews & cell coverage', icon: 'external', href: siteSearch('campendium.com', terms) }
  const web = { id: 'web', label: 'Search the web', sub: `“${name} reservations”`, icon: 'search', href: `https://www.google.com/search?q=${q(`${terms} campground reservations`)}` }

  // Ordered: the likely-right one first, marked primary.
  let ordered
  if (isKOA) ordered = [koa, dyrt, camp, web]
  else if (isFederal) ordered = [rec, dyrt, camp, web]
  else if (isStatePark) ordered = [ra, rec, dyrt, camp, web]
  else ordered = [dyrt, rec, ra, hip, camp, web]

  const links = site ? [site, ...ordered] : ordered
  return links.map((l, i) => ({ ...l, primary: i === 0 }))
}

export function bookingPrimary(cg) {
  return bookingLinks(cg)[0]
}
