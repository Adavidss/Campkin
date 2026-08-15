import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, campgroundVisits } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import {
  Button, Card, Chips, EmptyState, Stars, useToast, Sheet, Field, Segmented,
} from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import BookingSheet from '../components/BookingSheet.jsx'
import { HOOKUP_TYPES } from '../data/model.js'
import { fetchNearbyCampgrounds, geocodePlace, currentPosition } from '../lib/osm.js'
import { haversineMiles, formatMiles, rvFit } from '../lib/geo.js'
import { topPicks } from '../lib/recommend.js'
import { appleMapsDirections, googleMapsDirections, telHref, normalizeUrl } from '../lib/maps.js'
import { plural } from '../lib/util.js'
import { useMapDark } from '../lib/hooks.js'

// Where Find Nearby was last centered (survives tab hops within the session,
// and lets Trip Mode's "Nearby" jump straight to the campground).
export function setExploreCenter(center) {
  try {
    sessionStorage.setItem('campkin-explore', JSON.stringify(center))
  } catch {
    /* ignore */
  }
}

function getExploreCenter() {
  try {
    return JSON.parse(sessionStorage.getItem('campkin-explore'))
  } catch {
    return null
  }
}

export default function Campgrounds({ tab = 'book' }) {
  return (
    <>
      <div className="page-head" style={{ marginBottom: 12 }}>
        <div>
          <h1 className="page-title">Campgrounds</h1>
        </div>
      </div>
      <Segmented
        options={[
          { id: 'book', label: 'My Book' },
          { id: 'find', label: 'Find Nearby' },
        ]}
        value={tab}
        onChange={(v) => navigate(v === 'book' ? 'campgrounds' : 'campgrounds/find')}
        ariaLabel="Campgrounds section"
      />
      <div style={{ marginTop: 16 }}>{tab === 'find' ? <FindNearby /> : <Book />}</div>
    </>
  )
}

/* ---- My Book (saved campgrounds) ------------------------------------------ */

function Book() {
  const { state, actions } = useApp()
  const toast = useToast()
  const [filter, setFilter] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  let list = [...state.campgrounds].sort((a, b) => a.name.localeCompare(b.name))
  if (filter === 'favorites') list = list.filter((c) => c.favorite)
  if (filter === 'return') list = list.filter((c) => c.returnSomeday)

  return (
    <>
      {state.campgrounds.length > 0 && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Chips
              options={[
                { id: 'favorites', label: 'Favorites', icon: 'heart' },
                { id: 'return', label: 'Return Someday', icon: 'bookmark' },
              ]}
              value={filter}
              onChange={setFilter}
              ariaLabel="Filter campgrounds"
            />
          </div>
          <Button icon="plus" small variant="soft" onClick={() => setAddOpen(true)}>
            Add
          </Button>
        </div>
      )}

      {state.campgrounds.length === 0 ? (
        <EmptyState
          icon="tent"
          title="No campgrounds yet"
          text="Stay somewhere on a trip — or find one on the map — and it joins your book."
        >
          <Button variant="soft" icon="map" onClick={() => navigate('campgrounds/find')}>
            Find Nearby
          </Button>
          <Button variant="ghost" icon="plus" onClick={() => setAddOpen(true)}>
            Add by hand
          </Button>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={filter === 'favorites' ? 'heart' : 'bookmark'}
          title={filter === 'favorites' ? 'No favorites yet' : 'Nothing saved yet'}
          text={
            filter === 'favorites'
              ? 'Tap the heart on a campground you loved.'
              : 'Mark campgrounds “Return Someday” to build your wish list.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((cg) => (
            <CampgroundCard key={cg.id} cg={cg} />
          ))}
        </div>
      )}

      <AddCampgroundSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(fields) => {
          const cg = actions.addCampground(fields)
          toast('Campground added', { icon: 'check' })
          navigate(`campground/${cg.id}`)
        }}
      />
    </>
  )
}

function CampgroundCard({ cg }) {
  const { state } = useApp()
  const visits = campgroundVisits(state, cg.id)
  return (
    <Card as="button" className="card-tappable" onClick={() => navigate(`campground/${cg.id}`)} style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="trip-card-title" style={{ fontSize: 19 }}>{cg.name}</div>
          {cg.location && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 1 }}>{cg.location}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--clay)' }}>
          {cg.sample && <span className="tag-sample">Sample</span>}
          {cg.favorite && <Icon name="heart" size={16} filled />}
          {cg.returnSomeday && <Icon name="bookmark" size={16} filled style={{ color: 'var(--sand-deep)' }} />}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {cg.rating > 0 && <Stars value={cg.rating} size={14} />}
        {visits.length > 0 && (
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{plural(visits.length, 'stay')}</span>
        )}
        {cg.hookups && <span className="badge" style={{ position: 'static' }}>{cg.hookups}</span>}
        {cg.lat != null && (
          <span style={{ fontSize: 12.5, color: 'var(--ink-faint)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Icon name="pin" size={12} /> mapped
          </span>
        )}
      </div>
    </Card>
  )
}

function AddCampgroundSheet({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', location: '', hookups: '' })
  useEffect(() => {
    if (open) setForm({ name: '', location: '', hookups: '' })
  }, [open])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a Campground"
      footer={
        <Button
          full
          onClick={() => {
            if (!form.name.trim()) return
            onAdd(form)
            onClose()
          }}
        >
          Add Campground
        </Button>
      }
    >
      <Field label="Name">
        <input className="input" value={form.name} onChange={set('name')} placeholder="Big Meadows Campground" data-autofocus />
      </Field>
      <Field label="Location">
        <input className="input" value={form.location} onChange={set('location')} placeholder="Shenandoah National Park, VA" />
      </Field>
      <Field label="Hookups">
        <Chips
          options={HOOKUP_TYPES.map((h) => ({ id: h, label: h }))}
          value={form.hookups}
          onChange={(v) => setForm((f) => ({ ...f, hookups: v || '' }))}
          ariaLabel="Hookups"
        />
      </Field>
    </Sheet>
  )
}

/* ---- Find Nearby (Overpass + Leaflet) ------------------------------------- */

const RADII = [10, 25, 50]

function FindNearby() {
  const { state, actions } = useApp()
  const toast = useToast()
  const [center, setCenter] = useState(getExploreCenter())
  const [radius, setRadius] = useState(25)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [rvOnly, setRvOnly] = useState(state.settings.rvMode)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [mapCenter, setMapCenter] = useState(null) // where the map has drifted
  const [userLoc, setUserLoc] = useState(null)
  const [picksOpen, setPicksOpen] = useState(false)
  const abortRef = useRef(null)
  const listRef = useRef(null)
  const mapDark = useMapDark()

  const rvLen = parseFloat(state.settings.rv?.lengthFt) || null
  const rvModeOn = state.settings.rvMode

  async function search(at, label) {
    abortRef.current?.abort()
    const ctrl = new AbortController()
    abortRef.current = ctrl
    setLoading(true)
    setError(null)
    setSelected(null)
    try {
      const found = await fetchNearbyCampgrounds(at.lat, at.lon, radius, { signal: ctrl.signal })
      setCenter({ ...at, label: label || at.label })
      setExploreCenter({ ...at, label: label || at.label })
      setMapCenter(null)
      setResults(found)
    } catch (err) {
      if (err.name === 'AbortError') return
      setError({ message: err.message, at, label })
    }
    setLoading(false)
  }

  // If a center was handed over (e.g. Trip Mode "Nearby"), search on arrival.
  useEffect(() => {
    if (center && results === null) search(center, center.label)
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-search when the radius changes on an existing center.
  useEffect(() => {
    if (center && results !== null) search(center, center.label)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius])

  async function locateMe() {
    setLoading(true)
    try {
      const pos = await currentPosition()
      setUserLoc(pos)
      await search(pos, 'Near you')
    } catch (err) {
      setLoading(false)
      toast(err.message, { duration: 4500 })
    }
  }

  async function submitSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const place = await geocodePlace(query)
      if (!place) {
        setLoading(false)
        toast(`Couldn’t find “${query.trim()}” — try a town or park name.`)
        return
      }
      await search(place, place.label)
    } catch (err) {
      setLoading(false)
      toast(err.message, { tone: 'danger' })
    }
  }

  const withDistance = useMemo(() => {
    if (!results) return []
    return results
      .map((r) => ({ ...r, distance: center ? haversineMiles(center, r) : 0 }))
      .sort((a, b) => a.distance - b.distance)
  }, [results, center])

  const shown = useMemo(() => {
    let list = withDistance
    if (rvOnly) list = list.filter((r) => r.caravans === 'yes')
    return list.slice(0, 40)
  }, [withDistance, rvOnly])

  const picks = useMemo(
    () => (picksOpen ? topPicks(withDistance, { rvLen, rvMode: rvModeOn }) : []),
    [picksOpen, withDistance, rvLen, rvModeOn]
  )

  const markers = shown.map((r) => ({
    id: r.osmId,
    lat: r.lat,
    lon: r.lon,
    kind: r.kind,
    selected: selected?.osmId === r.osmId,
    onClick: () => {
      setSelected(r)
      listRef.current?.querySelector(`[data-osm="${CSS.escape(r.osmId)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
  }))

  const savedIds = new Set(state.campgrounds.map((c) => c.osmId).filter(Boolean))

  return (
    <>
      <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Town, park, or area…"
            aria-label="Search for a place"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" variant="soft" onClick={submitSearch} disabled={loading}>
          Search
        </Button>
      </form>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <Button variant="soft" small icon="crosshair" onClick={locateMe} disabled={loading}>
          Near me
        </Button>
        <Chips
          options={RADII.map((r) => ({ id: r, label: `${r} mi` }))}
          value={radius}
          onChange={(v) => v && setRadius(v)}
          ariaLabel="Search radius"
        />
        <button
          type="button"
          className={`chip ${rvOnly ? 'is-active' : ''}`}
          aria-pressed={rvOnly}
          onClick={() => setRvOnly((v) => !v)}
        >
          <Icon name="rv" size={14} /> RV sites
        </button>
        {results && results.length > 0 && (
          <button type="button" className="chip chip-picks" onClick={() => setPicksOpen(true)}>
            <Icon name="sparkle" size={14} /> Top picks
          </button>
        )}
      </div>

      <div className="map-wrap">
        <MapView
          center={center ? { lat: center.lat, lon: center.lon } : { lat: 39.4, lon: -97.6 }}
          zoom={center ? (radius === 10 ? 11 : radius === 25 ? 10 : 9) : 4}
          markers={markers}
          user={userLoc}
          dark={mapDark}
          onMoved={(c, z) => {
            if (!center) return
            const drifted = haversineMiles(c, center) > 1.5
            setMapCenter(drifted ? c : null)
          }}
          height={300}
        />
        <button
          type="button"
          className="map-style-btn"
          aria-label={mapDark ? 'Switch map to light' : 'Switch map to dark'}
          title={mapDark ? 'Light map' : 'Dark map'}
          onClick={() => actions.updateSettings({ mapDark: !mapDark })}
        >
          <Icon name={mapDark ? 'sun' : 'moon'} size={18} />
        </button>
        {mapCenter && (
          <Button
            small
            className="map-search-btn"
            icon="refresh"
            onClick={() => search(mapCenter, 'This area')}
            disabled={loading}
          >
            Search this area
          </Button>
        )}
        {!center && !loading && (
          <div className="map-cta">
            <p>
              {rvModeOn
                ? 'Find RV-friendly campgrounds anywhere — sized to your rig.'
                : 'Find campgrounds anywhere you’re headed.'}
            </p>
            <Button small icon="crosshair" onClick={locateMe}>
              Use My Location
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, margin: '14px 0' }}>
          Looking for campgrounds…
        </p>
      )}

      {error && !loading && (
        <EmptyState compact icon="refresh" title="The map service is catching its breath" text={error.message}>
          <Button variant="soft" small icon="refresh" onClick={() => search(error.at, error.label)}>
            Try again
          </Button>
        </EmptyState>
      )}

      {center && !loading && !error && results && (
        <>
          <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '12px 2px 10px' }}>
            {shown.length === 0
              ? rvOnly
                ? 'No listed RV sites here — try turning off the RV filter; many campgrounds simply don’t list it.'
                : 'Nothing mapped in this area.'
              : `${shown.length} ${rvOnly ? 'RV-friendly spots' : 'campgrounds'} near ${center.label || 'here'}`}
            {rvModeOn && rvLen ? ` · your rig: ${rvLen} ft` : ''}
          </p>
          <div ref={listRef}>
            {shown.map((r) => (
              <FoundRow
                key={r.osmId}
                r={r}
                rvLen={rvModeOn ? rvLen : null}
                saved={savedIds.has(r.osmId)}
                selected={selected?.osmId === r.osmId}
                onClick={() => setSelected(r)}
              />
            ))}
          </div>
        </>
      )}

      <FoundSheet
        r={selected}
        rvLen={rvModeOn ? rvLen : null}
        saved={selected ? savedIds.has(selected.osmId) : false}
        onClose={() => setSelected(null)}
        onSave={() => {
          const cg = actions.saveCampgroundFromMap(selected)
          toast('Saved to your book', { icon: 'tent' })
          return cg
        }}
      />

      <RecommendSheet
        open={picksOpen}
        onClose={() => setPicksOpen(false)}
        picks={picks}
        center={center}
        rvMode={rvModeOn}
        rvLen={rvLen}
        savedIds={savedIds}
        onShow={(r) => {
          setPicksOpen(false)
          setSelected(r)
        }}
        onSave={(r) => {
          actions.saveCampgroundFromMap(r)
          toast('Saved to your book', { icon: 'tent' })
        }}
      />
    </>
  )
}

function RecommendSheet({ open, onClose, picks, center, rvMode, rvLen, savedIds, onShow, onSave }) {
  return (
    <Sheet open={open} onClose={onClose} title={rvMode ? 'Top RV picks' : 'Top camping picks'} wide>
      <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 14px', lineHeight: 1.5 }}>
        Ranked from what’s mapped within reach of {center?.label || 'here'}
        {rvMode && rvLen ? `, sized against your ${rvLen} ft rig` : ''}. Every reason is shown —
        always confirm with the campground before rolling in.
      </p>
      {picks.length === 0 ? (
        <EmptyState
          compact
          icon="sparkle"
          title="Nothing to recommend here"
          text={
            rvMode
              ? 'Nothing mapped nearby lists RV camping. Try a wider radius or another area.'
              : 'Nothing mapped nearby to rank. Try a wider radius.'
          }
        />
      ) : (
        picks.map((r, i) => (
          <div key={r.osmId} className="pick-card">
            <div className="pick-head">
              <span className="pick-rank">{i + 1}</span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="pick-name">{r.name}</div>
                <div className="pick-sub">
                  {r.kind === 'rv-park' ? 'RV park' : 'Campground'} · {formatMiles(r.distance)}
                </div>
              </div>
              {savedIds.has(r.osmId) && <Icon name="check" size={16} style={{ color: 'var(--sage)' }} />}
            </div>
            <ul className="pick-reasons">
              {r.reasons.map((re, j) => (
                <li key={j} className={`pick-reason tone-${re.tone}`}>
                  <Icon
                    name={re.tone === 'good' ? 'check' : re.tone === 'warn' ? 'info' : 'pin'}
                    size={12}
                  />
                  {re.text}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
              <Button variant="soft" small icon="pin" onClick={() => onShow(r)}>
                Show on map
              </Button>
              <Button
                variant="soft"
                small
                icon="map"
                href={appleMapsDirections(`${r.lat},${r.lon}`)}
                target="_blank"
                rel="noopener"
              >
                Directions
              </Button>
              {!savedIds.has(r.osmId) && (
                <Button variant="ghost" small icon="tent" onClick={() => onSave(r)}>
                  Save
                </Button>
              )}
            </div>
          </div>
        ))
      )}
    </Sheet>
  )
}

function fitBadge(fit, maxLen) {
  if (fit === 'fits') return { label: `Fits · max ${maxLen} ft`, cls: 'is-fits' }
  if (fit === 'tight') return { label: `Tight · max ${maxLen} ft`, cls: 'is-tight' }
  if (fit === 'no') return { label: `Max ${maxLen} ft`, cls: 'is-no' }
  return null
}

function FoundRow({ r, rvLen, saved, selected, onClick }) {
  const fit = rvFit(r.maxLengthFt, rvLen)
  const badge = fitBadge(fit, r.maxLengthFt)
  return (
    <button
      type="button"
      data-osm={r.osmId}
      className={`list-row is-tappable found-row ${selected ? 'is-selected' : ''}`}
      onClick={onClick}
      style={{ width: '100%' }}
    >
      <span className="row-icon" style={r.kind === 'rv-park' ? { color: 'var(--clay)' } : undefined}>
        <Icon name={r.kind === 'rv-park' ? 'rv' : 'tent'} size={20} />
      </span>
      <span className="row-main">
        <span className="row-title">{r.name}</span>
        <span className="row-sub">
          {[
            formatMiles(r.distance),
            r.kind === 'rv-park' ? 'RV park' : r.caravans === 'yes' ? 'RV sites' : r.caravans === 'no' ? 'No RVs' : null,
            r.power ? 'power' : null,
            r.dump ? 'dump station' : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </span>
      <span className="row-right">
        {badge && <span className={`fit-badge ${badge.cls}`}>{badge.label}</span>}
        {saved && <Icon name="check" size={15} style={{ color: 'var(--sage)' }} />}
        <Icon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

function FoundSheet({ r, rvLen, saved, onClose, onSave }) {
  const [justSaved, setJustSaved] = useState(false)
  const [booking, setBooking] = useState(false)
  useEffect(() => {
    setJustSaved(false)
    setBooking(false)
  }, [r?.osmId])
  if (!r) return null
  const fit = rvFit(r.maxLengthFt, rvLen)
  const facts = [
    r.kind === 'rv-park' ? 'RV park' : 'Campground',
    r.caravans === 'yes' ? 'RV sites' : r.caravans === 'no' ? 'No RV sites' : 'RV info not listed',
    r.tents === 'yes' ? 'Tent sites' : null,
    r.power ? 'Electric hookups' : null,
    r.water ? 'Drinking water' : null,
    r.dump ? 'Dump station' : null,
    r.fee === false ? 'Free' : r.fee ? 'Fee' : null,
    r.reservation === 'required' ? 'Reservation required' : null,
    r.operator || null,
  ].filter(Boolean)

  return (
    <Sheet
      open={!!r}
      onClose={onClose}
      title=""
      footer={
        <div className="btn-row">
          <Button full icon="calendar" onClick={() => setBooking(true)}>
            Book
          </Button>
          <Button
            variant="soft"
            full
            icon="map"
            href={appleMapsDirections(`${r.lat},${r.lon}`)}
            target="_blank"
            rel="noopener"
          >
            Directions
          </Button>
          <Button
            variant="soft"
            full
            icon={saved || justSaved ? 'check' : 'tent'}
            disabled={saved || justSaved}
            onClick={() => {
              onSave()
              setJustSaved(true)
            }}
          >
            {saved || justSaved ? 'Saved' : 'Save'}
          </Button>
        </div>
      }
    >
      <div style={{ paddingBottom: 4 }}>
        <h3 style={{ fontSize: 22 }}>{r.name}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 3 }}>
          {formatMiles(r.distance || 0)} away
        </p>

        {rvLen && (
          <div className={`rv-fit-note ${fit === 'no' ? 'is-no' : fit === 'tight' ? 'is-tight' : ''}`}>
            <Icon name="rv" size={16} />
            {fit === 'fits' && `Listed max length ${r.maxLengthFt} ft — fits your ${rvLen} ft rig.`}
            {fit === 'tight' && `Listed max length ${r.maxLengthFt} ft — tight for your ${rvLen} ft rig.`}
            {fit === 'no' && `Listed max length ${r.maxLengthFt} ft — under your ${rvLen} ft rig.`}
            {fit === 'unknown' && 'No length limit listed — call ahead to check your rig fits.'}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {facts.map((f) => (
            <span key={f} className="badge" style={{ position: 'static' }}>
              {f}
            </span>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          {r.phone && (
            <Button variant="soft" small icon="phone" href={telHref(r.phone)}>
              Call
            </Button>
          )}
          {r.website && (
            <Button variant="soft" small icon="globe" href={normalizeUrl(r.website)} target="_blank" rel="noopener">
              Website
            </Button>
          )}
          <Button
            variant="ghost"
            small
            icon="external"
            href={googleMapsDirections(`${r.lat},${r.lon}`)}
            target="_blank"
            rel="noopener"
          >
            Google Maps
          </Button>
        </div>
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 14, lineHeight: 1.5 }}>
          Details come from OpenStreetMap and can be incomplete — confirm sites, size limits, and
          availability with the campground.
        </p>
      </div>
      <BookingSheet open={booking} onClose={() => setBooking(false)} cg={r} />
    </Sheet>
  )
}
