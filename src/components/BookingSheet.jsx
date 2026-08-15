import React from 'react'
import Icon from './Icon.jsx'
import { Sheet, Button, ListRow } from './ui.jsx'
import { bookingLinks } from '../lib/booking.js'
import { telHref } from '../lib/maps.js'

// "Book this campground" — every reservation hand-off in one place.
export default function BookingSheet({ open, onClose, cg }) {
  if (!cg) return null
  const links = bookingLinks(cg)
  return (
    <Sheet open={open} onClose={onClose} title={`Book ${cg.name}`}>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 12px', lineHeight: 1.5 }}>
        Campkin doesn’t take reservations — these open the campground’s own site or the big
        booking services with it already searched.
      </p>
      {cg.phone && (
        <ListRow
          icon="phone"
          title={`Call ${cg.phone}`}
          sub="Fastest for same-week availability"
          href={telHref(cg.phone)}
          right={<Icon name="chevronRight" size={16} />}
        />
      )}
      {links.map((l) => (
        <a key={l.id} className={`list-row is-tappable ${l.primary ? 'booking-primary' : ''}`} href={l.href} target="_blank" rel="noopener">
          <span className="row-icon">
            <Icon name={l.icon} size={19} />
          </span>
          <span className="row-main">
            <span className="row-title">{l.label}</span>
            <span className="row-sub">{l.primary ? `Best bet · ${l.sub}` : l.sub}</span>
          </span>
          <span className="row-right">
            <Icon name="external" size={15} />
          </span>
        </a>
      ))}
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 12, lineHeight: 1.5 }}>
        Not every campground is on every service — if one comes up empty, the next usually has it.
      </p>
    </Sheet>
  )
}

// A compact "Book" button that opens the sheet — drop it anywhere a campground shows.
export function BookButton({ cg, small = true, full = false, variant = 'solid', onOpen }) {
  return (
    <Button variant={variant} small={small} full={full} icon="calendar" onClick={onOpen}>
      Book
    </Button>
  )
}
