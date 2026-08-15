import React, { useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back, Link } from '../lib/router.jsx'
import { Button, Card, Field, ListRow, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import MapView from '../components/MapView.jsx'
import { geocodePlace } from '../lib/osm.js'
import { fetchArea } from '../lib/area.js'
import { haversineMiles, formatMiles } from '../lib/geo.js'
import { topPicks } from '../lib/recommend.js'
import { weekendOf } from '../lib/dates.js'
import { useMapDark } from '../lib/hooks.js'
import { takeTripPrefill } from './TripIdeas.jsx'

export default function TripNew() {
  const { state, actions } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [prefill] = useState(() => takeTripPrefill())
  const [name, setName] = useState(prefill?.name || '')
  const [destination, setDestination] = useState(prefill?.destination || '')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sugs, setSugs] = useState(null) // null | 'loading' | 'error' | []
  const [selectedSug, setSelectedSug] = useState(null)
  const [destPlace, setDestPlace] = useState(null)

  const rvMode = state.settings.rvMode
  const rvLen = parseFloat(state.settings.rv?.lengthFt) || null

  async function suggest() {
    setSugs('loading')
    setSelectedSug(null)
    try {
      const place = await geocodePlace(destination)
      if (!place) {
        setSugs('error')
        toast(`Couldn’t place “${destination.trim()}” — try a town + state.`)
        return
      }
      setDestPlace(place)
      // The combined area fetch also warms sights & food for this destination,
      // so the trip page's Discover is instant afterwards.
      const area = await fetchArea(place.lat, place.lon, 15)
      const withDistance = area.camps.map((r) => ({ ...r, distance: haversineMiles(place, r) }))
      const picks = topPicks(withDistance, { rvLen, rvMode }, 4)
      setSugs(picks)
      if (!picks.length) toast('Nothing recommendable is mapped near there — you can add the campground later.')
    } catch (err) {
      setSugs('error')
      toast(err.message, { tone: 'danger' })
    }
  }

  function applyWeekend(offset) {
    const { start, end } = weekendOf(offset)
    setStartDate(start)
    setEndDate(end)
  }

  function submit(e) {
    e.preventDefault()
    let finalName = name.trim()
    if (!finalName && destination.trim()) {
      finalName = `${destination.split(',')[0].trim()} Trip`
    }
    if (!finalName) {
      toast('Give the trip a name or destination to get started.')
      return
    }
    let end = endDate
    if (startDate && (!end || end < startDate)) end = startDate
    const trip = actions.createTrip({ name: finalName, destination, startDate, endDate: end })
    if (selectedSug) {
      const cg = actions.saveCampgroundFromMap(selectedSug)
      actions.updateTrip(trip.id, { campgroundId: cg.id })
      toast(`Trip created — ${cg.name} attached`, { icon: 'tent', duration: 3800 })
    } else {
      toast('Trip created', { icon: 'check' })
    }
    navigate(`trip/${trip.id}`, { replace: true })
  }

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Plan a Trip</h1>
          <p className="page-sub">Just the essentials — everything else can come later.</p>
        </div>
      </div>

      <Card as="form" onSubmit={submit}>
        <Field label="Trip name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shenandoah Weekend"
            autoFocus={!prefill}
            required
          />
        </Field>
        <Field label="Destination">
          <input
            className="input"
            value={destination}
            onChange={(e) => {
              setDestination(e.target.value)
              setSugs(null)
              setSelectedSug(null)
            }}
            placeholder="Shenandoah National Park, VA"
            autoComplete="off"
          />
        </Field>

        {destination.trim().length >= 3 &&
          (sugs === null || sugs === 'error' || (Array.isArray(sugs) && sugs.length === 0)) && (
            <Button variant="soft" small icon="sparkle" onClick={suggest} style={{ marginBottom: 14 }}>
              {sugs === 'error'
                ? 'Try suggestions again'
                : rvMode
                  ? 'Suggest RV campgrounds there'
                  : 'Suggest campgrounds there'}
            </Button>
          )}
        {sugs === 'loading' && (
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', margin: '0 0 14px' }}>
            Looking around {destination.trim()}…
          </p>
        )}
        {Array.isArray(sugs) && sugs.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {destPlace && (
              <div style={{ marginBottom: 10 }}>
                <MapView
                  center={{ lat: destPlace.lat, lon: destPlace.lon }}
                  zoom={10}
                  markers={[
                    { id: 'dest', lat: destPlace.lat, lon: destPlace.lon, kind: 'to' },
                    ...sugs.map((s) => ({
                      id: s.osmId,
                      lat: s.lat,
                      lon: s.lon,
                      kind: s.kind,
                      selected: selectedSug?.osmId === s.osmId,
                      onClick: () => setSelectedSug(selectedSug?.osmId === s.osmId ? null : s),
                    })),
                  ]}
                  fit="markers"
                  dark={mapDark}
                  height={200}
                />
              </div>
            )}
            <div className="field-label" style={{ marginBottom: 6 }}>
              Recommended campgrounds — tap a pin or card to attach one
            </div>
            {sugs.map((s) => (
              <button
                key={s.osmId}
                type="button"
                className={`sug-card ${selectedSug?.osmId === s.osmId ? 'is-selected' : ''}`}
                aria-pressed={selectedSug?.osmId === s.osmId}
                onClick={() => setSelectedSug(selectedSug?.osmId === s.osmId ? null : s)}
              >
                <span className="sug-check">
                  <Icon name="check" size={13} strokeWidth={2.4} />
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="sug-name">{s.name}</span>
                  <div className="sug-sub">
                    {s.kind === 'rv-park' ? 'RV park' : 'Campground'} · {formatMiles(s.distance)} from
                    destination
                  </div>
                  <div className="sug-reasons">
                    {[...s.reasons.filter((r) => r.tone === 'good'), ...s.reasons.filter((r) => r.tone !== 'good')]
                      .slice(0, 3)
                      .map((r) => r.text)
                      .join(' · ')}
                  </div>
                </span>
              </button>
            ))}
            <p className="field-hint" style={{ marginTop: 6 }}>
              The pick lands in your campground book with its map pin — details fill in on the trip
              page.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          <button type="button" className="chip" onClick={() => applyWeekend(0)}>
            <Icon name="calendar" size={13} /> This weekend
          </button>
          <button type="button" className="chip" onClick={() => applyWeekend(1)}>
            Next weekend
          </button>
        </div>
        <div className="form-grid-2">
          <Field label="First night">
            <input
              className="input"
              type="date"
              value={startDate}
              min="2000-01-01"
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate && endDate < e.target.value) setEndDate(e.target.value)
              }}
            />
          </Field>
          <Field label="Last day">
            <input
              className="input"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" full icon="route" onClick={submit}>
          Create Trip
        </Button>
        <p className="field-hint" style={{ textAlign: 'center', marginTop: 10 }}>
          You can add the campground, checklist, and route from the trip page.
        </p>
      </Card>

      <ListRow
        icon="rv"
        className="ideas-row"
        title="Planning a multi-stop road trip?"
        sub="Map a route with parks, campgrounds, sights and food along the way"
        onClick={() => navigate('trips/roadtrip')}
        right={<Icon name="chevronRight" size={16} />}
      />
    </>
  )
}
