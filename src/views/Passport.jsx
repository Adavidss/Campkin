import React, { useMemo, useState } from 'react'
import { useApp, passportCounts, visitedStates } from '../data/store.jsx'
import { navigate, Link } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import {
  Button, Card, Chips, Segmented, Sheet, ConfirmSheet, EmptyState, Field, ListRow, useToast,
} from '../components/ui.jsx'
import { useCelebrate } from '../components/Celebrate.jsx'
import Stamp from '../components/Stamp.jsx'
import PlaceSheet from '../components/PlaceSheet.jsx'
import USMap from '../components/USMap.jsx'
import WikiCard from '../components/WikiCard.jsx'
import { NATIONAL_PARKS, PARK_BY_ID } from '../data/parks.js'
import { CATEGORY_BY_ID, PLACE_CATEGORIES } from '../data/model.js'
import { STATES, stateName } from '../lib/states.js'
import { fmtDate, todayISO } from '../lib/dates.js'
import { plural } from '../lib/util.js'

export default function Passport({ tab }) {
  const { state } = useApp()
  const counts = passportCounts(state)

  return (
    <>
      <div className="page-head" style={{ marginBottom: 10 }}>
        <div>
          <h1 className="page-title">Passport</h1>
        </div>
      </div>

      <div className="passport-totals">
        <span><b>{counts.places}</b> {counts.places === 1 ? 'Place' : 'Places'}</span>
        <span><b>{counts.parks}</b> {counts.parks === 1 ? 'National Park' : 'National Parks'}</span>
        <span><b>{counts.states}</b> {counts.states === 1 ? 'State' : 'States'}</span>
      </div>

      <Segmented
        options={[
          { id: 'stamps', label: 'Stamps' },
          { id: 'parks', label: 'Parks' },
          { id: 'states', label: 'States' },
        ]}
        value={tab}
        onChange={(v) => navigate(v === 'stamps' ? 'passport' : `passport/${v}`)}
        ariaLabel="Passport section"
        className="fade-up"
      />

      <div style={{ marginTop: 18 }}>
        {tab === 'stamps' && <StampsTab />}
        {tab === 'parks' && <ParksTab />}
        {tab === 'states' && <StatesTab />}
      </div>
    </>
  )
}

/* ---- stamps --------------------------------------------------------------- */

function StampsTab() {
  const { state } = useApp()
  const [filter, setFilter] = useState(null)
  const [addOpen, setAddOpen] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [editOpen, setEditOpen] = useState(false)

  const stamps = useMemo(() => {
    let list = state.places.filter((p) => p.visited)
    if (filter === 'favorites') list = list.filter((p) => p.favorite)
    else if (filter) list = list.filter((p) => p.category === filter)
    return list.sort((a, b) => ((a.dateVisited || '') > (b.dateVisited || '') ? -1 : 1))
  }, [state.places, filter])

  const filterOptions = [
    { id: 'favorites', label: 'Favorites', icon: 'heart' },
    ...PLACE_CATEGORIES.filter((c) => state.places.some((p) => p.visited && p.category === c.id)).map(
      (c) => ({ id: c.id, label: c.label })
    ),
  ]

  const viewingPlace = viewing ? state.places.find((p) => p.id === viewing) : null

  return (
    <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Chips className="is-nowrap" options={filterOptions} value={filter} onChange={setFilter} ariaLabel="Filter stamps" />
        </div>
        <Button icon="plus" small onClick={() => setAddOpen(true)}>
          Add
        </Button>
      </div>

      {stamps.length === 0 ? (
        <EmptyState
          icon="passport"
          title={filter ? 'No stamps here yet' : 'Your passport is waiting'}
          text={
            filter
              ? 'Try another filter, or add a place.'
              : 'Every park, campground, town, and viewpoint you visit collects a stamp.'
          }
        >
          <Button icon="plus" onClick={() => setAddOpen(true)}>
            Add a Place
          </Button>
        </EmptyState>
      ) : (
        <div className="stamp-grid">
          {stamps.map((p) => (
            <Stamp key={p.id} place={p} onClick={() => setViewing(p.id)} />
          ))}
        </div>
      )}

      <PlaceSheet open={addOpen} onClose={() => setAddOpen(false)} place={null} />
      <PlaceSheet open={editOpen} onClose={() => setEditOpen(false)} place={viewingPlace} />

      <StampSheet
        place={editOpen ? null : viewingPlace}
        onClose={() => setViewing(null)}
        onEdit={() => setEditOpen(true)}
      />
    </>
  )
}

function StampSheet({ place, onClose, onEdit }) {
  const { state, actions } = useApp()
  if (!place) return null
  const cat = CATEGORY_BY_ID[place.category] || CATEGORY_BY_ID.other
  const trip = place.tripId ? state.trips.find((t) => t.id === place.tripId) : null
  return (
    <Sheet
      open={!!place}
      onClose={onClose}
      title=""
      footer={
        <div className="btn-row">
          <Button variant="soft" icon="pencil" full onClick={onEdit}>
            Edit
          </Button>
          {place.source === 'campground' && place.refId && (
            <Button variant="soft" full icon="tent" onClick={() => { onClose(); navigate(`campground/${place.refId}`) }}>
              Campground
            </Button>
          )}
          {place.source === 'park' && place.refId && (
            <Button variant="soft" full icon="mountains" onClick={() => { onClose(); navigate('passport/parks') }}>
              Park record
            </Button>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, paddingBottom: 8 }}>
        <div style={{ width: 170 }}>
          <Stamp place={place} />
        </div>
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>{place.name}</div>
          <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 2 }}>
            {[cat.label, place.state && stateName(place.state), place.dateVisited && fmtDate(place.dateVisited)]
              .filter(Boolean)
              .join(' · ')}
          </div>
          {trip && (
            <Link to={`trip/${trip.id}`} onClick={onClose} style={{ fontSize: 13.5, display: 'inline-block', marginTop: 6 }}>
              From “{trip.name}” →
            </Link>
          )}
          {place.notes && (
            <p style={{ fontSize: 14.5, color: 'var(--ink-soft)', marginTop: 10, fontStyle: 'italic' }}>
              “{place.notes}”
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <Button
            variant={place.favorite ? 'solid' : 'soft'}
            small
            icon="heart"
            aria-pressed={place.favorite}
            onClick={() => actions.updatePlace(place.id, { favorite: !place.favorite })}
          >
            Favorite
          </Button>
          <Button
            variant={place.returnSomeday ? 'solid' : 'soft'}
            small
            icon="bookmark"
            aria-pressed={place.returnSomeday}
            onClick={() => actions.updatePlace(place.id, { returnSomeday: !place.returnSomeday })}
          >
            Return Someday
          </Button>
        </div>
      </div>
    </Sheet>
  )
}

/* ---- national parks -------------------------------------------------------- */

function ParksTab() {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState(null)
  const [stateFilter, setStateFilter] = useState('')
  const [openPark, setOpenPark] = useState(null)

  const visitedCount = Object.values(state.parks).filter((r) => r.status === 'visited').length

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return NATIONAL_PARKS.filter((p) => {
      const rec = state.parks[p.id]
      if (q && !p.name.toLowerCase().includes(q)) return false
      if (stateFilter && !p.states.includes(stateFilter)) return false
      if (status === 'visited' && rec?.status !== 'visited') return false
      if (status === 'want' && rec?.status !== 'want') return false
      if (status === 'not' && rec?.status) return false
      return true
    })
  }, [state.parks, query, status, stateFilter])

  return (
    <>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 2px 12px' }}>
        {visitedCount} of {NATIONAL_PARKS.length} parks visited
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon
            name="search"
            size={16}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }}
          />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search parks"
            aria-label="Search national parks"
          />
        </div>
        <select
          className="select"
          style={{ width: 110 }}
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          aria-label="Filter by state"
        >
          <option value="">All states</option>
          {STATES.map((s) => (
            <option key={s.ab} value={s.ab}>
              {s.ab}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Chips
          options={[
            { id: 'visited', label: 'Visited' },
            { id: 'want', label: 'Want to Visit' },
            { id: 'not', label: 'Not Yet' },
          ]}
          value={status}
          onChange={setStatus}
          ariaLabel="Filter by status"
        />
      </div>

      {list.length === 0 ? (
        <EmptyState compact icon="mountains" title="No parks match" text="Try clearing the search or filters." />
      ) : (
        list.map((park) => {
          const rec = state.parks[park.id]
          return (
            <ListRow
              key={park.id}
              icon={park.motif}
              title={park.name}
              sub={park.states.map((ab) => stateName(ab)).join(', ')}
              onClick={() => setOpenPark(park.id)}
              right={
                <>
                  {rec?.favorite && <Icon name="heart" size={14} filled style={{ color: 'var(--clay)' }} />}
                  {rec?.status === 'visited' && (
                    <span className="park-status is-visited">
                      <Icon name="check" size={12} /> Visited
                    </span>
                  )}
                  {rec?.status === 'want' && (
                    <span className="park-status is-want">
                      <Icon name="bookmark" size={12} /> Want to
                    </span>
                  )}
                  <Icon name="chevronRight" size={16} />
                </>
              }
            />
          )
        })
      )}

      <ParkSheet parkId={openPark} onClose={() => setOpenPark(null)} />
    </>
  )
}

function ParkSheet({ parkId, onClose }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const celebrate = useCelebrate()
  const [visitDate, setVisitDate] = useState(todayISO())
  const [confirmClear, setConfirmClear] = useState(false)
  const park = parkId ? PARK_BY_ID[parkId] : null
  if (!park) return null
  const rec = state.parks[park.id]
  const visited = rec?.status === 'visited'

  return (
    <>
      <Sheet open={!!park} onClose={onClose} title="">
        <div style={{ textAlign: 'center', paddingBottom: 6 }}>
          <span
            className="row-icon"
            style={{ width: 54, height: 54, borderRadius: 16, margin: '0 auto', display: 'flex' }}
          >
            <Icon name={park.motif} size={28} />
          </span>
          <h3 style={{ fontSize: 23, marginTop: 10 }}>{park.name}</h3>
          <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 2 }}>
            National Park · {park.states.map((ab) => stateName(ab)).join(', ')}
          </div>
        </div>
        <WikiCard variant="hero" hint={{ name: `${park.name} National Park`, kind: 'National Park' }} />

        {visited ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, margin: '10px 0 4px', flexWrap: 'wrap' }}>
              <span className="park-status is-visited" style={{ fontSize: 13 }}>
                <Icon name="check" size={13} /> Visited {plural(rec.visits.length, 'time')}
              </span>
              <Button
                variant={rec.favorite ? 'solid' : 'soft'}
                small
                icon="heart"
                aria-pressed={!!rec.favorite}
                onClick={() => actions.toggleParkFavorite(park.id)}
              >
                Favorite
              </Button>
            </div>
            <div style={{ margin: '12px 0' }}>
              {rec.visits.map((v) => (
                <ListRow
                  key={v.date}
                  icon="calendar"
                  title={fmtDate(v.date)}
                  sub={v.tripId && state.trips.find((t) => t.id === v.tripId)?.name}
                  right={
                    rec.visits.length > 1 && (
                      <button
                        type="button"
                        className="icon-btn"
                        style={{ width: 32, height: 32 }}
                        aria-label={`Remove visit on ${fmtDate(v.date)}`}
                        onClick={() => actions.removeParkVisit(park.id, v.date)}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    )
                  }
                />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                aria-label="New visit date"
              />
              <Button
                variant="soft"
                onClick={() => {
                  actions.addParkVisit(park.id, visitDate)
                  toast('Visit added', { icon: 'check' })
                }}
              >
                Add visit
              </Button>
            </div>
            <Button
              variant="ghost"
              full
              style={{ marginTop: 12, color: 'var(--danger)' }}
              onClick={() => setConfirmClear(true)}
            >
              Remove from visited
            </Button>
          </>
        ) : (
          <>
            <Field label="When did you visit?" className="fade-up">
              <input className="input" type="date" value={visitDate} onChange={(e) => setVisitDate(e.target.value)} />
            </Field>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Button
                full
                icon="passport"
                onClick={() => {
                  actions.markParkVisited(park.id, { date: visitDate })
                  celebrate({ title: `${park.name}, stamped.`, sub: 'One more National Park in your passport.', stampWord: 'VISITED', icon: park.motif, kind: 'park' })
                }}
              >
                Mark Visited
              </Button>
              <Button
                variant={rec?.status === 'want' ? 'solid' : 'soft'}
                full
                icon="bookmark"
                aria-pressed={rec?.status === 'want'}
                onClick={() => {
                  actions.setParkWantToVisit(park.id, rec?.status !== 'want')
                }}
              >
                {rec?.status === 'want' ? 'On your Want to Visit list' : 'Want to Visit'}
              </Button>
            </div>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="Remove from visited?"
        message={`${park.name} will lose its visit dates and its passport stamp.`}
        confirmLabel="Remove"
        danger
        onConfirm={() => {
          actions.clearParkRecord(park.id)
          onClose()
        }}
      />
    </>
  )
}

/* ---- states ---------------------------------------------------------------- */

function StatesTab() {
  const { state, actions } = useApp()
  const toast = useToast()
  const visited = visitedStates(state)

  return (
    <>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 2px 14px' }}>
        <b style={{ color: 'var(--ink-soft)' }}>{visited.size}</b> of 50 states visited
      </p>
      <Card>
        <USMap
          visited={visited}
          onToggle={(ab, isVisited) => {
            actions.toggleStateManual(ab, isVisited)
            toast(isVisited ? `${stateName(ab)} unmarked` : `${stateName(ab)} marked visited`, {
              icon: isVisited ? undefined : 'check',
            })
          }}
        />
      </Card>
      <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '10px 4px 0', lineHeight: 1.5 }}>
        States fill in from your trips, campgrounds, and passport places. Tap any state to correct
        the record by hand.
      </p>
    </>
  )
}
