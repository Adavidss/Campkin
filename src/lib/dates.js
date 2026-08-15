// Date helpers. All app dates are date-only ISO strings (YYYY-MM-DD) and are
// always parsed as *local* dates to avoid off-by-one timezone surprises.

export function parseISO(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

export function toISO(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function todayISO() {
  return toISO(new Date())
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function fmtDate(iso, { year = true } = {}) {
  const d = parseISO(iso)
  if (!d) return ''
  const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`
  return year ? `${base}, ${d.getFullYear()}` : base
}

export function fmtShortDate(iso) {
  const d = parseISO(iso)
  if (!d) return ''
  return `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}, ${d.getFullYear()}`
}

// "October 12–15, 2026", "April 29 – May 2, 2027", "Dec 30, 2026 – Jan 2, 2027"
export function fmtRange(startISO, endISO) {
  const s = parseISO(startISO)
  const e = parseISO(endISO)
  if (!s && !e) return ''
  if (!e || !s) return fmtDate(startISO || endISO)
  if (s.getFullYear() === e.getFullYear()) {
    if (s.getMonth() === e.getMonth()) {
      if (s.getDate() === e.getDate()) return fmtDate(startISO)
      return `${MONTHS[s.getMonth()]} ${s.getDate()}–${e.getDate()}, ${s.getFullYear()}`
    }
    return `${MONTHS[s.getMonth()]} ${s.getDate()} – ${MONTHS[e.getMonth()]} ${e.getDate()}, ${s.getFullYear()}`
  }
  return `${fmtShortDate(startISO)} – ${fmtShortDate(endISO)}`
}

export function daysBetween(aISO, bISO) {
  const a = parseISO(aISO)
  const b = parseISO(bISO)
  if (!a || !b) return 0
  return Math.round((b - a) / 86400000)
}

// Positive when the date is in the future.
export function daysUntil(iso) {
  return daysBetween(todayISO(), iso)
}

export function nightsOf(trip) {
  if (!trip.startDate || !trip.endDate) return 0
  return Math.max(0, daysBetween(trip.startDate, trip.endDate))
}

export function countdownLabel(iso) {
  const n = daysUntil(iso)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n > 1) return `${n} days away`
  return null
}

// Friday→Sunday of the current or a following weekend (already-started
// weekends begin today).
export function weekendOf(offsetWeeks = 0) {
  const now = new Date()
  const day = now.getDay() // 0 Sun … 6 Sat
  let toFriday = (5 - day + 7) % 7
  if (day === 6 || day === 0) toFriday = day === 6 ? -1 : -2 // mid-weekend
  const fri = new Date(now)
  fri.setDate(now.getDate() + toFriday + offsetWeeks * 7)
  const start = offsetWeeks === 0 && fri < now ? now : fri
  const sun = new Date(fri)
  sun.setDate(fri.getDate() + 2)
  return { start: toISO(start), end: toISO(sun) }
}

// "3:00 PM" from "15:00"
export function fmtTime(hhmm) {
  if (!hhmm) return ''
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h)) return hhmm
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m || 0).padStart(2, '0')} ${ampm}`
}
