// Distance & drive-time helpers. Estimates only — Campkin is a planner, not a
// navigation engine; real directions always open in Apple/Google Maps.

export function haversineMiles(a, b) {
  const R = 3958.8
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(s))
}

// Straight-line → road distance: interstates wander ~25% beyond the crow.
const ROAD_FACTOR = 1.27

export function roadMilesEstimate(a, b) {
  return Math.round(haversineMiles(a, b) * ROAD_FACTOR)
}

// RVs cruise slower and stop more often than cars.
export function driveTimeEstimate(miles, { rv = true } = {}) {
  const mph = rv ? 50 : 58
  const hours = miles / mph
  return formatHours(hours)
}

export function formatHours(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function formatMiles(mi) {
  if (mi < 10) return `${mi.toFixed(1)} mi`
  return `${Math.round(mi)} mi`
}

// Parse an OSM maxlength value (usually meters, sometimes "40 ft" / "40'").
export function parseMaxLengthFt(value) {
  if (value == null || value === '') return null
  const s = String(value).trim().toLowerCase()
  const num = parseFloat(s.replace(',', '.'))
  if (Number.isNaN(num)) return null
  if (s.includes('ft') || s.includes("'")) return Math.round(num)
  if (s.includes('m') && !s.includes('mi')) return Math.round(num * 3.28084)
  // Bare numbers in OSM are meters.
  return Math.round(num * 3.28084)
}

export const RV_TYPES = [
  { id: 'travel-trailer', label: 'Travel Trailer' },
  { id: 'fifth-wheel', label: 'Fifth Wheel' },
  { id: 'class-a', label: 'Class A' },
  { id: 'class-b', label: 'Class B / Campervan' },
  { id: 'class-c', label: 'Class C' },
  { id: 'popup', label: 'Pop-up' },
  { id: 'truck-camper', label: 'Truck Camper' },
  { id: 'other', label: 'Other' },
]

export function rvTypeLabel(id) {
  return RV_TYPES.find((t) => t.id === id)?.label || ''
}

// How a campground relates to an RV of `lengthFt`: 'fits' | 'tight' | 'no' |
// 'unknown' (no length data listed).
export function rvFit(maxLengthFt, lengthFt) {
  if (!lengthFt) return null
  if (maxLengthFt == null) return 'unknown'
  if (maxLengthFt >= lengthFt) return 'fits'
  if (maxLengthFt >= lengthFt - 3) return 'tight'
  return 'no'
}
