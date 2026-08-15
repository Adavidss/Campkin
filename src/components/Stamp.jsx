import React from 'react'
import Icon from './Icon.jsx'
import { CATEGORY_BY_ID } from '../data/model.js'
import { PARK_BY_ID } from '../data/parks.js'
import { hashCode, cx } from '../lib/util.js'
import { parseISO } from '../lib/dates.js'

const SHAPES = {
  'national-park': 'circle',
  'state-park': 'circle',
  campground: 'hex',
  city: 'oval',
  beach: 'oval',
  'scenic-drive': 'rect',
  landmark: 'rect',
  'historic-site': 'rect',
  other: 'circle',
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function stampFoot(place) {
  const d = parseISO(place.dateVisited)
  const bits = []
  if (place.state) bits.push(place.state)
  if (d) bits.push(`${MONTHS[d.getMonth()]} ${d.getFullYear()}`)
  return bits.join(' · ')
}

export default function Stamp({ place, onClick, isNew, small }) {
  const cat = CATEGORY_BY_ID[place.category] || CATEGORY_BY_ID.other
  const motif = place.source === 'park' && PARK_BY_ID[place.refId] ? PARK_BY_ID[place.refId].motif : cat.icon
  const shape = SHAPES[place.category] || 'rect'
  const tilt = ((hashCode(place.id) % 50) / 10 - 2.5).toFixed(1)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      className={cx('stamp', isNew && 'stamp-new', small && 'stamp-small')}
      onClick={onClick}
      type={onClick ? 'button' : undefined}
      aria-label={onClick ? `${place.name}, ${cat.label}` : undefined}
    >
      <span
        className={`stamp-inner shape-${shape}`}
        style={{ '--stamp-ink': `var(--ink-${cat.ink})`, transform: `rotate(${tilt}deg)` }}
      >
        <Icon name={motif} size={small ? 17 : 23} strokeWidth={1.6} />
        <span className="stamp-name">{place.name}</span>
        {!small && <span className="stamp-cat">{cat.label}</span>}
        <span className="stamp-foot">{stampFoot(place)}</span>
      </span>
      {place.favorite && !small && <Icon name="heart" size={13} filled className="stamp-fav" />}
    </Tag>
  )
}
