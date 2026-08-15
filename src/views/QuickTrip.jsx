import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Sheet, EmptyState, Chips, useToast } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { NATIONAL_PARKS } from '../data/parks.js'
import { STATE_PARKS } from '../data/stateParks.js'
import { fetchNearbyDestinations, geocodePlace, currentPosition, reverseGeocode } from '../lib/osm.js'
import { haversineMiles, formatMiles, roadMilesEstimate, driveTimeEstimate } from '../lib/geo.js'
import { curateInstant, curateFromArea } from '../lib/curate.js'
import { fetchArea, prefetchAreas } from '../lib/area.js'
import { fetchForecast } from '../lib/weather.js'
import BookingSheet from '../components/BookingSheet.jsx'
import WikiCard, { WikiThumb } from '../components/WikiCard.jsx'
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
    // Built-in data renders instantly; OSM state parks enrich when they land.
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
    const builtIn = STATE_PARKS.filter((p) => haversineMiles(origin, p) <= range).map((p, i) => ({
      id: `sp/${i}`,
      ...p,
    }))
    const others = Array.isArray(osmDests) ? osmDests : []
    const all = [...parks, ...builtIn, ...others]
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

  // Warm the closest destinations while the user is still looking at the map,
  // so tapping one is usually instant.
  useEffect(() => {
    if (!dests.length) return
    const t = setTimeout(() => prefetchAreas(dests.slice(0, 6)), 400)
    return () => clearTimeout(t)
  }, [dests])

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
          {`${dests.length} ${dests.length === 1 ? 'place' : 'places'} within ${range} mi of ${origin.label || 'here'}`}
          {osmDests === 'loading' ? ' · finding more…' : ''}
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
  // The sheet opens INSTANTLY with the drive/nights (pure math); the map data
  // and forecast stream in as separate pieces of state.
  const [ranked, setRanked] = useState(null) // null=loading | 'error' | {campPicks,sightPicks,foodPicks}
  const [forecast, setForecast] = useState(null)
  const [campIdx, setCampIdx] = useState(0)
  const [bookingCg, setBookingCg] = useState(null)
  const [retry, setRetry] = useState(0)
  const rvMode = state.settings.rvMode
  const rvLen = parseFloat(state.settings.rv?.lengthFt) || null

  useEffect(() => {
    if (!dest) return
    let live = true
    const ctrl = new AbortController()
    setRanked(null)
    setCampIdx(0)
    fetchArea(dest.lat, dest.lon, 15, { signal: ctrl.signal })
      .then((area) => live && setRanked(curateFromArea(area, dest, { rvMode, rvLen })))
      .catch((err) => {
        if (!live || err.name === 'AbortError') return
        console.error(err)
        setRanked('error')
      })
    return () => {
      live = false
      ctrl.abort()
    }
  }, [dest?.id, rvMode, rvLen, retry])

  useEffect(() => {
    if (!dest) return
    let live = true
    setForecast(null)
    fetchForecast(dest.lat, dest.lon)
      .then((f) => live && setForecast(f.slice(0, 5)))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [dest?.id])

  if (!dest) return null
  const meta = KIND_META[dest.kind] || KIND_META.recreation
  const instant = curateInstant(dest, origin, { rvMode })
  const p = ranked && typeof ranked === 'object' ? { ...ranked, ...instant, forecast } : null
  const loadingArea = ranked === null
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
    if (origin && instant.miles != null) {
      actions.updateTrip(trip.id, {
        route: {
          from: origin.label || 'Home',
          to: camp ? camp.name : dest.name,
          miles: String(instant.miles),
          driveTime: instant.driveTime,
          notes: '',
          fromCoord: { lat: origin.lat, lon: origin.lon, label: origin.label },
          toCoord: { lat: dest.lat, lon: dest.lon, label: dest.name },
        },
      })
    }
    // Lay it out day by day: the park on day 1, then sights and meals spread
    // across the stay so no day is empty and no day is all restaurants.
    const nights = instant.nights || 2
    const days = nights + 1
    let d = 1
    if (dest.parkId) {
      actions.addPlace({
        name: dest.name,
        category: 'national-park',
        state: dest.state,
        visited: false,
        tripId: trip.id,
        day: 1,
        notes: 'The main event',
        lat: dest.lat,
        lon: dest.lon,
      })
    }
    for (const s of p?.sightPicks || []) {
      actions.addPlace({
        name: s.name,
        category: s.tourism === 'museum' || s.historic ? 'historic-site' : 'landmark',
        visited: false,
        tripId: trip.id,
        day: ((d++ - 1) % days) + 1,
        notes: poiTypeLabel(s),
        lat: s.lat,
        lon: s.lon,
      })
    }
    let fd = 1
    for (const f of p?.foodPicks || []) {
      actions.addPlace({
        name: f.name,
        category: 'food',
        visited: false,
        tripId: trip.id,
        day: ((fd++ - 1) % days) + 1,
        notes: poiTypeLabel(f),
        lat: f.lat,
        lon: f.lon,
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

        {/* what this place is — photo + a paragraph from Wikipedia */}
        <WikiCard
          variant="hero"
          hint={{ name: dest.name, state: dest.state ? stateName(dest.state) : undefined, kind: dest.kind === 'national-park' ? 'National Park' : KIND_META[dest.kind]?.label }}
        />

        {/* the drive — pure math, renders the instant the sheet opens */}
        {instant.miles != null && (
          <div className="curated-block">
            <div className="curated-label"><Icon name="route" size={13} /> The drive</div>
            <div className="curated-value">
              {instant.miles} mi · about {instant.driveTime}
              {rvMode ? ' at RV pace' : ''} · {instant.nights} nights suggested
            </div>
          </div>
        )}

        {/* where to stay */}
        <div className="curated-block">
          <div className="curated-label"><Icon name="tent" size={13} /> Where to stay</div>
          {loadingArea && <SkeletonRows n={2} tall />}
          {ranked === 'error' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className="curated-value" style={{ color: 'var(--ink-faint)', flex: 1 }}>
                The map service is busy right now.
              </span>
              <Button small variant="soft" icon="refresh" onClick={() => setRetry((n) => n + 1)}>
                Try again
              </Button>
            </div>
          )}
          {p && p.campPicks.length === 0 && (
            <div className="curated-value" style={{ color: 'var(--ink-faint)' }}>
              {rvMode
                ? 'No RV-friendly campground is mapped nearby — use Find Nearby once you’re closer.'
                : 'No campground mapped nearby yet.'}
            </div>
          )}
          {p &&
            p.campPicks.map((c, i) => (
              <div key={c.osmId} style={{ position: 'relative' }}>
                <button
                  type="button"
                  className={`sug-card ${i === campIdx ? 'is-selected' : ''}`}
                  aria-pressed={i === campIdx}
                  onClick={() => setCampIdx(i)}
                  style={{ paddingRight: 84 }}
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
                <Button
                  small
                  variant="soft"
                  icon="calendar"
                  onClick={() => setBookingCg(c)}
                  style={{ position: 'absolute', right: 10, top: 10, minHeight: 32, padding: '4px 10px' }}
                >
                  Book
                </Button>
              </div>
            ))}
        </div>

        {/* what to see */}
        <div className="curated-block">
          <div className="curated-label"><Icon name="camera" size={13} /> Worth seeing</div>
          {loadingArea && <SkeletonRows n={3} />}
          {p && p.sightPicks.length === 0 && (
            <div className="curated-dim" style={{ fontSize: 13.5 }}>Nothing mapped nearby — explore when you arrive.</div>
          )}
          {p &&
            p.sightPicks.map((s) => (
              <div key={s.id} className="curated-item" style={{ alignItems: 'center' }}>
                <WikiThumb hint={{ name: s.name, wikipedia: s.wikipedia }} size={40} />
                <Icon name={poiIcon(s)} size={15} />
                <span>
                  <b>{s.name}</b> <span className="curated-dim">· {poiTypeLabel(s)}</span>
                </span>
              </div>
            ))}
        </div>

        {/* where to eat */}
        <div className="curated-block">
          <div className="curated-label"><Icon name="food" size={13} /> Where to eat</div>
          {loadingArea && <SkeletonRows n={2} />}
          {p && p.foodPicks.length === 0 && (
            <div className="curated-dim" style={{ fontSize: 13.5 }}>No restaurants mapped close by — pack the good stuff.</div>
          )}
          {p &&
            p.foodPicks.map((f) => (
              <div key={f.id} className="curated-item">
                <Icon name="food" size={15} />
                <span>
                  <b>{f.name}</b> <span className="curated-dim">· {poiTypeLabel(f)}</span>
                </span>
              </div>
            ))}
        </div>

        {/* weather — fills in independently */}
        {forecast && forecast.length > 0 && (
          <div className="curated-block">
            <div className="curated-label"><Icon name="cloud" size={13} /> Next few days</div>
            <div className="curated-wx">
              {forecast.map((d) => {
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <Button full icon="route" onClick={createTrip} disabled={loadingArea}>
            {loadingArea ? 'Finding places to stay…' : ranked === 'error' ? 'Create Trip Anyway' : 'Create This Trip'}
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
      </div>
      <BookingSheet open={!!bookingCg} onClose={() => setBookingCg(null)} cg={bookingCg} />
    </Sheet>
  )
}

function SkeletonRows({ n = 3, tall = false }) {
  return (
    <div className="skel-rows" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className={`skel ${tall ? 'is-tall' : ''}`} style={{ width: `${88 - i * 9}%` }} />
      ))}
    </div>
  )
}
