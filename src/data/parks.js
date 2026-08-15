// The 63 U.S. National Parks — a built-in static dataset, no API required.
// `motif` picks the small line icon used on park rows and passport stamps.

export const NATIONAL_PARKS = [
  { id: 'acadia', name: 'Acadia', states: ['ME'], motif: 'waves' },
  { id: 'american-samoa', name: 'National Park of American Samoa', states: ['AS'], motif: 'island' },
  { id: 'arches', name: 'Arches', states: ['UT'], motif: 'arch' },
  { id: 'badlands', name: 'Badlands', states: ['SD'], motif: 'canyon' },
  { id: 'big-bend', name: 'Big Bend', states: ['TX'], motif: 'desert' },
  { id: 'biscayne', name: 'Biscayne', states: ['FL'], motif: 'waves' },
  { id: 'black-canyon', name: 'Black Canyon of the Gunnison', states: ['CO'], motif: 'canyon' },
  { id: 'bryce-canyon', name: 'Bryce Canyon', states: ['UT'], motif: 'canyon' },
  { id: 'canyonlands', name: 'Canyonlands', states: ['UT'], motif: 'canyon' },
  { id: 'capitol-reef', name: 'Capitol Reef', states: ['UT'], motif: 'desert' },
  { id: 'carlsbad-caverns', name: 'Carlsbad Caverns', states: ['NM'], motif: 'cave' },
  { id: 'channel-islands', name: 'Channel Islands', states: ['CA'], motif: 'island' },
  { id: 'congaree', name: 'Congaree', states: ['SC'], motif: 'swamp' },
  { id: 'crater-lake', name: 'Crater Lake', states: ['OR'], motif: 'volcano' },
  { id: 'cuyahoga-valley', name: 'Cuyahoga Valley', states: ['OH'], motif: 'forest' },
  { id: 'death-valley', name: 'Death Valley', states: ['CA', 'NV'], motif: 'desert' },
  { id: 'denali', name: 'Denali', states: ['AK'], motif: 'mountains' },
  { id: 'dry-tortugas', name: 'Dry Tortugas', states: ['FL'], motif: 'island' },
  { id: 'everglades', name: 'Everglades', states: ['FL'], motif: 'swamp' },
  { id: 'gates-of-the-arctic', name: 'Gates of the Arctic', states: ['AK'], motif: 'mountains' },
  { id: 'gateway-arch', name: 'Gateway Arch', states: ['MO'], motif: 'arch' },
  { id: 'glacier', name: 'Glacier', states: ['MT'], motif: 'glacier' },
  { id: 'glacier-bay', name: 'Glacier Bay', states: ['AK'], motif: 'glacier' },
  { id: 'grand-canyon', name: 'Grand Canyon', states: ['AZ'], motif: 'canyon' },
  { id: 'grand-teton', name: 'Grand Teton', states: ['WY'], motif: 'mountains' },
  { id: 'great-basin', name: 'Great Basin', states: ['NV'], motif: 'desert' },
  { id: 'great-sand-dunes', name: 'Great Sand Dunes', states: ['CO'], motif: 'dunes' },
  { id: 'great-smoky-mountains', name: 'Great Smoky Mountains', states: ['TN', 'NC'], motif: 'mountains' },
  { id: 'guadalupe-mountains', name: 'Guadalupe Mountains', states: ['TX'], motif: 'mountains' },
  { id: 'haleakala', name: 'Haleakalā', states: ['HI'], motif: 'volcano' },
  { id: 'hawaii-volcanoes', name: 'Hawaiʻi Volcanoes', states: ['HI'], motif: 'volcano' },
  { id: 'hot-springs', name: 'Hot Springs', states: ['AR'], motif: 'geyser' },
  { id: 'indiana-dunes', name: 'Indiana Dunes', states: ['IN'], motif: 'dunes' },
  { id: 'isle-royale', name: 'Isle Royale', states: ['MI'], motif: 'island' },
  { id: 'joshua-tree', name: 'Joshua Tree', states: ['CA'], motif: 'desert' },
  { id: 'katmai', name: 'Katmai', states: ['AK'], motif: 'volcano' },
  { id: 'kenai-fjords', name: 'Kenai Fjords', states: ['AK'], motif: 'glacier' },
  { id: 'kings-canyon', name: 'Kings Canyon', states: ['CA'], motif: 'tree' },
  { id: 'kobuk-valley', name: 'Kobuk Valley', states: ['AK'], motif: 'dunes' },
  { id: 'lake-clark', name: 'Lake Clark', states: ['AK'], motif: 'mountains' },
  { id: 'lassen-volcanic', name: 'Lassen Volcanic', states: ['CA'], motif: 'volcano' },
  { id: 'mammoth-cave', name: 'Mammoth Cave', states: ['KY'], motif: 'cave' },
  { id: 'mesa-verde', name: 'Mesa Verde', states: ['CO'], motif: 'column' },
  { id: 'mount-rainier', name: 'Mount Rainier', states: ['WA'], motif: 'mountains' },
  { id: 'new-river-gorge', name: 'New River Gorge', states: ['WV'], motif: 'canyon' },
  { id: 'north-cascades', name: 'North Cascades', states: ['WA'], motif: 'mountains' },
  { id: 'olympic', name: 'Olympic', states: ['WA'], motif: 'forest' },
  { id: 'petrified-forest', name: 'Petrified Forest', states: ['AZ'], motif: 'tree' },
  { id: 'pinnacles', name: 'Pinnacles', states: ['CA'], motif: 'mountains' },
  { id: 'redwood', name: 'Redwood', states: ['CA'], motif: 'tree' },
  { id: 'rocky-mountain', name: 'Rocky Mountain', states: ['CO'], motif: 'mountains' },
  { id: 'saguaro', name: 'Saguaro', states: ['AZ'], motif: 'cactus' },
  { id: 'sequoia', name: 'Sequoia', states: ['CA'], motif: 'tree' },
  { id: 'shenandoah', name: 'Shenandoah', states: ['VA'], motif: 'forest' },
  { id: 'theodore-roosevelt', name: 'Theodore Roosevelt', states: ['ND'], motif: 'canyon' },
  { id: 'virgin-islands', name: 'Virgin Islands', states: ['VI'], motif: 'island' },
  { id: 'voyageurs', name: 'Voyageurs', states: ['MN'], motif: 'waves' },
  { id: 'white-sands', name: 'White Sands', states: ['NM'], motif: 'dunes' },
  { id: 'wind-cave', name: 'Wind Cave', states: ['SD'], motif: 'cave' },
  { id: 'wrangell-st-elias', name: 'Wrangell–St. Elias', states: ['AK'], motif: 'glacier' },
  { id: 'yellowstone', name: 'Yellowstone', states: ['WY', 'MT', 'ID'], motif: 'geyser' },
  { id: 'yosemite', name: 'Yosemite', states: ['CA'], motif: 'mountains' },
  { id: 'zion', name: 'Zion', states: ['UT'], motif: 'canyon' },
]

// Approximate park centers — good enough for distance ranking, trip ideas,
// and map pins (never for navigation).
const PARK_COORDS = {
  acadia: [44.35, -68.21],
  'american-samoa': [-14.25, -170.68],
  arches: [38.68, -109.57],
  badlands: [43.75, -102.5],
  'big-bend': [29.25, -103.25],
  biscayne: [25.65, -80.08],
  'black-canyon': [38.57, -107.72],
  'bryce-canyon': [37.57, -112.18],
  canyonlands: [38.2, -109.93],
  'capitol-reef': [38.2, -111.17],
  'carlsbad-caverns': [32.17, -104.44],
  'channel-islands': [34.01, -119.42],
  congaree: [33.78, -80.78],
  'crater-lake': [42.94, -122.1],
  'cuyahoga-valley': [41.24, -81.55],
  'death-valley': [36.51, -117.08],
  denali: [63.33, -150.5],
  'dry-tortugas': [24.63, -82.87],
  everglades: [25.32, -80.93],
  'gates-of-the-arctic': [67.78, -153.3],
  'gateway-arch': [38.63, -90.19],
  glacier: [48.76, -113.79],
  'glacier-bay': [58.66, -136.9],
  'grand-canyon': [36.06, -112.14],
  'grand-teton': [43.79, -110.68],
  'great-basin': [38.98, -114.3],
  'great-sand-dunes': [37.79, -105.59],
  'great-smoky-mountains': [35.61, -83.53],
  'guadalupe-mountains': [31.92, -104.87],
  haleakala: [20.72, -156.17],
  'hawaii-volcanoes': [19.38, -155.2],
  'hot-springs': [34.51, -93.05],
  'indiana-dunes': [41.65, -87.05],
  'isle-royale': [48.1, -88.55],
  'joshua-tree': [33.87, -115.9],
  katmai: [58.6, -155.0],
  'kenai-fjords': [59.92, -149.65],
  'kings-canyon': [36.89, -118.55],
  'kobuk-valley': [67.35, -159.28],
  'lake-clark': [60.97, -153.42],
  'lassen-volcanic': [40.49, -121.51],
  'mammoth-cave': [37.18, -86.1],
  'mesa-verde': [37.18, -108.49],
  'mount-rainier': [46.85, -121.75],
  'new-river-gorge': [38.07, -81.08],
  'north-cascades': [48.7, -121.2],
  olympic: [47.8, -123.6],
  'petrified-forest': [35.07, -109.78],
  pinnacles: [36.48, -121.16],
  redwood: [41.21, -124.0],
  'rocky-mountain': [40.34, -105.68],
  saguaro: [32.25, -110.5],
  sequoia: [36.49, -118.57],
  shenandoah: [38.53, -78.35],
  'theodore-roosevelt': [46.97, -103.45],
  'virgin-islands': [18.33, -64.73],
  voyageurs: [48.5, -92.88],
  'white-sands': [32.78, -106.17],
  'wind-cave': [43.57, -103.48],
  'wrangell-st-elias': [61.0, -142.0],
  yellowstone: [44.6, -110.5],
  yosemite: [37.83, -119.5],
  zion: [37.3, -113.05],
}

for (const p of NATIONAL_PARKS) {
  const c = PARK_COORDS[p.id]
  if (c) {
    p.lat = c[0]
    p.lon = c[1]
  }
}

export const PARK_BY_ID = Object.fromEntries(NATIONAL_PARKS.map((p) => [p.id, p]))

// Loose name matching so a place typed as "Shenandoah National Park" links to
// the dataset entry named "Shenandoah".
export function findParkByName(name) {
  if (!name) return null
  const clean = name
    .toLowerCase()
    .replace(/national park( of)?/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!clean) return null
  return (
    NATIONAL_PARKS.find((p) => {
      const pn = p.name.toLowerCase().replace(/national park( of)?/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
      return pn === clean || pn.includes(clean) || clean.includes(pn)
    }) || null
  )
}
