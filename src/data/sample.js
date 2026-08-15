// Optional sample data so Campkin never has to feel empty while exploring.
// Every record carries `sample: true` and a stable prefixed id, so removing
// sample data is exact and re-adding it never duplicates.

import { newTrip, newCampground, newPlace, newParkRecord } from './model.js'
import { defaultChecklist } from './checklists.js'
import { todayISO, toISO, parseISO } from '../lib/dates.js'

export const SAMPLE_PREFIX = 'sample-'

function plusDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

export function buildSampleData() {
  const today = todayISO()

  // --- Shenandoah Weekend (completed) --------------------------------------
  const bigMeadows = newCampground({
    id: SAMPLE_PREFIX + 'cg-big-meadows',
    name: 'Big Meadows Campground',
    location: 'Shenandoah National Park, VA',
    address: 'Mile 51.2 Skyline Drive, Stanley, VA 22851',
    phone: '(540) 999-3500',
    website: 'https://www.nps.gov/shen',
    hookups: 'Dry Camping',
    lat: 38.5215,
    lon: -78.4383,
    rating: 5,
    favorite: true,
    sample: true,
  })

  const shenandoah = newTrip({
    id: SAMPLE_PREFIX + 'trip-shenandoah',
    name: 'Shenandoah Weekend',
    destination: 'Shenandoah National Park, VA',
    startDate: '2025-10-12',
    endDate: '2025-10-15',
    completed: true,
    completedAt: '2025-10-15T21:00:00.000Z',
    campgroundId: bigMeadows.id,
    siteNumber: 'A32',
    checkIn: '13:00',
    checkOut: '12:00',
    route: {
      from: 'Home',
      to: 'Big Meadows Campground, Skyline Drive, VA',
      miles: '96',
      driveTime: '2h 15m',
      notes: 'Take 211 through Sperryville — the overlook pull-offs start right after the entrance station.',
    },
    checklist: defaultChecklist().map((i) => ({ ...i, done: true })),
    rating: 4,
    wouldReturn: 'definitely',
    favoritePart: 'Watching the sunset from the meadow behind the campground.',
    favoriteMeal: 'Blackberry milkshake at Big Meadows Wayside',
    favoritePlace: 'Skyline Drive',
    memory: 'A doe and two fawns wandered through the site both mornings while the coffee brewed.',
    rememberNextTime: 'Site A32 is close to the meadow but gets morning sun — Site 42 has more shade.',
    sample: true,
  })

  // --- Outer Banks Escape (completed) ---------------------------------------
  const oregonInlet = newCampground({
    id: SAMPLE_PREFIX + 'cg-oregon-inlet',
    name: 'Oregon Inlet Campground',
    location: 'Cape Hatteras National Seashore, NC',
    address: '12001 NC-12, Nags Head, NC 27959',
    phone: '(252) 473-2111',
    hookups: 'Electric + Water',
    lat: 35.7962,
    lon: -75.5462,
    rating: 4,
    returnSomeday: true,
    sample: true,
  })

  const outerBanks = newTrip({
    id: SAMPLE_PREFIX + 'trip-outer-banks',
    name: 'Outer Banks Escape',
    destination: 'Cape Hatteras, NC',
    startDate: '2026-05-06',
    endDate: '2026-05-11',
    completed: true,
    completedAt: '2026-05-11T20:00:00.000Z',
    campgroundId: oregonInlet.id,
    siteNumber: 'B14',
    checklist: defaultChecklist().map((i) => ({ ...i, done: true })),
    rating: 5,
    wouldReturn: 'definitely',
    favoritePart: 'Empty beach at sunrise, coffee on the dunes.',
    favoritePlace: 'Cape Hatteras Lighthouse',
    memory: 'Climbed all 257 steps of the lighthouse, then watched wild horses from the beach road.',
    rememberNextTime: 'Book the ocean-side loop earlier — it fills months out.',
    favorite: true,
    sample: true,
  })

  // --- Acadia in the Fall (upcoming, relative to today) ----------------------
  const narrows = newCampground({
    id: SAMPLE_PREFIX + 'cg-narrows',
    name: 'Mount Desert Narrows Campground',
    location: 'Bar Harbor, ME',
    address: '1219 State Hwy 3, Bar Harbor, ME 04609',
    phone: '(207) 288-4782',
    hookups: 'Full Hookups',
    lat: 44.4284,
    lon: -68.3542,
    sample: true,
  })

  const acadiaStart = plusDays(today, 40)
  const acadia = newTrip({
    id: SAMPLE_PREFIX + 'trip-acadia',
    name: 'Acadia in the Fall',
    destination: 'Bar Harbor, ME',
    startDate: acadiaStart,
    endDate: plusDays(acadiaStart, 5),
    campgroundId: narrows.id,
    siteNumber: '14',
    reservation: 'MDN-88214',
    checkIn: '14:00',
    checkOut: '11:00',
    checklist: defaultChecklist(),
    notes: 'Aim to arrive before dark — the causeway views deserve daylight.',
    sample: true,
  })

  // --- Places & passport stamps ----------------------------------------------
  const places = [
    newPlace({
      id: SAMPLE_PREFIX + 'place-shen-park',
      name: 'Shenandoah',
      category: 'national-park',
      state: 'VA',
      dateVisited: '2025-10-13',
      tripId: shenandoah.id,
      source: 'park',
      refId: 'shenandoah',
      favorite: true,
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-skyline',
      name: 'Skyline Drive',
      category: 'scenic-drive',
      state: 'VA',
      dateVisited: '2025-10-13',
      tripId: shenandoah.id,
      notes: 'All 105 miles, stopping at far too many overlooks.',
      favorite: true,
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-front-royal',
      name: 'Front Royal',
      category: 'city',
      state: 'VA',
      dateVisited: '2025-10-15',
      tripId: shenandoah.id,
      notes: 'Good coffee at the little roastery on Main Street.',
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-big-meadows',
      name: 'Big Meadows Campground',
      category: 'campground',
      state: 'VA',
      dateVisited: '2025-10-15',
      tripId: shenandoah.id,
      source: 'campground',
      refId: bigMeadows.id,
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-hatteras-light',
      name: 'Cape Hatteras Lighthouse',
      category: 'landmark',
      state: 'NC',
      dateVisited: '2026-05-08',
      tripId: outerBanks.id,
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-ocracoke',
      name: 'Ocracoke',
      category: 'city',
      state: 'NC',
      dateVisited: '2026-05-09',
      tripId: outerBanks.id,
      notes: 'Took the free ferry over — worth the wait.',
      sample: true,
    }),
    newPlace({
      id: SAMPLE_PREFIX + 'place-oregon-inlet',
      name: 'Oregon Inlet Campground',
      category: 'campground',
      state: 'NC',
      dateVisited: '2026-05-11',
      tripId: outerBanks.id,
      source: 'campground',
      refId: oregonInlet.id,
      sample: true,
    }),
  ]

  const parks = [
    newParkRecord('shenandoah', {
      status: 'visited',
      visits: [{ date: '2025-10-13', tripId: shenandoah.id }],
      favorite: true,
      sample: true,
    }),
    newParkRecord('acadia', { status: 'want', sample: true }),
  ]

  return {
    trips: [shenandoah, outerBanks, acadia],
    campgrounds: [bigMeadows, oregonInlet, narrows],
    places,
    parks,
  }
}
