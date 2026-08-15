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
