// U.S. states: names, abbreviations, and a tile-grid position (col,row) for the
// passport map. The grid is a classic square cartogram — geographically honest
// enough to read as the U.S. without any GIS complexity.

export const STATES = [
  { ab: 'AK', name: 'Alaska', col: 0, row: 0 },
  { ab: 'ME', name: 'Maine', col: 10, row: 0 },
  { ab: 'VT', name: 'Vermont', col: 9, row: 1 },
  { ab: 'NH', name: 'New Hampshire', col: 10, row: 1 },
  { ab: 'WA', name: 'Washington', col: 0, row: 2 },
  { ab: 'ID', name: 'Idaho', col: 1, row: 2 },
  { ab: 'MT', name: 'Montana', col: 2, row: 2 },
  { ab: 'ND', name: 'North Dakota', col: 3, row: 2 },
  { ab: 'MN', name: 'Minnesota', col: 4, row: 2 },
  { ab: 'WI', name: 'Wisconsin', col: 5, row: 2 },
  { ab: 'MI', name: 'Michigan', col: 7, row: 2 },
  { ab: 'NY', name: 'New York', col: 8, row: 2 },
  { ab: 'MA', name: 'Massachusetts', col: 9, row: 2 },
  { ab: 'RI', name: 'Rhode Island', col: 10, row: 2 },
  { ab: 'OR', name: 'Oregon', col: 0, row: 3 },
  { ab: 'NV', name: 'Nevada', col: 1, row: 3 },
  { ab: 'WY', name: 'Wyoming', col: 2, row: 3 },
  { ab: 'SD', name: 'South Dakota', col: 3, row: 3 },
  { ab: 'IA', name: 'Iowa', col: 4, row: 3 },
  { ab: 'IL', name: 'Illinois', col: 5, row: 3 },
  { ab: 'IN', name: 'Indiana', col: 6, row: 3 },
  { ab: 'OH', name: 'Ohio', col: 7, row: 3 },
  { ab: 'PA', name: 'Pennsylvania', col: 8, row: 3 },
  { ab: 'NJ', name: 'New Jersey', col: 9, row: 3 },
  { ab: 'CT', name: 'Connecticut', col: 10, row: 3 },
  { ab: 'CA', name: 'California', col: 0, row: 4 },
  { ab: 'UT', name: 'Utah', col: 1, row: 4 },
  { ab: 'CO', name: 'Colorado', col: 2, row: 4 },
  { ab: 'NE', name: 'Nebraska', col: 3, row: 4 },
  { ab: 'MO', name: 'Missouri', col: 4, row: 4 },
  { ab: 'KY', name: 'Kentucky', col: 5, row: 4 },
  { ab: 'WV', name: 'West Virginia', col: 6, row: 4 },
  { ab: 'VA', name: 'Virginia', col: 7, row: 4 },
  { ab: 'MD', name: 'Maryland', col: 8, row: 4 },
  { ab: 'DE', name: 'Delaware', col: 9, row: 4 },
  { ab: 'AZ', name: 'Arizona', col: 1, row: 5 },
  { ab: 'NM', name: 'New Mexico', col: 2, row: 5 },
  { ab: 'KS', name: 'Kansas', col: 3, row: 5 },
  { ab: 'AR', name: 'Arkansas', col: 4, row: 5 },
  { ab: 'TN', name: 'Tennessee', col: 5, row: 5 },
  { ab: 'NC', name: 'North Carolina', col: 6, row: 5 },
  { ab: 'SC', name: 'South Carolina', col: 7, row: 5 },
  { ab: 'OK', name: 'Oklahoma', col: 3, row: 6 },
  { ab: 'LA', name: 'Louisiana', col: 4, row: 6 },
  { ab: 'MS', name: 'Mississippi', col: 5, row: 6 },
  { ab: 'AL', name: 'Alabama', col: 6, row: 6 },
  { ab: 'GA', name: 'Georgia', col: 7, row: 6 },
  { ab: 'HI', name: 'Hawaii', col: 0, row: 7 },
  { ab: 'TX', name: 'Texas', col: 3, row: 7 },
  { ab: 'FL', name: 'Florida', col: 8, row: 7 },
]

export const STATE_BY_AB = Object.fromEntries(STATES.map((s) => [s.ab, s]))

const NAME_TO_AB = Object.fromEntries(
  STATES.map((s) => [s.name.toLowerCase(), s.ab])
)

const TERRITORIES = { AS: 'American Samoa', VI: 'U.S. Virgin Islands', PR: 'Puerto Rico', GU: 'Guam', DC: 'Washington, D.C.' }

export function stateName(ab) {
  return STATE_BY_AB[ab]?.name || TERRITORIES[ab] || ab || ''
}

// Best-effort extraction of a state from free text like "Luray, VA",
// "Shenandoah National Park, Virginia", or "Moab UT".
export function parseStateFrom(text) {
  if (!text) return null
  const t = text.trim()
  // Trailing 2-letter abbreviation, tolerating zip codes and country suffixes:
  // "..., VA" / "... VA" / "... NC 28806" / "... VA, USA"
  const abMatch = t.match(
    /[,\s]([A-Za-z]{2})\.?(?:[,\s]+\d{5}(?:-\d{4})?)?(?:,?\s*(?:USA|U\.S\.A\.|United States))?\s*$/
  )
  if (abMatch) {
    const ab = abMatch[1].toUpperCase()
    if (STATE_BY_AB[ab]) return ab
  }
  // Full state name anywhere (prefer the longest match: "West Virginia" over "Virginia")
  const lower = t.toLowerCase()
  let found = null
  for (const s of STATES) {
    const name = s.name.toLowerCase()
    if (lower.includes(name)) {
      if (!found || name.length > found.name.length) found = { name, ab: s.ab }
    }
  }
  return found ? found.ab : null
}
