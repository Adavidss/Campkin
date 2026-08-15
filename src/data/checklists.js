import { uid } from '../lib/util.js'

// Default packing & departure checklists. Every trip starts from these plus
// any custom items the user chose to keep for future trips.

export const CHECKLIST_CATEGORIES = [
  'RV',
  'Kitchen',
  'Food',
  'Clothing',
  'Bathroom',
  'Outdoor',
  'Electronics',
  'Documents',
  'Before Leaving Home',
  'Before Leaving Campground',
]

const DEFAULTS = {
  RV: [
    'Leveling blocks',
    'Power cable',
    'Water hose',
    'Sewer hose',
    'Wheel chocks',
    'Water pressure regulator',
  ],
  Kitchen: ['Cookware', 'Coffee', 'Dish soap', 'Paper towels', 'Trash bags'],
  Food: ['Breakfast supplies', 'Snacks', 'Drinks', 'Condiments'],
  Clothing: ['Layers for evenings', 'Rain jacket', 'Comfortable shoes', 'Swimsuits'],
  Bathroom: ['Toiletries', 'Towels', 'RV-safe toilet paper', 'First aid kit'],
  Outdoor: ['Camp chairs', 'Outdoor rug', 'Lantern', 'Firewood or fire starter', 'Bug spray', 'Sunscreen'],
  Electronics: ['Phone chargers', 'Battery pack', 'Flashlights', 'Surge protector'],
  Documents: ['Reservation confirmation', 'Insurance card', 'Driver’s license', 'Park pass'],
  'Before Leaving Home': [
    'Lock doors',
    'Adjust thermostat',
    'Take out trash',
    'Check refrigerator',
    'Water plants',
    'Hitch & lights check',
  ],
  'Before Leaving Campground': [
    'Disconnect hookups',
    'Retract awning',
    'Secure cabinets',
    'Lower antenna',
    'Check campsite for belongings',
    'Walk around RV',
  ],
}

export function defaultChecklist(savedCustomItems = []) {
  const items = []
  for (const cat of CHECKLIST_CATEGORIES) {
    for (const label of DEFAULTS[cat] || []) {
      items.push({ id: uid(), cat, label, done: false, custom: false })
    }
    for (const saved of savedCustomItems.filter((s) => s.cat === cat)) {
      items.push({ id: uid(), cat: saved.cat, label: saved.label, done: false, custom: true })
    }
  }
  return items
}

export function defaultItemsFor(cat) {
  return DEFAULTS[cat] || []
}
