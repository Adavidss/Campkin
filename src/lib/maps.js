// External map launchers — Campkin has no routing engine of its own.

export function appleMapsDirections(destination, from) {
  const p = new URLSearchParams()
  p.set('daddr', destination)
  if (from) p.set('saddr', from)
  return `https://maps.apple.com/?${p.toString()}`
}

export function googleMapsDirections(destination, from) {
  const p = new URLSearchParams()
  p.set('api', '1')
  p.set('destination', destination)
  if (from) p.set('origin', from)
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

export function appleMapsSearch(query) {
  return `https://maps.apple.com/?q=${encodeURIComponent(query)}`
}

export function googleMapsSearch(query) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

export function telHref(phone) {
  return `tel:${(phone || '').replace(/[^+\d]/g, '')}`
}

export function normalizeUrl(url) {
  if (!url) return ''
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}
