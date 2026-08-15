import { uid } from '../lib/util.js'
import { todayISO } from '../lib/dates.js'

export const SCHEMA_VERSION = 1

export const PLACE_CATEGORIES = [
  { id: 'national-park', label: 'National Park', icon: 'mountains', ink: 'pine' },
  { id: 'state-park', label: 'State Park', icon: 'forest', ink: 'sage' },
  { id: 'campground', label: 'Campground', icon: 'tent', ink: 'clay' },
  { id: 'city', label: 'City / Town', icon: 'town', ink: 'blue' },
  { id: 'landmark', label: 'Landmark', icon: 'landmark', ink: 'charcoal' },
  { id: 'scenic-drive', label: 'Scenic Drive', icon: 'road', ink: 'pine' },
  { id: 'food', label: 'Food & Drink', icon: 'food', ink: 'clay' },
  { id: 'beach', label: 'Beach', icon: 'waves', ink: 'blue' },
  { id: 'historic-site', label: 'Historic Site', icon: 'column', ink: 'clay' },
  { id: 'other', label: 'Other', icon: 'pin', ink: 'sage' },
]

export const CATEGORY_BY_ID = Object.fromEntries(PLACE_CATEGORIES.map((c) => [c.id, c]))

export const HOOKUP_TYPES = [
  'Full Hookups',
  'Electric + Water',
  'Electric',
  'Dry Camping',
  'Other',
]

export const WOULD_RETURN = [
  { id: 'definitely', label: 'Definitely' },
  { id: 'maybe', label: 'Maybe' },
  { id: 'probably-not', label: 'Probably Not' },
]

export function newTrip(fields) {
  const now = new Date().toISOString()
  return {
    id: uid(),
    name: '',
    destination: '',
    startDate: '',
    endDate: '',
    completed: false,
    completedAt: null,
    campgroundId: null,
    siteNumber: '',
    reservation: '',
    checkIn: '',
    checkOut: '',
    route: null, // { from, to, miles, driveTime, notes }
    checklist: [], // [{ id, cat, label, done, custom }]
    notes: '',
    rememberNextTime: '',
    // recap
    rating: 0,
    wouldReturn: null,
    favoritePart: '',
    favoriteMeal: '',
    favoritePlace: '',
    memory: '',
    favorite: false,
    coverPhotoId: null,
    sample: false,
    createdAt: now,
    updatedAt: now,
    ...fields,
  }
}

export function newCampground(fields) {
  return {
    id: uid(),
    name: '',
    location: '', // "Shenandoah National Park, VA"
    address: '',
    website: '',
    phone: '',
    hookups: '',
    lat: null,
    lon: null,
    osmId: null, // set when saved from the Find Nearby map
    rvMaxLengthFt: null,
    rating: 0,
    favorite: false,
    returnSomeday: false,
    notes: '',
    sample: false,
    createdAt: new Date().toISOString(),
    ...fields,
  }
}

export function newPlace(fields) {
  return {
    id: uid(),
    name: '',
    category: 'other',
    state: null, // "VA"
    city: '',
    address: '',
    notes: '',
    dateVisited: todayISO(),
    tripId: null,
    favorite: false,
    returnSomeday: false,
    visited: true, // false = saved for later ("things to do" not yet done)
    source: 'manual', // 'manual' | 'park' | 'campground'
    refId: null, // parkId or campgroundId when derived
    sample: false,
    createdAt: new Date().toISOString(),
    ...fields,
  }
}

export function newParkRecord(parkId, fields) {
  return {
    id: parkId,
    status: null, // 'visited' | 'want' | null
    favorite: false,
    visits: [], // [{ date, tripId }]
    sample: false,
    ...fields,
  }
}

export function defaultSettings() {
  return {
    key: 'settings',
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    savedChecklistItems: [], // [{ cat, label }] — custom items reused on new trips
    statesAdded: [], // manual corrections
    statesRemoved: [],
    theme: 'auto',
    mapDark: null, // null = follow app theme; true/false = explicit map style
    rvMode: true, // Campkin is RV-first; turn off for tent trips
    rv: { type: 'travel-trailer', lengthFt: '', heightFt: '' },
  }
}

// Trip status is derived, not stored: completing is the only explicit act.
export function tripStatus(trip, today = todayISO()) {
  if (trip.completed) return 'completed'
  if (trip.startDate && trip.endDate) {
    if (trip.startDate <= today && today <= trip.endDate) return 'active'
    if (trip.endDate < today) return 'past-due' // over, but not completed yet
  }
  return 'planned'
}

// Forward-compatible per-record normalization: fill any fields missing from
// records written by older versions of Campkin.
export function normalizeTrip(t) { return { ...newTrip({}), ...t } }
export function normalizeCampground(c) { return { ...newCampground({}), ...c } }
export function normalizePlace(p) { return { ...newPlace({}), ...p } }
export function normalizeParkRecord(r) { return { ...newParkRecord(r.id), ...r } }
