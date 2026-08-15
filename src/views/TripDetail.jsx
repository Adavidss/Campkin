import React, { useRef, useState } from 'react'
import { useApp, tripStatus, photosFor } from '../data/store.jsx'
import { navigate, back, Link } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import {
  Button, IconBtn, Card, Section, Field, Chips, Sheet, ConfirmSheet, Stars,
  ListRow, EmptyState, ProgressBar, useToast,
} from '../components/ui.jsx'
import PhotoStrip from '../components/PhotoStrip.jsx'
import PlaceSheet from '../components/PlaceSheet.jsx'
import Stamp from '../components/Stamp.jsx'
import { fmtRange, fmtTime, fmtDate, countdownLabel, nightsOf, todayISO } from '../lib/dates.js'
import { appleMapsDirections, googleMapsDirections, appleMapsSearch, telHref, normalizeUrl } from '../lib/maps.js'
import { useAutosaveText } from '../lib/hooks.js'
import { HOOKUP_TYPES, WOULD_RETURN, CATEGORY_BY_ID } from '../data/model.js'
import { plural } from '../lib/util.js'
import { geocodePlace } from '../lib/osm.js'
import { roadMilesEstimate, driveTimeEstimate } from '../lib/geo.js'
import { setExploreCenter } from './Campgrounds.jsx'
import MapView from '../components/MapView.jsx'

export default function TripDetail({ tripId }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const trip = state.trips.find((t) => t.id === tripId)
  const [menuOpen, setMenuOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [cgOpen, setCgOpen] = useState(false)
  const [routeOpen, setRouteOpen] = useState(false)
  const [placeOpen, setPlaceOpen] = useState(false)
  const [editingPlace, setEditingPlace] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const notesRef = useRef(null)
  const photosRef = useRef(null)
  const rememberRef = useRef(null)

  if (!trip) {
    return (
      <EmptyState icon="route" title="Trip not found" text="It may have been deleted.">
        <Button variant="soft" onClick={() => navigate('trips')}>
          Back to Trips
        </Button>
      </EmptyState>
    )
  }

  const status = tripStatus(trip)
  const cg = state.campgrounds.find((c) => c.id === trip.campgroundId)
  const places = state.places.filter((p) => p.tripId === trip.id)
  const nights = nightsOf(trip)

  const focusEl = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setTimeout(() => ref.current?.focus?.(), 350)
  }

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>

      <div className="detail-head">
        <div className="detail-title-row">
          <h1 className="detail-title">{trip.name}</h1>
          <div className="detail-actions">
            <IconBtn
              name="heart"
              label={trip.favorite ? 'Remove from favorites' : 'Add to favorites'}
              active={trip.favorite}
              onClick={() => actions.updateTrip(trip.id, { favorite: !trip.favorite })}
            />
            <IconBtn name="dots" label="Trip options" onClick={() => setMenuOpen(true)} />
          </div>
        </div>
        <div className="detail-meta">
          {trip.destination && <span>{trip.destination}</span>}
          {(trip.startDate || trip.endDate) && <span>{fmtRange(trip.startDate, trip.endDate)}</span>}
          {nights > 0 && <span>{plural(nights, 'night')}</span>}
          {trip.sample && <span className="tag-sample">Sample</span>}
        </div>
      </div>

      {status === 'completed' ? (
        <Keepsake trip={trip} cg={cg} places={places} />
      ) : (
        <>
          {status === 'past-due' && (
            <Card style={{ marginTop: 14, background: 'var(--pine-soft)', borderColor: 'transparent' }}>
              <p style={{ fontSize: 14.5, color: 'var(--pine-deep)', marginBottom: 10 }}>
                This trip has wrapped up. Complete it to add it to your travel book.
              </p>
              <Button icon="check" onClick={() => navigate(`trip/${trip.id}/complete`)}>
                Complete Trip
              </Button>
            </Card>
          )}

          {status === 'active' && (
            <NowCard
              trip={trip}
              cg={cg}
              onAddNote={() => focusEl(notesRef)}
              onAddPlace={() => {
                setEditingPlace(null)
                setPlaceOpen(true)
              }}
              onAddPhoto={() => photosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
              onRemember={() => focusEl(rememberRef)}
            />
          )}

          {status === 'planned' && trip.startDate && countdownLabel(trip.startDate) && (
            <Card style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="row-icon">
                <Icon name="calendar" size={20} />
              </span>
              <div>
                <div style={{ fontWeight: 650 }}>{countdownLabel(trip.startDate)}</div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>
                  {fmtDate(trip.startDate)}
                  {cg && trip.checkIn ? ` · check-in ${fmtTime(trip.checkIn)}` : ''}
                </div>
              </div>
            </Card>
          )}

          <Section title="Campground">
            {cg ? (
              <CampgroundInfo trip={trip} cg={cg} onEdit={() => setCgOpen(true)} />
            ) : (
              <ListRow
                icon="tent"
                title="Add Campground Details"
                sub="Name, site number, hookups, contact"
                right={<Icon name="plus" size={18} />}
                onClick={() => setCgOpen(true)}
              />
            )}
          </Section>

          <Section title="Route">
            {trip.route ? (
              <RouteInfo trip={trip} cg={cg} onEdit={() => setRouteOpen(true)} />
            ) : (
              <ListRow
                icon="route"
                title="Add Route"
                sub="Mileage, drive time, directions"
                right={<Icon name="plus" size={18} />}
                onClick={() => setRouteOpen(true)}
              />
            )}
          </Section>

          <Section title="Checklist">
            <ChecklistSummary trip={trip} active={status === 'active'} />
          </Section>

          <Section
            title="Things to Do"
            action={
              places.length > 0 && (
                <Button
                  variant="ghost"
                  small
                  icon="plus"
                  onClick={() => {
                    setEditingPlace(null)
                    setPlaceOpen(true)
                  }}
                >
                  Add
                </Button>
              )
            }
          >
            <PlacesList
              places={places}
              status={status}
              onAdd={() => {
                setEditingPlace(null)
                setPlaceOpen(true)
              }}
              onEdit={(p) => {
                setEditingPlace(p)
                setPlaceOpen(true)
              }}
            />
          </Section>

          <Section title="Notes">
            <NotesCard trip={trip} notesRef={notesRef} />
          </Section>

          {status === 'active' && (
            <Section title="Remember for next time">
              <RememberCard trip={trip} rememberRef={rememberRef} />
            </Section>
          )}

          <Section title="Photos">
            <div ref={photosRef}>
              <PhotoStrip
                entityType="trip"
                entityId={trip.id}
                coverId={trip.coverPhotoId}
                onSetCover={(pid) => actions.updateTrip(trip.id, { coverPhotoId: pid })}
              />
            </div>
          </Section>

          {status === 'active' && (
            <Section title="">
              <Button full icon="check" onClick={() => navigate(`trip/${trip.id}/complete`)}>
                Complete Trip
              </Button>
            </Section>
          )}
        </>
      )}

      {/* ---- sheets ---- */}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Trip options">
        <ListRow
          icon="pencil"
          title="Edit trip details"
          sub="Name, destination, dates"
          onClick={() => {
            setMenuOpen(false)
            setEditOpen(true)
          }}
        />
        <ListRow
          icon="refresh"
          title="Duplicate trip"
          sub="Same destination and checklist, fresh dates"
          onClick={() => {
            const t = actions.duplicateTrip(trip.id)
            setMenuOpen(false)
            toast('Trip duplicated — set the new dates', { icon: 'check' })
            navigate(`trip/${t.id}`)
          }}
        />
        {trip.completed && (
          <ListRow
            icon="route"
            title="Reopen trip"
            sub="Move it back to planning"
            onClick={() => {
              actions.reopenTrip(trip.id)
              setMenuOpen(false)
            }}
          />
        )}
        <ListRow
          icon="trash"
          title="Delete trip"
          sub="Checklist, notes and trip photos are removed"
          onClick={() => {
            setMenuOpen(false)
            setConfirmDelete(true)
          }}
        />
      </Sheet>

      <EditBasicsSheet trip={trip} open={editOpen} onClose={() => setEditOpen(false)} />
      <CampgroundSheet trip={trip} cg={cg} open={cgOpen} onClose={() => setCgOpen(false)} />
      <RouteSheet trip={trip} cg={cg} open={routeOpen} onClose={() => setRouteOpen(false)} />
      <PlaceSheet
        open={placeOpen}
        onClose={() => setPlaceOpen(false)}
        place={editingPlace}
        tripId={trip.id}
        defaultVisited={status !== 'planned'}
      />

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this trip?"
        message={`“${trip.name}” and its checklist, notes and photos will be deleted. Places you saved to your Passport will stay.`}
        confirmLabel="Delete Trip"
        danger
        onConfirm={() => {
          actions.deleteTrip(trip.id)
          toast('Trip deleted')
          navigate('trips', { replace: true })
        }}
      />
    </>
  )
}

/* ------------------------------------------------------------------------- */

function NowCard({ trip, cg, onAddNote, onAddPlace, onAddPhoto, onRemember }) {
  const dest = cg ? cg.address || `${cg.name}${cg.location ? ', ' + cg.location : ''}` : trip.destination
  const lastDay = trip.endDate === todayISO()
  return (
    <>
      <Card className="now-card" style={{ marginTop: 14 }}>
        <div className="now-grid">
          <div style={{ minWidth: 0 }}>
            {cg && <div className="now-cg">{cg.name}</div>}
            <div className="now-times">
              {trip.checkIn && <span>Check-in {fmtTime(trip.checkIn)}</span>}
              {trip.checkOut && <span>Check-out {fmtTime(trip.checkOut)}</span>}
              {!trip.checkIn && !trip.checkOut && <span>{fmtRange(trip.startDate, trip.endDate)}</span>}
            </div>
          </div>
          {trip.siteNumber && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="now-site-label">Site</div>
              <div className="now-site">{trip.siteNumber}</div>
            </div>
          )}
        </div>
        <div className="now-actions">
          {dest && (
            <Button variant="soft" small icon="map" href={appleMapsDirections(dest)} target="_blank" rel="noopener">
              Directions
            </Button>
          )}
          {cg?.phone && (
            <Button variant="soft" small icon="phone" href={telHref(cg.phone)}>
              Call Campground
            </Button>
          )}
          {cg?.lat != null && (
            <Button
              variant="soft"
              small
              icon="pin"
              onClick={() => {
                setExploreCenter({ lat: cg.lat, lon: cg.lon, label: cg.name })
                navigate('campgrounds/find')
              }}
            >
              Nearby
            </Button>
          )}
          {lastDay && (
            <Button variant="soft" small icon="list" onClick={() => navigate(`trip/${trip.id}/checklist/Before Leaving Campground`)}>
              Departure checklist
            </Button>
          )}
        </div>
      </Card>
      <div className="detail-quick" style={{ marginTop: 10 }}>
        <button type="button" className="quick-action" onClick={onAddNote}>
          <span className="qa-icon"><Icon name="note" size={20} /></span>
          Add Note
        </button>
        <button type="button" className="quick-action" onClick={onAddPlace}>
          <span className="qa-icon"><Icon name="pin" size={20} /></span>
          Add Place
        </button>
        <button type="button" className="quick-action" onClick={onAddPhoto}>
          <span className="qa-icon"><Icon name="camera" size={20} /></span>
          Add Photo
        </button>
        <button type="button" className="quick-action" onClick={onRemember}>
          <span className="qa-icon"><Icon name="sparkle" size={20} /></span>
          Remember
        </button>
      </div>
    </>
  )
}

function CampgroundInfo({ trip, cg, onEdit }) {
  const dest = cg.lat != null ? `${cg.lat},${cg.lon}` : cg.address || `${cg.name}${cg.location ? ', ' + cg.location : ''}`
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {cg.lat != null && (
        <MapView
          center={{ lat: cg.lat, lon: cg.lon }}
          zoom={12}
          markers={[{ id: cg.id, lat: cg.lat, lon: cg.lon, kind: 'campground' }]}
          interactive={false}
          height={150}
          className="map-view map-inline"
        />
      )}
      <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <Link to={`campground/${cg.id}`} style={{ fontWeight: 680, fontSize: 17, color: 'var(--ink)' }}>
            {cg.name} <Icon name="chevronRight" size={13} style={{ color: 'var(--ink-faint)' }} />
          </Link>
          {cg.location && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 1 }}>{cg.location}</div>
          )}
        </div>
        <Button variant="ghost" small icon="pencil" onClick={onEdit} aria-label="Edit campground details">
          Edit
        </Button>
      </div>
      <div className="info-grid" style={{ border: 'none', borderTop: '1px solid var(--line)', borderRadius: 0 }}>
        {trip.siteNumber && <Cell label="Site" value={trip.siteNumber} />}
        {cg.hookups && <Cell label="Hookups" value={cg.hookups} />}
        {trip.checkIn && <Cell label="Check-in" value={fmtTime(trip.checkIn)} />}
        {trip.checkOut && <Cell label="Check-out" value={fmtTime(trip.checkOut)} />}
        {trip.reservation && <Cell label="Reservation" value={trip.reservation} wide />}
        {cg.address && <Cell label="Address" value={cg.address} wide />}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '12px 16px 14px' }}>
        {dest && (
          <Button variant="soft" small icon="map" href={appleMapsDirections(dest)} target="_blank" rel="noopener">
            Apple Maps
          </Button>
        )}
        {dest && (
          <Button variant="soft" small icon="map" href={googleMapsDirections(dest)} target="_blank" rel="noopener">
            Google Maps
          </Button>
        )}
        {cg.phone && (
          <Button variant="soft" small icon="phone" href={telHref(cg.phone)}>
            Call
          </Button>
        )}
        {cg.website && (
          <Button variant="soft" small icon="globe" href={normalizeUrl(cg.website)} target="_blank" rel="noopener">
            Website
          </Button>
        )}
      </div>
    </Card>
  )
}

function Cell({ label, value, wide }) {
  return (
    <div className={`info-cell ${wide ? 'is-wide' : ''}`}>
      <div className="info-label">{label}</div>
      <div className="info-value">{value}</div>
    </div>
  )
}

function RouteInfo({ trip, cg, onEdit }) {
  const r = trip.route
  const dest = r.to || (cg ? cg.address || cg.name : trip.destination)
  const hasCoords = r.fromCoord && r.toCoord
  return (
    <Card style={{ padding: hasCoords ? 0 : '14px 16px', overflow: 'hidden' }}>
      {hasCoords && (
        <MapView
          markers={[
            { id: 'from', lat: r.fromCoord.lat, lon: r.fromCoord.lon, kind: 'from' },
            { id: 'to', lat: r.toCoord.lat, lon: r.toCoord.lon, kind: 'to' },
          ]}
          line={[r.fromCoord, r.toCoord]}
          fit="markers"
          interactive={false}
          height={170}
          className="map-view map-inline"
        />
      )}
      <div style={hasCoords ? { padding: '12px 16px 14px' } : undefined}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 650 }}>
              {r.from || 'Home'} <Icon name="chevronRight" size={12} style={{ color: 'var(--ink-faint)' }} />{' '}
              {r.to || trip.destination || 'Destination'}
            </div>
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 2 }}>
              {[r.miles && `${r.miles} miles`, r.driveTime && `about ${r.driveTime}`]
                .filter(Boolean)
                .join(' · ') || 'Route details'}
            </div>
          </div>
          <Button variant="ghost" small icon="pencil" onClick={onEdit} aria-label="Edit route">
            Edit
          </Button>
        </div>
        {r.notes && <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 8 }}>{r.notes}</p>}
        {dest && (
          <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
            <Button variant="soft" small icon="map" href={appleMapsDirections(dest, r.from)} target="_blank" rel="noopener">
              Apple Maps
            </Button>
            <Button variant="soft" small icon="map" href={googleMapsDirections(dest, r.from)} target="_blank" rel="noopener">
              Google Maps
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

function ChecklistSummary({ trip, active }) {
  const total = trip.checklist.length
  const done = trip.checklist.filter((i) => i.done).length
  return (
    <Card
      as="button"
      onClick={() => navigate(`trip/${trip.id}/checklist`)}
      className="card-tappable"
      style={{ textAlign: 'left' }}
    >
      <div className="check-summary">
        <span className="row-icon">
          <Icon name="list" size={20} />
        </span>
        <ProgressBar value={done} max={total} />
        <span className="check-count">
          {done}/{total}
        </span>
        <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-faint)' }} />
      </div>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 9 }}>
        {done === total && total > 0
          ? 'All packed and checked. ✦'
          : active
            ? 'Packing, setup, and the before-you-leave walkarounds.'
            : 'Packing lists plus before-leaving checks for home and campground.'}
      </p>
    </Card>
  )
}

function PlacesList({ places, status, onAdd, onEdit }) {
  const { actions } = useApp()
  if (!places.length) {
    return (
      <EmptyState
        compact
        icon="pin"
        title="Nothing saved yet"
        text="Collect restaurants, trails, and stops — anything worth remembering."
      >
        <Button variant="soft" small icon="plus" onClick={onAdd}>
          Add a Place
        </Button>
      </EmptyState>
    )
  }
  const sorted = [...places].sort((a, b) => Number(a.visited) - Number(b.visited))
  return (
    <div>
      {sorted.map((p) => {
        const cat = CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other
        return (
          <ListRow
            key={p.id}
            icon={cat.icon}
            title={p.name}
            sub={[cat.label, p.state, p.notes].filter(Boolean).join(' · ')}
            onClick={() => onEdit(p)}
            right={
              <>
                {!p.visited && (
                  <Button
                    variant="soft"
                    small
                    onClick={(e) => {
                      e.stopPropagation()
                      actions.updatePlace(p.id, { visited: true, dateVisited: todayISO() })
                    }}
                  >
                    Been here
                  </Button>
                )}
                {p.visited && <Icon name="check" size={16} style={{ color: 'var(--sage)' }} />}
                {p.favorite && <Icon name="heart" size={15} filled style={{ color: 'var(--clay)' }} />}
                <a
                  href={appleMapsSearch(`${p.name}${p.state ? ', ' + p.state : ''}`)}
                  target="_blank"
                  rel="noopener"
                  aria-label={`Open ${p.name} in Maps`}
                  onClick={(e) => e.stopPropagation()}
                  className="icon-btn"
                  style={{ width: 34, height: 34 }}
                >
                  <Icon name="external" size={16} />
                </a>
              </>
            }
          />
        )
      })}
    </div>
  )
}

function NotesCard({ trip, notesRef }) {
  const { actions } = useApp()
  const { value, onChange, saved } = useAutosaveText(trip.notes, (v) =>
    actions.updateTrip(trip.id, { notes: v })
  )
  return (
    <Card>
      <textarea
        ref={notesRef}
        className="notes-area"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Gate code, firewood spots, what to see…"
        aria-label="Trip notes"
      />
      <div className="save-hint" style={{ opacity: saved ? 1 : 0 }}>
        <Icon name="check" size={12} /> Saved
      </div>
    </Card>
  )
}

function RememberCard({ trip, rememberRef }) {
  const { actions } = useApp()
  const { value, onChange, saved } = useAutosaveText(trip.rememberNextTime, (v) =>
    actions.updateTrip(trip.id, { rememberNextTime: v })
  )
  return (
    <Card className="remember-card">
      <textarea
        ref={rememberRef}
        className="notes-area"
        style={{ minHeight: 60 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Site 42 has more shade. Book the ferry earlier…"
        aria-label="Remember for next time"
      />
      <div className="save-hint" style={{ opacity: saved ? 1 : 0 }}>
        <Icon name="check" size={12} /> Saved
      </div>
    </Card>
  )
}

/* ---- completed keepsake --------------------------------------------------- */

function Keepsake({ trip, cg, places }) {
  const { state } = useApp()
  const wr = WOULD_RETURN.find((w) => w.id === trip.wouldReturn)
  const tiles = [
    trip.favoritePart && { label: 'Favorite Part', value: trip.favoritePart },
    trip.favoriteMeal && { label: 'Favorite Meal', value: trip.favoriteMeal },
    trip.favoritePlace && { label: 'Favorite Place', value: trip.favoritePlace },
  ].filter(Boolean)
  const visitedPlaces = places.filter((p) => p.visited)
  const hasPhotos = photosFor(state, 'trip', trip.id).length > 0

  return (
    <>
      <div className="keepsake-head fade-up">
        {trip.rating > 0 && (
          <div className="keepsake-stars">
            <Stars value={trip.rating} size={20} />
          </div>
        )}
        {cg && (
          <div className="keepsake-cg" style={{ marginTop: 8 }}>
            {cg.name}
            {trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}
          </div>
        )}
        {wr && <div className="keepsake-return">Would return: {wr.label}</div>}
      </div>

      {(tiles.length > 0 || trip.memory) && (
        <Section title="">
          <div className="memory-grid">
            {tiles.map((t) => (
              <div key={t.label} className="memory-tile">
                <div className="memory-label">{t.label}</div>
                <div className="memory-value">{t.value}</div>
              </div>
            ))}
            {trip.memory && (
              <div className="memory-tile is-wide">
                <div className="memory-label">A Memory</div>
                <div className="memory-quote">“{trip.memory}”</div>
              </div>
            )}
          </div>
        </Section>
      )}

      {trip.rememberNextTime && (
        <Section title="">
          <div className="memory-tile remember-card">
            <div className="memory-label">Remember Next Time</div>
            <div className="memory-value">{trip.rememberNextTime}</div>
          </div>
        </Section>
      )}

      <Section title="Photos">
        <PhotoStrip entityType="trip" entityId={trip.id} coverId={trip.coverPhotoId} onSetCover={() => {}} />
      </Section>

      {visitedPlaces.length > 0 && (
        <Section title="Passport stamps from this trip">
          <div className="stamp-grid">
            {visitedPlaces.map((p) => (
              <Stamp key={p.id} place={p} onClick={() => navigate('passport')} />
            ))}
          </div>
        </Section>
      )}

      {cg && (
        <Section title="Campground">
          <ListRow
            icon="tent"
            title={cg.name}
            sub={[cg.location, trip.siteNumber && `Site ${trip.siteNumber}`].filter(Boolean).join(' · ')}
            href={`#/campground/${cg.id}`}
            right={<Icon name="chevronRight" size={18} />}
          />
        </Section>
      )}

      <Section title="">
        <Button variant="soft" full icon="pencil" onClick={() => navigate(`trip/${trip.id}/complete`)}>
          Edit recap
        </Button>
      </Section>
    </>
  )
}

/* ---- edit sheets ---------------------------------------------------------- */

function EditBasicsSheet({ trip, open, onClose }) {
  const { actions } = useApp()
  const [form, setForm] = useState({})
  React.useEffect(() => {
    if (open)
      setForm({
        name: trip.name,
        destination: trip.destination,
        startDate: trip.startDate,
        endDate: trip.endDate,
      })
  }, [open, trip])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit trip"
      footer={
        <Button
          full
          onClick={() => {
            if (!form.name?.trim()) return
            let end = form.endDate
            if (form.startDate && (!end || end < form.startDate)) end = form.startDate
            actions.updateTrip(trip.id, { ...form, name: form.name.trim(), endDate: end })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <Field label="Trip name">
        <input className="input" value={form.name || ''} onChange={set('name')} data-autofocus />
      </Field>
      <Field label="Destination">
        <input className="input" value={form.destination || ''} onChange={set('destination')} />
      </Field>
      <div className="form-grid-2">
        <Field label="First night">
          <input className="input" type="date" value={form.startDate || ''} onChange={set('startDate')} />
        </Field>
        <Field label="Last day">
          <input
            className="input"
            type="date"
            value={form.endDate || ''}
            min={form.startDate || undefined}
            onChange={set('endDate')}
          />
        </Field>
      </div>
    </Sheet>
  )
}

function CampgroundSheet({ trip, cg, open, onClose }) {
  const { actions } = useApp()
  const toast = useToast()
  const [form, setForm] = useState({})
  React.useEffect(() => {
    if (open)
      setForm({
        name: cg?.name || '',
        location: cg?.location || '',
        address: cg?.address || '',
        phone: cg?.phone || '',
        website: cg?.website || '',
        hookups: cg?.hookups || '',
        siteNumber: trip.siteNumber || '',
        reservation: trip.reservation || '',
        checkIn: trip.checkIn || '',
        checkOut: trip.checkOut || '',
      })
  }, [open, trip, cg])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Campground"
      footer={
        <div className="btn-row">
          {cg && (
            <Button
              variant="soft"
              onClick={() => {
                actions.clearTripCampground(trip.id)
                toast('Campground removed from trip')
                onClose()
              }}
            >
              Unlink
            </Button>
          )}
          <Button
            full
            onClick={() => {
              if (!form.name.trim()) {
                toast('Add the campground name.')
                return
              }
              actions.setTripCampground(trip.id, form)
              toast('Campground saved', { icon: 'check' })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <Field label="Campground name">
        <input className="input" value={form.name || ''} onChange={set('name')} placeholder="Big Meadows Campground" data-autofocus />
      </Field>
      <div className="form-grid-2">
        <Field label="Site number">
          <input className="input" value={form.siteNumber || ''} onChange={set('siteNumber')} placeholder="A32" />
        </Field>
        <Field label="Reservation #">
          <input className="input" value={form.reservation || ''} onChange={set('reservation')} />
        </Field>
        <Field label="Check-in">
          <input className="input" type="time" value={form.checkIn || ''} onChange={set('checkIn')} />
        </Field>
        <Field label="Check-out">
          <input className="input" type="time" value={form.checkOut || ''} onChange={set('checkOut')} />
        </Field>
      </div>
      <Field label="Hookups">
        <Chips
          options={HOOKUP_TYPES.map((h) => ({ id: h, label: h }))}
          value={form.hookups}
          onChange={(v) => setForm((f) => ({ ...f, hookups: v || '' }))}
          ariaLabel="Hookup type"
        />
      </Field>
      <Field label="Address">
        <input className="input" value={form.address || ''} onChange={set('address')} placeholder="Street, town, state" />
      </Field>
      <Field label="Location" hint="Shown in your campground book — e.g. “Shenandoah National Park, VA”">
        <input className="input" value={form.location || ''} onChange={set('location')} />
      </Field>
      <div className="form-grid-2">
        <Field label="Phone">
          <input className="input" type="tel" value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Website">
          <input className="input" inputMode="url" value={form.website || ''} onChange={set('website')} />
        </Field>
      </div>
    </Sheet>
  )
}

function RouteSheet({ trip, cg, open, onClose }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const [form, setForm] = useState({})
  const [estimating, setEstimating] = useState(false)
  const rvMode = state.settings.rvMode
  React.useEffect(() => {
    if (open)
      setForm(
        trip.route || {
          from: '',
          to: cg?.address || trip.destination || '',
          miles: '',
          driveTime: '',
          notes: '',
        }
      )
  }, [open, trip, cg])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function estimate() {
    const fromQ = (form.from || '').trim()
    const toQ = (form.to || '').trim()
    if (!fromQ || !toQ) {
      toast('Fill in both ends of the route first — e.g. “Atlanta, GA”.')
      return
    }
    setEstimating(true)
    try {
      const a = await geocodePlace(fromQ)
      const b = a && (await geocodePlace(toQ))
      if (!a || !b) {
        toast(`Couldn’t place “${!a ? fromQ : toQ}” — try a town + state.`)
      } else {
        const miles = roadMilesEstimate(a, b)
        const time = driveTimeEstimate(miles, { rv: rvMode })
        setForm((f) => ({
          ...f,
          miles: String(miles),
          driveTime: time,
          fromCoord: { lat: a.lat, lon: a.lon, label: a.label },
          toCoord: { lat: b.lat, lon: b.lon, label: b.label },
        }))
        toast(`About ${miles} miles — ${time}${rvMode ? ' at RV pace' : ''}`, { icon: 'route', duration: 4200 })
      }
    } catch (err) {
      toast(err.message, { tone: 'danger' })
    }
    setEstimating(false)
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Route"
      footer={
        <div className="btn-row">
          {trip.route && (
            <Button variant="soft" onClick={() => {
              actions.updateTrip(trip.id, { route: null })
              onClose()
            }}>
              Clear
            </Button>
          )}
          <Button
            full
            onClick={() => {
              actions.updateTrip(trip.id, { route: { ...form } })
              onClose()
            }}
          >
            Save
          </Button>
        </div>
      }
    >
      <Field label="Starting from">
        <input className="input" value={form.from || ''} onChange={set('from')} placeholder="Atlanta, GA" data-autofocus />
      </Field>
      <Field label="Destination address">
        <input className="input" value={form.to || ''} onChange={set('to')} placeholder="Big Meadows Campground, VA" />
      </Field>
      <Button
        variant="soft"
        small
        icon="route"
        onClick={estimate}
        disabled={estimating}
        style={{ marginBottom: 14 }}
      >
        {estimating ? 'Estimating…' : rvMode ? 'Estimate distance & RV drive time' : 'Estimate distance & drive time'}
      </Button>
      <div className="form-grid-2">
        <Field label="Mileage">
          <input className="input" inputMode="numeric" value={form.miles || ''} onChange={set('miles')} placeholder="96" />
        </Field>
        <Field label="Drive time">
          <input className="input" value={form.driveTime || ''} onChange={set('driveTime')} placeholder="2h 15m" />
        </Field>
      </div>
      <Field label="Notes">
        <textarea className="textarea" rows={2} value={form.notes || ''} onChange={set('notes')} placeholder="Fuel stops, low clearances, the scenic way in…" />
      </Field>
      {rvMode && (
        <p className="field-hint">
          Estimates assume RV pace (fuel and rest stops included). Real directions open in Apple or
          Google Maps.
        </p>
      )}
    </Sheet>
  )
}
