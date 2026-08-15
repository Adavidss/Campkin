import React, { useMemo, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Card, EmptyState, Field, useToast } from '../components/ui.jsx'
import MapView from '../components/MapView.jsx'
import DiscoverSheet from '../components/DiscoverSheet.jsx'
import { geocodePlace, currentPosition, reverseGeocode } from '../lib/osm.js'
import { corridorInfo, roadMilesEstimate, driveTimeEstimate, formatMiles } from '../lib/geo.js'
import { NATIONAL_PARKS } from '../data/parks.js'
import { stateName } from '../lib/states.js'
import { useMapDark } from '../lib/hooks.js'
import { setExploreCenter } from './Campgrounds.jsx'
import { cx } from '../lib/util.js'

const CORRIDOR_MI = 75

export default function RoadTrip() {
  const { state, actions } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [fromQ, setFromQ] = useState('')
  const [toQ, setToQ] = useState('')
  const [plan, setPlan] = useState(null) // { a, b, miles, driveTime, stops }
  const [excluded, setExcluded] = useState(() => new Set())
  const [discover, setDiscover] = useState(null) // {lat, lon, label}
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const rvMode = state.settings.rvMode

  async function useMyLocation() {
    setLocating(true)
    try {
      const pos = await currentPosition()
      const label = await reverseGeocode(pos.lat, pos.lon).catch(() => null)
      setFromQ(label || `${pos.lat.toFixed(3)}, ${pos.lon.toFixed(3)}`)
    } catch (err) {
      toast(err.message, { duration: 4500 })
    }
    setLocating(false)
  }

  async function mapRoute(e) {
    e?.preventDefault()
    if (!fromQ.trim() || !toQ.trim()) {
      toast('Fill in both ends — e.g. “Atlanta, GA” to “Moab, UT”.')
      return
    }
    setLoading(true)
    setPlan(null)
    setExcluded(new Set())
    try {
      const a = await geocodePlace(fromQ)
      const b = a && (await geocodePlace(toQ))
      if (!a || !b) {
        toast(`Couldn’t place “${!a ? fromQ.trim() : toQ.trim()}” — try a town + state.`)
        setLoading(false)
        return
      }
      const miles = roadMilesEstimate(a, b)
      const stops = NATIONAL_PARKS.filter((p) => p.lat != null)
        .map((p) => {
          const { offMi, t } = corridorInfo(a, b, p)
          return { park: p, offMi, t }
        })
        .filter((s) => s.offMi <= CORRIDOR_MI && s.t > 0.03 && s.t < 0.97)
        .sort((x, y) => x.t - y.t)
        .slice(0, 7)
        .map((s) => {
          const rec = state.parks[s.park.id]
          const reasons = []
          if (s.offMi <= 20) reasons.push({ text: 'Right on the route', tone: 'good' })
          else reasons.push({ text: `~${Math.round(s.offMi)} mi off the route`, tone: 'info' })
          if (rec?.status === 'want') reasons.push({ text: 'On your Want to Visit list', tone: 'good' })
          else if (!rec?.status) reasons.push({ text: 'A new stamp for your passport', tone: 'good' })
          else reasons.push({ text: 'A favorite worth repeating', tone: 'info' })
          return { ...s, rec, reasons }
        })
      setPlan({ a, b, miles, driveTime: driveTimeEstimate(miles, { rv: rvMode }), stops })
      if (!stops.length) toast('No parks along this corridor — it’ll be a pure driving route.')
    } catch (err) {
      toast(err.message, { tone: 'danger', duration: 4500 })
    }
    setLoading(false)
  }

  const included = useMemo(
    () => (plan ? plan.stops.filter((s) => !excluded.has(s.park.id)) : []),
    [plan, excluded]
  )

  // Leg math over the included stops, in corridor order.
  const legs = useMemo(() => {
    if (!plan) return []
    const points = [
      { label: plan.a.label, lat: plan.a.lat, lon: plan.a.lon },
      ...included.map((s) => ({ label: s.park.name, lat: s.park.lat, lon: s.park.lon })),
      { label: plan.b.label, lat: plan.b.lat, lon: plan.b.lon },
    ]
    const out = []
    for (let i = 1; i < points.length; i++) {
      out.push({
        from: points[i - 1].label,
        to: points[i].label,
        miles: roadMilesEstimate(points[i - 1], points[i]),
      })
    }
    return out
  }, [plan, included])

  const totalWithStops = legs.reduce((sum, l) => sum + l.miles, 0)
  const longLeg = legs.find((l) => l.miles > 380)

  function createTrip() {
    const name = `${firstWord(plan.a.label)} to ${firstWord(plan.b.label)} Road Trip`
    const trip = actions.createTrip({ name, destination: plan.b.label, startDate: '', endDate: '' })
    actions.updateTrip(trip.id, {
      route: {
        from: plan.a.label,
        to: plan.b.label,
        miles: String(totalWithStops || plan.miles),
        driveTime: driveTimeEstimate(totalWithStops || plan.miles, { rv: rvMode }),
        notes: included.length
          ? `Stops: ${included.map((s) => s.park.name).join(' → ')}`
          : '',
        fromCoord: { lat: plan.a.lat, lon: plan.a.lon, label: plan.a.label },
        toCoord: { lat: plan.b.lat, lon: plan.b.lon, label: plan.b.label },
      },
    })
    for (const s of included) {
      actions.addPlace({
        name: s.park.name,
        category: 'national-park',
        state: s.park.states[0],
        visited: false,
        tripId: trip.id,
        notes: 'Road trip stop',
      })
    }
    toast(
      included.length
        ? `Road trip created — ${included.length} ${included.length === 1 ? 'stop' : 'stops'} on the list`
        : 'Road trip created',
      { icon: 'route', duration: 4000 }
    )
    navigate(`trip/${trip.id}`, { replace: true })
  }

  const markers = plan
    ? [
        { id: 'a', lat: plan.a.lat, lon: plan.a.lon, kind: 'from' },
        { id: 'b', lat: plan.b.lat, lon: plan.b.lon, kind: 'to' },
        ...included.map((s) => ({
          id: s.park.id,
          lat: s.park.lat,
          lon: s.park.lon,
          kind: 'campground',
        })),
      ]
    : []

  const line = plan
    ? [
        { lat: plan.a.lat, lon: plan.a.lon },
        ...included.map((s) => ({ lat: s.park.lat, lon: s.park.lon })),
        { lat: plan.b.lat, lon: plan.b.lon },
      ]
    : null

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Road Trip</h1>
          <p className="page-sub">Point it somewhere good — Campkin fills in the stops</p>
        </div>
      </div>

      <Card as="form" onSubmit={mapRoute}>
        <Field label="Starting from">
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              value={fromQ}
              onChange={(e) => setFromQ(e.target.value)}
              placeholder="Atlanta, GA"
              data-autofocus
            />
            <Button
              variant="soft"
              icon="crosshair"
              onClick={useMyLocation}
              disabled={locating}
              aria-label="Use my location"
            />
          </div>
        </Field>
        <Field label="Heading to">
          <input
            className="input"
            value={toQ}
            onChange={(e) => setToQ(e.target.value)}
            placeholder="Moab, UT"
          />
        </Field>
        <Button type="submit" full icon="route" onClick={mapRoute} disabled={loading}>
          {loading ? 'Mapping the route…' : 'Map the Route'}
        </Button>
      </Card>

      {plan && (
        <>
          <div className="map-wrap" style={{ margin: '16px 0 10px' }}>
            <MapView
              markers={markers}
              line={line}
              fit="markers"
              dark={mapDark}
              height={260}
              interactive
            />
          </div>

          <p className="passport-totals" style={{ marginBottom: 14 }}>
            <span><b>{totalWithStops || plan.miles}</b> miles{included.length > 0 ? ' with stops' : ''}</span>
            <span><b>{driveTimeEstimate(totalWithStops || plan.miles, { rv: rvMode })}</b>{rvMode ? ' at RV pace' : ''}</span>
            {included.length > 0 && <span><b>{included.length}</b> {included.length === 1 ? 'stop' : 'stops'}</span>}
          </p>

          {longLeg && (
            <div className="rv-fit-note is-tight" style={{ marginBottom: 12 }}>
              <Icon name="moon" size={16} />
              {longLeg.from} → {longLeg.to} is ~{longLeg.miles} mi — plan an overnight along that leg.
            </div>
          )}

          <StopRow
            kind="from"
            title={plan.a.label}
            sub="Start"
            onDiscover={() => setDiscover({ lat: plan.a.lat, lon: plan.a.lon, label: firstWord(plan.a.label) })}
          />
          {plan.stops.map((s) => {
            const off = excluded.has(s.park.id)
            return (
              <StopRow
                key={s.park.id}
                kind="stop"
                title={s.park.name}
                sub={s.park.states.map(stateName).join(', ')}
                motif={s.park.motif}
                reasons={s.reasons}
                off={off}
                onToggle={() =>
                  setExcluded((prev) => {
                    const next = new Set(prev)
                    if (next.has(s.park.id)) next.delete(s.park.id)
                    else next.add(s.park.id)
                    return next
                  })
                }
                onCampgrounds={() => {
                  setExploreCenter({ lat: s.park.lat, lon: s.park.lon, label: s.park.name })
                  navigate('campgrounds/find')
                }}
                onDiscover={() => setDiscover({ lat: s.park.lat, lon: s.park.lon, label: s.park.name })}
              />
            )
          })}
          <StopRow
            kind="to"
            title={plan.b.label}
            sub="Destination"
            onCampgrounds={() => {
              setExploreCenter({ lat: plan.b.lat, lon: plan.b.lon, label: plan.b.label })
              navigate('campgrounds/find')
            }}
            onDiscover={() => setDiscover({ lat: plan.b.lat, lon: plan.b.lon, label: firstWord(plan.b.label) })}
          />

          <Button full icon="route" onClick={createTrip} style={{ marginTop: 16 }}>
            Create This Road Trip
          </Button>
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 8 }}>
            The route lands on the trip page; the stops become its Things to Do list.
          </p>
        </>
      )}

      {!plan && !loading && (
        <EmptyState
          icon="route"
          title="Where to?"
          text="Give Campkin both ends of the drive and it maps the route, finds the parks worth stopping for, and sizes the days at RV pace."
        />
      )}

      <DiscoverSheet open={!!discover} onClose={() => setDiscover(null)} center={discover} />
    </>
  )
}

function firstWord(label) {
  return (label || '').split(',')[0].trim()
}

function StopRow({ kind, title, sub, motif, reasons, off, onToggle, onCampgrounds, onDiscover }) {
  return (
    <div className={cx('stop-row', off && 'is-off')}>
      <div className="stop-rail">
        <span className={`stop-dot ${kind === 'stop' ? 'is-stop' : 'is-end'}`}>
          {kind === 'stop' ? <Icon name={motif || 'tent'} size={15} /> : <Icon name={kind === 'from' ? 'home' : 'pin'} size={14} />}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stop-title">{title}</div>
            <div className="stop-sub">{sub}</div>
          </div>
          {onToggle && (
            <button
              type="button"
              className={cx('chip', !off && 'is-active')}
              aria-pressed={!off}
              onClick={onToggle}
            >
              {off ? 'Skipped' : 'Stop'}
            </button>
          )}
        </div>
        {reasons && !off && (
          <ul className="pick-reasons" style={{ marginTop: 6 }}>
            {reasons.map((re, j) => (
              <li key={j} className={`pick-reason tone-${re.tone}`}>
                <Icon name={re.tone === 'good' ? 'check' : 'info'} size={12} />
                {re.text}
              </li>
            ))}
          </ul>
        )}
        {!off && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {onCampgrounds && (
              <Button variant="soft" small icon="tent" onClick={onCampgrounds}>
                Campgrounds
              </Button>
            )}
            {onDiscover && (
              <Button variant="soft" small icon="sparkle" onClick={onDiscover}>
                Sights & Food
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
