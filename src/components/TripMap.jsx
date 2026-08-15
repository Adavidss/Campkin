import React, { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { Button, IconBtn, Sheet, ConfirmSheet, Field, Chips, useToast } from './ui.jsx'
import MapView, { DAY_COLORS } from './MapView.jsx'
import BookingSheet from './BookingSheet.jsx'
import { useApp } from '../data/store.jsx'
import { useMapDark } from '../lib/hooks.js'
import { CATEGORY_BY_ID, PLACE_CATEGORIES } from '../data/model.js'
import { appleMapsDirections, appleMapsSearch, telHref } from '../lib/maps.js'
import { roadMilesEstimate, driveTimeEstimate, formatMiles } from '../lib/geo.js'
import { parseISO, todayISO } from '../lib/dates.js'
import { tripDayCount } from './Itinerary.jsx'
import { cx } from '../lib/util.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(trip, day) {
  if (!day) return 'Unscheduled'
  if (!trip.startDate) return `Day ${day}`
  const d = parseISO(trip.startDate)
  d.setDate(d.getDate() + day - 1)
  return `Day ${day} · ${WEEKDAYS[d.getDay()]} ${d.getDate()}`
}

// The whole trip on one map: where you start, where you sleep, and every
// stop in the itinerary — colored by day, joined by legs in travel order.
// Tap a pin to inspect it, then edit, move days, book, or get directions,
// and the map + itinerary re-render on the fly.
export default function TripMap({ trip, cg, places, onEditPlace }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [selected, setSelected] = useState(null) // { type:'start'|'camp'|'place', id }
  const [bookingCg, setBookingCg] = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const rvMode = state.settings.rvMode
  const dayCount = tripDayCount(trip)

  const start = trip.route?.fromCoord ? { lat: trip.route.fromCoord.lat, lon: trip.route.fromCoord.lon, label: trip.route.from || trip.route.fromCoord.label || 'Start' } : null

  const located = useMemo(
    () => places.filter((p) => p.lat != null && p.lon != null),
    [places]
  )
  const unlocated = places.length - located.length

  // Travel order: start → day 1 items → day 2 … → campground (home base) if
  // it isn't already the last thing. Unscheduled items pin but don't join legs.
  const ordered = useMemo(() => {
    const byDay = [...located]
      .filter((p) => p.day)
      .sort((a, b) => a.day - b.day || (a.order || 0) - (b.order || 0) || (a.createdAt < b.createdAt ? -1 : 1))
    return byDay
  }, [located])

  const legs = useMemo(() => {
    const out = []
    let prev = start
    let prevDay = null
    for (const p of ordered) {
      if (prev) out.push({ points: [prev, p], color: DAY_COLORS[(p.day - 1) % DAY_COLORS.length], from: prev, to: p, day: p.day })
      prev = { lat: p.lat, lon: p.lon, name: p.name }
      prevDay = p.day
    }
    if (cg?.lat != null && prev && !(prev.lat === cg.lat && prev.lon === cg.lon)) {
      out.push({ points: [prev, { lat: cg.lat, lon: cg.lon }], color: DAY_COLORS[((prevDay || 1) - 1) % DAY_COLORS.length], from: prev, to: cg, day: prevDay, toCamp: true })
    }
    return out
  }, [ordered, start, cg])

  const totalMiles = legs.reduce((s, l) => s + roadMilesEstimate(l.points[0], l.points[1]), 0)

  const markers = useMemo(() => {
    const m = []
    if (start) m.push({ id: 'start', lat: start.lat, lon: start.lon, kind: 'from', selected: selected?.type === 'start', z: 100, onClick: () => setSelected({ type: 'start' }) })
    if (cg?.lat != null) m.push({ id: 'camp', lat: cg.lat, lon: cg.lon, kind: 'campground', selected: selected?.type === 'camp', z: 200, onClick: () => setSelected({ type: 'camp' }) })
    for (const p of located) {
      const isCampItem = p.category === 'campground'
      m.push({
        id: p.id,
        lat: p.lat,
        lon: p.lon,
        kind: p.category === 'food' ? 'food' : isCampItem ? 'campground' : 'sight',
        color: p.day ? DAY_COLORS[(p.day - 1) % DAY_COLORS.length] : '#8b897d',
        label: p.day && !isCampItem ? String(p.day) : null,
        selected: selected?.type === 'place' && selected.id === p.id,
        onClick: () => setSelected({ type: 'place', id: p.id }),
      })
    }
    return m
  }, [located, start, cg, selected])

  const selPlace = selected?.type === 'place' ? places.find((p) => p.id === selected.id) : null
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  if (!start && cg?.lat == null && located.length === 0) return null

  return (
    <div>
      <div className="map-wrap">
        <MapView
          markers={markers}
          legs={legs}
          fit="markers"
          dark={mapDark}
          height={320}
        />
        {/* legend */}
        <div className="map-legend">
          {days.slice(0, 6).map((d) => (
            <span key={d} className="legend-chip">
              <span className="legend-dot" style={{ background: DAY_COLORS[(d - 1) % DAY_COLORS.length] }} />
              Day {d}
            </span>
          ))}
          {days.length > 6 && <span className="legend-chip">…</span>}
        </div>
      </div>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '8px 4px 0', lineHeight: 1.5 }}>
        {legs.length > 0 && <>~{totalMiles} mi across {legs.length} {legs.length === 1 ? 'leg' : 'legs'} · </>}
        {located.length} {located.length === 1 ? 'stop' : 'stops'} pinned
        {unlocated > 0 && ` · ${unlocated} without a location yet`}
        {' — tap any pin to inspect or edit'}
      </p>

      {/* ---- pin inspector ---- */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title="">
        {selected?.type === 'start' && start && (
          <PinBody
            eyebrow="Starting point"
            title={start.label}
            sub={trip.route?.miles ? `${trip.route.miles} mi to ${trip.route.to || 'destination'} · about ${trip.route.driveTime}` : ''}
            actions={
              <Button variant="soft" small icon="map" href={appleMapsSearch(`${start.lat},${start.lon}`)} target="_blank" rel="noopener">
                Open in Maps
              </Button>
            }
          />
        )}
        {selected?.type === 'camp' && cg && (
          <PinBody
            eyebrow={rvMode ? 'Home base · RV' : 'Home base'}
            title={cg.name}
            sub={[cg.location, trip.siteNumber && `Site ${trip.siteNumber}`, cg.hookups].filter(Boolean).join(' · ')}
            actions={
              <>
                <Button small icon="calendar" onClick={() => setBookingCg(cg)}>Book</Button>
                <Button variant="soft" small icon="map" href={appleMapsDirections(`${cg.lat},${cg.lon}`)} target="_blank" rel="noopener">Directions</Button>
                {cg.phone && <Button variant="soft" small icon="phone" href={telHref(cg.phone)}>Call</Button>}
                <Button variant="ghost" small icon="tent" href={`#/campground/${cg.id}`}>Campground page</Button>
              </>
            }
          />
        )}
        {selPlace && (
          <PlacePin
            trip={trip}
            place={selPlace}
            days={days}
            legs={legs}
            onEdit={() => {
              setSelected(null)
              onEditPlace(selPlace)
            }}
            onRemove={() => setConfirmRemove(selPlace)}
            onClose={() => setSelected(null)}
          />
        )}
      </Sheet>

      <BookingSheet open={!!bookingCg} onClose={() => setBookingCg(null)} cg={bookingCg} />
      <ConfirmSheet
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove from trip?"
        message={`“${confirmRemove?.name}” will be removed from this trip’s itinerary.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          actions.deletePlace(confirmRemove.id)
          setSelected(null)
          toast('Removed from itinerary')
        }}
      />
    </div>
  )
}

function PinBody({ eyebrow, title, sub, actions, children }) {
  return (
    <div style={{ paddingBottom: 6 }}>
      <div className="memory-label">{eyebrow}</div>
      <h3 style={{ fontSize: 22, marginTop: 4, overflowWrap: 'anywhere' }}>{title}</h3>
      {sub && <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 3 }}>{sub}</p>}
      {children}
      {actions && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>{actions}</div>}
    </div>
  )
}

// A place pin: shows what it is, lets you retitle/renote inline, move it to
// another day, mark it done, remove it, or open it in Maps. Every change
// writes straight to the store, so the map and itinerary update instantly.
function PlacePin({ trip, place, days, legs, onEdit, onRemove, onClose }) {
  const { actions } = useApp()
  const cat = CATEGORY_BY_ID[place.category] || CATEGORY_BY_ID.other
  const [name, setName] = useState(place.name)
  const [notes, setNotes] = useState(place.notes || '')
  const timerRef = React.useRef(null)
  // Re-seed the fields when a different pin is selected.
  React.useEffect(() => {
    setName(place.name)
    setNotes(place.notes || '')
  }, [place.id])
  const leg = legs.find((l) => l.to?.id === place.id)
  const legMiles = leg ? roadMilesEstimate(leg.points[0], leg.points[1]) : null

  // Edits save as you type (debounced) — the map and itinerary follow live.
  const scheduleSave = (patch) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => actions.updatePlace(place.id, patch), 350)
  }
  React.useEffect(() => () => clearTimeout(timerRef.current), [])
  const commitName = (v) => {
    const val = (v ?? name).trim()
    if (val && val !== place.name) scheduleSave({ name: val })
  }
  const commitNotes = (v) => {
    const val = v ?? notes
    if (val !== (place.notes || '')) scheduleSave({ notes: val })
  }

  return (
    <div style={{ paddingBottom: 6 }}>
      <div className="memory-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="legend-dot" style={{ background: place.day ? DAY_COLORS[(place.day - 1) % DAY_COLORS.length] : '#8b897d' }} />
        {dayLabel(trip, place.day)} · {cat.label}
      </div>
      <input
        className="input"
        style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 650, marginTop: 6, border: 'none', padding: '4px 0', background: 'transparent', minHeight: 0 }}
        value={name}
        onChange={(e) => {
          setName(e.target.value)
          commitName(e.target.value)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Place name"
      />
      {leg && (
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 2 }}>
          {legMiles} mi from {leg.from.name || leg.from.label || 'previous stop'} · about {driveTimeEstimate(legMiles)}
        </p>
      )}
      <textarea
        className="textarea"
        rows={2}
        style={{ marginTop: 10, minHeight: 56 }}
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value)
          commitNotes(e.target.value)
        }}
        placeholder="A note for this stop…"
        aria-label="Notes"
      />

      <div className="field-label" style={{ marginTop: 12 }}>Which day?</div>
      <div className="chips" style={{ marginTop: 6 }}>
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={cx('chip', place.day === d && 'is-active')}
            style={place.day === d ? { background: DAY_COLORS[(d - 1) % DAY_COLORS.length], borderColor: DAY_COLORS[(d - 1) % DAY_COLORS.length] } : undefined}
            onClick={() => actions.setPlaceDay(place.id, d)}
          >
            {d}
          </button>
        ))}
        <button type="button" className={cx('chip', !place.day && 'is-active')} onClick={() => actions.setPlaceDay(place.id, null)}>
          Idea
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Button
          small
          variant={place.visited ? 'solid' : 'soft'}
          icon="check"
          onClick={() => actions.updatePlace(place.id, place.visited ? { visited: false } : { visited: true, dateVisited: todayISO() })}
        >
          {place.visited ? 'Done' : 'Mark done'}
        </Button>
        <Button variant="soft" small icon="map" href={appleMapsDirections(`${place.lat},${place.lon}`)} target="_blank" rel="noopener">
          Directions
        </Button>
        <Button variant="soft" small icon="pencil" onClick={onEdit}>
          More…
        </Button>
        <Button variant="ghost" small icon="trash" onClick={onRemove}>
          Remove
        </Button>
      </div>
    </div>
  )
}
