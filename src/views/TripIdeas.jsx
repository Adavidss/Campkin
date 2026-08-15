import React, { useMemo, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, EmptyState, useToast } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import { parkTripIdeas } from '../lib/tripIdeas.js'
import { geocodePlace, currentPosition } from '../lib/osm.js'
import { formatMiles } from '../lib/geo.js'
import { useMapDark } from '../lib/hooks.js'
import { setExploreCenter } from './Campgrounds.jsx'
import WikiCard from '../components/WikiCard.jsx'

// Hand a prefill to the Plan a Trip form.
export function setTripPrefill(prefill) {
  try {
    sessionStorage.setItem('campkin-trip-prefill', JSON.stringify(prefill))
  } catch {
    /* ignore */
  }
}

// Consumed on read, but cached briefly so React StrictMode's double-mount
// (which runs the state initializer twice) still sees the value.
let prefillCache = { v: null, at: 0 }

export function takeTripPrefill() {
  try {
    const raw = sessionStorage.getItem('campkin-trip-prefill')
    if (raw) {
      sessionStorage.removeItem('campkin-trip-prefill')
      prefillCache = { v: JSON.parse(raw), at: Date.now() }
      return prefillCache.v
    }
  } catch {
    /* ignore */
  }
  return Date.now() - prefillCache.at < 3000 ? prefillCache.v : null
}

export default function TripIdeas() {
  const { state } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [center, setCenter] = useState(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const rvMode = state.settings.rvMode

  const ideas = useMemo(
    () => (center ? parkTripIdeas(center, state.parks, { rvMode }) : []),
    [center, state.parks, rvMode]
  )

  async function locateMe() {
    setLoading(true)
    try {
      const pos = await currentPosition()
      setCenter({ ...pos, label: 'your location' })
    } catch (err) {
      toast(err.message, { duration: 4500 })
    }
    setLoading(false)
  }

  async function submitSearch(e) {
    e?.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    try {
      const place = await geocodePlace(query)
      if (!place) toast(`Couldn’t find “${query.trim()}”.`)
      else setCenter(place)
    } catch (err) {
      toast(err.message, { tone: 'danger' })
    }
    setLoading(false)
  }

  function planIdea(idea) {
    setTripPrefill({
      name: `${idea.park.name} Trip`,
      destination: `${idea.park.name} National Park, ${idea.park.states[0]}`,
    })
    navigate('trips/new')
  }

  const markers = ideas.map((i, idx) => ({
    id: i.park.id,
    lat: i.park.lat,
    lon: i.park.lon,
    kind: 'campground',
    selected: selected === i.park.id,
    onClick: () => {
      setSelected(i.park.id)
      document
        .querySelector(`[data-idea="${i.park.id}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    },
  }))

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trip Ideas</h1>
          <p className="page-sub">National Park runs within reach of you</p>
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
            placeholder="Start from a town or city…"
            aria-label="Where would the trip start?"
            enterKeyHint="search"
          />
        </div>
        <Button type="submit" variant="soft" onClick={submitSearch} disabled={loading}>
          Search
        </Button>
      </form>

      <div className="map-wrap" style={{ marginBottom: 14 }}>
        <MapView
          center={center ? { lat: center.lat, lon: center.lon } : { lat: 39.4, lon: -97.6 }}
          zoom={center ? 6 : 4}
          markers={markers}
          user={center && center.label === 'your location' ? center : null}
          fit={ideas.length ? 'markers' : null}
          dark={mapDark}
          height={280}
        />
        {!center && !loading && (
          <div className="map-cta">
            <p>Where would the trip start?</p>
            <Button small icon="crosshair" onClick={locateMe}>
              Use My Location
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, margin: '14px 0' }}>
          Sizing up the possibilities…
        </p>
      )}

      {center && ideas.length === 0 && !loading && (
        <EmptyState compact icon="mountains" title="No parks in reach" text="Try another starting point." />
      )}

      {ideas.map((idea, i) => (
        <div
          key={idea.park.id}
          data-idea={idea.park.id}
          className={`pick-card ${selected === idea.park.id ? 'is-selected-card' : ''}`}
          onClick={() => setSelected(idea.park.id)}
        >
          <div className="pick-head">
            <span className="pick-rank">{i + 1}</span>
            <span className="row-icon" style={{ width: 34, height: 34 }}>
              <Icon name={idea.park.motif} size={19} />
            </span>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="pick-name">{idea.park.name}</div>
              <div className="pick-sub">
                {idea.state} · ~{formatMiles(idea.miles)} away
              </div>
            </div>
            {idea.status === 'visited' && (
              <span className="park-status is-visited"><Icon name="check" size={11} /> Visited</span>
            )}
            {idea.status === 'want' && (
              <span className="park-status is-want"><Icon name="bookmark" size={11} /> Want to</span>
            )}
          </div>
          <ul className="pick-reasons">
            {idea.reasons.map((re, j) => (
              <li key={j} className={`pick-reason tone-${re.tone}`}>
                <Icon name={re.tone === 'good' ? 'check' : 'info'} size={12} />
                {re.text}
              </li>
            ))}
          </ul>
          <WikiCard hint={{ name: `${idea.park.name} National Park`, kind: 'National Park' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <Button small icon="route" onClick={(e) => { e.stopPropagation(); planIdea(idea) }}>
              Plan this trip
            </Button>
            <Button
              variant="soft"
              small
              icon="tent"
              onClick={(e) => {
                e.stopPropagation()
                setExploreCenter({ lat: idea.park.lat, lon: idea.park.lon, label: idea.park.name })
                navigate('campgrounds/find')
              }}
            >
              Campgrounds
            </Button>
            <Button
              variant="ghost"
              small
              icon="passport"
              onClick={(e) => { e.stopPropagation(); navigate('passport/parks') }}
            >
              Park record
            </Button>
          </div>
        </div>
      ))}

      {center && ideas.length > 0 && (
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '6px 4px 0', lineHeight: 1.5 }}>
          Distances are road estimates from {center.label || 'your starting point'} — plan the real
          route from the trip page.
        </p>
      )}
    </>
  )
}
