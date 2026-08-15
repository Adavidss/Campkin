import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Sheet, EmptyState, Chips, useToast } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { NATIONAL_PARKS } from '../data/parks.js'
import { fetchNearbyDestinations, geocodePlace, currentPosition, reverseGeocode } from '../lib/osm.js'
import { haversineMiles, formatMiles, roadMilesEstimate, driveTimeEstimate } from '../lib/geo.js'
import { curateTrip } from '../lib/curate.js'
import { poiIcon, poiTypeLabel } from '../lib/pois.js'
import { weatherMeta } from '../lib/weather.js'
import { stateName } from '../lib/states.js'
import { useMapDark } from '../lib/hooks.js'
import { weekendOf, toISO, parseISO, todayISO } from '../lib/dates.js'
import { setExploreCenter } from './Campgrounds.jsx'

const RANGES = [50, 120, 250]
const KIND_META = {
  'national-park': { label: 'National Park', icon: 'mountains' },
  'state-park': { label: 'State Park', icon: 'forest' },
  'national-forest': { label: 'National Forest', icon: 'tree' },
  beach: { label: 'Seashore', icon: 'waves' },
  recreation: { label: 'Recreation Area', icon: 'pin' },
}

// Roughly what makes a satisfying trip anchor: national parks first, then
// state parks & forests, then everything else — closer wins within a tier.
const KIND_RANK = { 'national-park': 0, 'state-park': 1, 'national-forest': 1, beach: 1, recreation: 2 }

export default function QuickTrip() {
  const { state } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [origin, setOrigin] = useState(null)
  const [query, setQuery] = useState('')
  const [range, setRange] = useState(120)
  const [osmDests, setOsmDests] = useState(null) // null | 'loading' | []
  const [selected, setSelected] = useState(null)
  const [busy, setBusy] = useState(false)
  const listRef = useRef(null)
  const rvMode = state.settings.rvMode

  async function locateMe() {
    setBusy(true)
    try {
      const pos = await currentPosition()
      const label = await reverseGeocode(pos.lat, pos.lon).catch(() => null)
      setOrigin({ ...pos, label: label || 'your location', isUser: true })
    } catch (err) {
      toast(err.message, { duration: 4500 })
    }
    setBusy(false)
  }

  async function submitSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setBusy(true)
    try {
      const place = await geocodePlace(query)
      if (!place) toast(`Couldn’t find “${query.trim()}”.`)
      else setOrigin(place)
    } catch (err) {
      toast(err.message, { tone: 'danger' })
    }
    setBusy(false)
  }

  // Load OSM destinations for the current origin + range.
  useEffect(() => {
    if (!origin) return
    let live = true
    setOsmDests('loading')
    fetchNearbyDestinations(origin.lat, origin.lon, range)
      .then((d) => live && setOsmDests(d))
      .catch(() => live && setOsmDests([]))
    return () => {
      live = false
    }
  }, [origin?.lat, origin?.lon, range])

  const dests = useMemo(() => {
    if (!origin) return []
    const parks = NATIONAL_PARKS.filter((p) => p.lat != null)
      .map((p) => ({
        id: `np/${p.id}`,
        name: p.name,
        lat: p.lat,
        lon: p.lon,
        kind: 'national-park',
        parkId: p.id,
        motif: p.motif,
        state: p.states[0],
      }))
      .filter((p) => haversineMiles(origin, p) <= range)
    const others = Array.isArray(osmDests) ? osmDests : []
    const all = [...parks, ...others]
    const seen = new Set()
    return all
      .map((d) => ({ ...d, distance: haversineMiles(origin, d) }))
      .filter((d) => {
        const k = d.name.toLowerCase().replace(/national park$/, '').trim()
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 50)
      .sort((a, b) => (KIND_RANK[a.kind] ?? 2) - (KIND_RANK[b.kind] ?? 2) || a.distance - b.distance)
  }, [origin, osmDests, range])

  const markers = dests.map((d) => ({
    id: d.id,
    lat: d.lat,
    lon: d.lon,
    kind: d.kind === 'national-park' ? 'campground' : 'rv-park',
    selected: selected?.id === d.id,
    onClick: () => setSelected(d),
  }))

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Quick Trip</h1>
          <p className="page-sub">
            Tap a place — get a whole {rvMode ? 'RV' : 'camping'} trip, ready to go
          </p>
        </div>
      </div>

      <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
          <input
            className="input"
            style={{ paddingLeft: 36 }}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Start from…"
            aria-label="Starting point"
            enterKeyHint="search"
          />
        </div>
        <Button variant="soft" icon="crosshair" onClick={locateMe} disabled={busy} aria-label="Use my location" />
      </form>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: 'var(--ink-faint)', fontWeight: 600 }}>Within</span>
        <Chips
          options={RANGES.map((r) => ({ id: r, label: `${r} mi`, clearable: false }))}
          value={range}
          onChange={(v) => v && setRange(v)}
          ariaLabel="Search range"
        />
      </div>

      <div className="map-wrap">
        <MapView
          center={origin ? { lat: origin.lat, lon: origin.lon } : { lat: 39.4, lon: -97.6 }}
          zoom={origin ? (range === 50 ? 8 : range === 120 ? 7 : 6) : 4}
          markers={markers}
          user={origin?.isUser ? origin : null}
          fit={dests.length ? 'markers' : null}
          dark={mapDark}
          height={320}
        />
        {!origin && !busy && (
          <div className="map-cta">
            <p>Where are you starting from?</p>
            <Button small icon="crosshair" onClick={locateMe}>
              Use My Location
            </Button>
          </div>
        )}
      </div>

      {origin && (
        <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '12px 2px 10px' }}>
          {osmDests === 'loading' && dests.length === 0
            ? 'Finding places…'
            : `${dests.length} ${dests.length === 1 ? 'place' : 'places'} within ${range} mi of ${origin.label || 'here'}`}
          {osmDests === 'loading' && dests.length > 0 ? ' · finding more…' : ''}
        </p>
      )}

      {origin && dests.length === 0 && osmDests !== 'loading' && (
        <EmptyState compact icon="map" title="Nothing mapped in range" text="Widen the range and try again." />
      )}

      <div ref={listRef}>
        {dests.map((d) => {
          const meta = KIND_META[d.kind] || KIND_META.recreation
          return (
            <button
              key={d.id}
              type="button"
              className={`list-row is-tappable found-row ${selected?.id === d.id ? 'is-selected' : ''}`}
              onClick={() => setSelected(d)}
              style={{ width: '100%' }}
            >
              <span className="row-icon">
                <Icon name={d.motif || meta.icon} size={20} />
              </span>
              <span className="row-main">
                <span className="row-title">{d.name}</span>
                <span className="row-sub">
                  {meta.label}
                  {d.state ? ` · ${stateName(d.state)}` : ''} · {formatMiles(d.distance)}
                </span>
              </span>
              <span className="row-right">
                <Icon name="chevronRight" size={16} />
              </span>
            </button>
          )
        })}
      </div>

      <CuratedTripSheet dest={selected} origin={origin} onClose={() => setSelected(null)} />
    </>
  )
}

/* ---- the curated trip ---------------------------------------------------- */

function CuratedTripSheet({ dest, origin, onClose }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const [plan, setPlan] = useState(null) // null | 'loading' | 'error' | {…}
  const [stage, setStage] = useState('')
  const [campIdx, setCampIdx] = useState(0)
  const rvMode = state.settings.rvMode
  const rvLen = parseFloat(state.settings.rv?.lengthFt) || null

  useEffect(() => {
    if (!dest) return
    let live = true
    const ctrl = new AbortController()
    setPlan('loading')
    setStage('Finding a place to stay…')
    setCampIdx(0)
    curateTrip(dest, origin, {
      rvMode,
      rvLen,
      signal: ctrl.signal,
      onPart: (part) => {
        if (!live) return
        if (part === 'camps') setStage('Scouting the sights…')
        if (part === 'sights') setStage('Finding somewhere to eat…')
        if (part === 'food') setStage('Checking the forecast…')
      },
    })
      .then((p) => live && setPlan(p))
      .catch((err) => {
        if (!live || err.name === 'AbortError') return
        console.error(err)
        setPlan('error')
      })
    return () => {
      live = false
      ctrl.abort()
    }
  }, [dest?.id, origin?.lat, origin?.lon, rvMode, rvLen])

  if (!dest) return null
  const meta = KIND_META[dest.kind] || KIND_META.recreation
  const p = typeof plan === 'object' && plan ? plan : null
  const camp = p?.campPicks[campIdx] || null

  function createTrip() {
    const { start } = weekendOf(0)
    const s = parseISO(start)
    const e = new Date(s)
    e.setDate(s.getDate() + (p?.nights || 2))
    const trip = actions.createTrip({
      name: `${dest.name.replace(/ National Park$/, '')} ${rvMode ? 'RV Trip' : 'Camping Trip'}`,
      destination: `${dest.name}${dest.state ? ', ' + dest.state : ''}`,
      startDate: toISO(s),
      endDate: toISO(e),
    })
    if (camp) {
      const cg = actions.saveCampgroundFromMap(camp)
      actions.updateTrip(trip.id, { campgroundId: cg.id })
    }
    if (origin && p?.miles != null) {
      actions.updateTrip(trip.id, {
        route: {
          from: origin.label || 'Home',
          to: camp ? camp.name : dest.name,
          miles: String(p.miles),
          driveTime: p.driveTime,
          notes: '',
          fromCoord: { lat: origin.lat, lon: origin.lon, label: origin.label },
          toCoord: { lat: dest.lat, lon: dest.lon, label: dest.name },
        },
      })
    }
    if (dest.parkId) {
      actions.addPlace({
        name: dest.name,
        category: 'national-park',
        state: dest.state,
        visited: false,
        tripId: trip.id,
        notes: 'The main event',
      })
    }
    for (const s of p?.sightPicks || []) {
      actions.addPlace({
        name: s.name,
        category: s.tourism === 'museum' || s.historic ? 'historic-site' : 'landmark',
        visited: false,
        tripId: trip.id,
        notes: poiTypeLabel(s),
      })
    }
    for (const f of p?.foodPicks || []) {
      actions.addPlace({
        name: f.name,
        category: 'food',
        visited: false,
        tripId: trip.id,
        notes: poiTypeLabel(f),
      })
    }
    toast('Your trip is ready — dates set for this weekend', { icon: 'route', duration: 4200 })
    navigate(`trip/${trip.id}`, { replace: true })
  }

  return (
    <Sheet open={!!dest} onClose={onClose} title="" wide>
      <div style={{ paddingBottom: 6 }}>
        <div className="memory-label">{rvMode ? 'Curated RV trip' : 'Curated camping trip'}</div>
        <h3 style={{ fontSize: 24, marginTop: 4 }}>{dest.name}</h3>
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 2 }}>
          {meta.label}
          {dest.state ? ` · ${stateName(dest.state)}` : ''}
          {origin ? ` · ${formatMiles(dest.distance ?? haversineMiles(origin, dest))} from ${origin.label || 'you'}` : ''}
        </p>

        {plan === 'loading' && (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, margin: '26px 0' }}>
            {stage || 'Putting your trip together…'}
          </p>
        )}
        {plan === 'error' && (
          <EmptyState compact icon="refresh" title="Couldn’t reach the map service" text="Try again in a moment." />
        )}

        {p && (
          <>
            {/* the drive */}
            {p.miles != null && (
              <div className="curated-block">
                <div className="curated-label"><Icon name="route" size={13} /> The drive</div>
                <div className="curated-value">
                  {p.miles} mi · about {p.driveTime}
                  {rvMode ? ' at RV pace' : ''} · {p.nights} nights suggested
                </div>
              </div>
            )}

            {/* where to stay */}
            <div className="curated-block">
              <div className="curated-label"><Icon name="tent" size={13} /> Where to stay</div>
              {p.campPicks.length === 0 ? (
                <div className="curated-value" style={{ color: 'var(--ink-faint)' }}>
                  {rvMode
                    ? 'No RV-friendly campground is mapped nearby — use Find Nearby once you’re closer.'
                    : 'No campground mapped nearby yet.'}
                </div>
              ) : (
                p.campPicks.map((c, i) => (
                  <button
                    key={c.osmId}
                    type="button"
                    className={`sug-card ${i === campIdx ? 'is-selected' : ''}`}
                    aria-pressed={i === campIdx}
                    onClick={() => setCampIdx(i)}
                  >
                    <span className="sug-check"><Icon name="check" size={13} strokeWidth={2.4} /></span>
                    <span style={{ minWidth: 0, flex: 1 }}>
                      <span className="sug-name">{c.name}</span>
                      <div className="sug-sub">
                        {c.kind === 'rv-park' ? 'RV park' : 'Campground'} · {formatMiles(c.distance)} from {dest.name.split(' ')[0]}
                      </div>
                      <div className="sug-reasons">
                        {c.reasons.filter((r) => r.tone === 'good').slice(0, 3).map((r) => r.text).join(' · ') ||
                          c.reasons.slice(0, 2).map((r) => r.text).join(' · ')}
                      </div>
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* what to see */}
            {p.sightPicks.length > 0 && (
              <div className="curated-block">
                <div className="curated-label"><Icon name="camera" size={13} /> Worth seeing</div>
                {p.sightPicks.map((s) => (
                  <div key={s.id} className="curated-item">
                    <Icon name={poiIcon(s)} size={15} />
                    <span>
                      <b>{s.name}</b> <span className="curated-dim">· {poiTypeLabel(s)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* where to eat */}
            {p.foodPicks.length > 0 && (
              <div className="curated-block">
                <div className="curated-label"><Icon name="food" size={13} /> Where to eat</div>
                {p.foodPicks.map((f) => (
                  <div key={f.id} className="curated-item">
                    <Icon name="food" size={15} />
                    <span>
                      <b>{f.name}</b> <span className="curated-dim">· {poiTypeLabel(f)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* weather */}
            {p.forecast && p.forecast.length > 0 && (
              <div className="curated-block">
                <div className="curated-label"><Icon name="cloud" size={13} /> Next few days</div>
                <div className="curated-wx">
                  {p.forecast.map((d) => {
                    const m = weatherMeta(d.code)
                    const dt = parseISO(d.date)
                    return (
                      <div key={d.date} className="curated-wx-day" title={m.label}>
                        <span className="curated-wx-name">{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][dt.getDay()]}</span>
                        <Icon name={m.icon} size={17} />
                        <span className="curated-wx-temp">{d.hi}°</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {p.partial && (
              <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
                Some details couldn’t be reached right now — the trip still creates fine.
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
              <Button full icon="route" onClick={createTrip}>
                Create This Trip
              </Button>
              <div className="btn-row">
                <Button
                  variant="soft"
                  small
                  full
                  icon="tent"
                  onClick={() => {
                    setExploreCenter({ lat: dest.lat, lon: dest.lon, label: dest.name })
                    onClose()
                    navigate('campgrounds/find')
                  }}
                >
                  More campgrounds
                </Button>
                {dest.parkId && (
                  <Button variant="soft" small full icon="passport" onClick={() => { onClose(); navigate('passport/parks') }}>
                    Park record
                  </Button>
                )}
              </div>
            </div>
            <p className="field-hint" style={{ textAlign: 'center', marginTop: 8 }}>
              Dates default to this weekend — change anything on the trip page.
            </p>
          </>
        )}
      </div>
    </Sheet>
  )
}
