import React, { useMemo, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Card, EmptyState, Field, useToast } from '../components/ui.jsx'
import { useCelebrate } from '../components/Celebrate.jsx'
import MapView from '../components/MapView.jsx'
import DiscoverSheet from '../components/DiscoverSheet.jsx'
import BookingSheet from '../components/BookingSheet.jsx'
import { WikiThumb } from '../components/WikiCard.jsx'
import { geocodePlace, currentPosition, reverseGeocode } from '../lib/osm.js'
import { corridorInfo, roadMilesEstimate, driveTimeEstimate, formatMiles } from '../lib/geo.js'
import { NATIONAL_PARKS } from '../data/parks.js'
import { stateName } from '../lib/states.js'
import { useMapDark } from '../lib/hooks.js'
import { setExploreCenter } from './Campgrounds.jsx'
import { cx } from '../lib/util.js'
import { planRoadTrip, poiToPlaceFields } from '../lib/curate.js'
import { poiTypeLabel } from '../lib/pois.js'
import { weekendOf, parseISO, toISO } from '../lib/dates.js'

const CORRIDOR_MI = 75

export default function RoadTrip() {
  const { state, actions } = useApp()
  const toast = useToast()
  const celebrate = useCelebrate()
  const mapDark = useMapDark()
  const [fromQ, setFromQ] = useState('')
  const [toQ, setToQ] = useState('')
  const [plan, setPlan] = useState(null) // { a, b, miles, driveTime, stops }
  const [excluded, setExcluded] = useState(() => new Set())
  const [discover, setDiscover] = useState(null) // {lat, lon, label}
  const [loading, setLoading] = useState(false)
  const [locating, setLocating] = useState(false)
  const [auto, setAuto] = useState(null) // null | {progress:{i,total,label}} | {result:[…]}
  const [bookingCg, setBookingCg] = useState(null)
  const rvMode = state.settings.rvMode
  const rvLen = parseFloat(state.settings.rv?.lengthFt) || null

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
      setAuto(null)
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

  // Waypoints in order: start → included parks → destination.
  const waypoints = useMemo(() => {
    if (!plan) return []
    return [
      { name: firstWord(plan.a.label), lat: plan.a.lat, lon: plan.a.lon, kind: 'start' },
      ...included.map((s) => ({ name: s.park.name, lat: s.park.lat, lon: s.park.lon, kind: 'park', park: s.park })),
      { name: firstWord(plan.b.label), lat: plan.b.lat, lon: plan.b.lon, kind: 'end' },
    ]
  }, [plan, included])

  async function planItAll() {
    // Plan the parks and the destination — plus the drives between them.
    const stops = waypoints.filter((w) => w.kind !== 'start')
    // Stops stream in as they finish; the list renders progressively.
    setAuto({ progress: { i: 0, total: stops.length, label: stops[0]?.name }, partial: new Array(stops.length).fill(null) })
    try {
      const result = await planRoadTrip(waypoints, {
        rvMode,
        rvLen,
        onStop: (i, res) =>
          setAuto((a) => {
            const partial = [...(a?.partial || [])]
            partial[i] = res
            return { ...a, partial }
          }),
        onProgress: (i, total, label) =>
          setAuto((a) => (a?.result ? a : { ...a, progress: { i, total, label } })),
      })
      setAuto({ result })
      toast('Every stop is planned — review, then create', { icon: 'sparkle', duration: 4200 })
    } catch (err) {
      console.error(err)
      setAuto(null)
      toast('The planner hit a snag — try again in a moment.', { tone: 'danger' })
    }
  }

  function createTrip() {
    const name = `${firstWord(plan.a.label)} to ${firstWord(plan.b.label)} Road Trip`
    const totalMiles = totalWithStops || plan.miles
    // Day count: one travel day per leg, plus a night at each park stop.
    const dayCount = Math.max(2, legs.length + included.length)
    const { start } = weekendOf(0)
    const s = parseISO(start)
    const e = new Date(s)
    e.setDate(s.getDate() + dayCount - 1)
    const trip = actions.createTrip({
      name,
      destination: plan.b.label,
      startDate: toISO(s),
      endDate: toISO(e),
    })
    actions.updateTrip(trip.id, {
      route: {
        from: plan.a.label,
        to: plan.b.label,
        miles: String(totalMiles),
        driveTime: driveTimeEstimate(totalMiles, { rv: rvMode }),
        notes: included.length ? `Stops: ${included.map((st) => st.park.name).join(' → ')}` : '',
        fromCoord: { lat: plan.a.lat, lon: plan.a.lon, label: plan.a.label },
        toCoord: { lat: plan.b.lat, lon: plan.b.lon, label: plan.b.label },
      },
    })

    const planned = auto?.result || null
    // Each stop gets its own day: parks first, destination last.
    let day = 1
    let firstCamp = null
    for (const wp of waypoints.filter((w) => w.kind !== 'start')) {
      day = Math.min(day, dayCount)
      const p = planned?.find((r) => r.stop.name === wp.name)
      if (wp.kind === 'park') {
        actions.addPlace({
          name: wp.park.name,
          category: 'national-park',
          state: wp.park.states[0],
          visited: false,
          tripId: trip.id,
          day,
          notes: 'Road trip stop',
          lat: wp.lat,
          lon: wp.lon,
        })
      }
      if (p) {
        // Highlights on the drive in come first in the day, then the stop itself.
        for (const sg of p.along?.sights || []) actions.addPlace({ ...poiToPlaceFields(sg, trip.id, day), notes: `On the way · ${poiTypeLabel(sg)}` })
        for (const f of p.along?.food || []) actions.addPlace({ ...poiToPlaceFields(f, trip.id, day), notes: `On the way · ${poiTypeLabel(f)}` })
        for (const sg of p.sights) actions.addPlace(poiToPlaceFields(sg, trip.id, day))
        for (const f of p.food) actions.addPlace(poiToPlaceFields(f, trip.id, day))
        if (p.camp) {
          const cg = actions.saveCampgroundFromMap(p.camp)
          actions.addPlace({
            name: `Overnight: ${cg.name}`,
            category: 'campground',
            visited: false,
            tripId: trip.id,
            day,
            notes: p.camp.kind === 'rv-park' ? 'RV park' : 'Campground',
            lat: cg.lat,
            lon: cg.lon,
          })
          if (wp.kind === 'end') firstCamp = cg
          else if (!firstCamp) firstCamp = firstCamp || null
        }
      }
      day++
    }
    // The destination's campground is the trip's home base.
    if (planned) {
      const endPlan = planned.find((r) => r.stop.kind === 'end')
      if (endPlan?.camp) {
        const cg = actions.saveCampgroundFromMap(endPlan.camp)
        actions.updateTrip(trip.id, { campgroundId: cg.id })
      }
    }

    navigate(`trip/${trip.id}`, { replace: true })
    celebrate({
      title: planned ? 'The whole road trip, planned.' : 'Road trip saved.',
      sub: planned
        ? `${dayCount} days · ${totalMiles} miles · every stop has its day. Rearrange anything on the trip page.`
        : included.length
          ? `${included.length} ${included.length === 1 ? 'park' : 'parks'} on the way, ${totalMiles} miles. Tap “Plan it all” anytime to fill in stays and sights.`
          : `${totalMiles} miles of open road. Add stops as you go.`,
      stampWord: 'ROAD TRIP',
      icon: 'rv',
    })
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

          {/* ---- auto-plan ---- */}
          {!auto && (
            <div className="autoplan-cta">
              <div>
                <div style={{ fontWeight: 680 }}>Plan it all for me</div>
                <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 2 }}>
                  A campground, sights and food at every stop — plus what’s worth pulling over for on
                  each drive between them.
                </div>
              </div>
              <Button small icon="sparkle" onClick={planItAll}>
                Plan it all
              </Button>
            </div>
          )}
          {auto?.progress && (
            <div className="autoplan-cta">
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 680 }}>
                  Planning stop {Math.min(auto.progress.i + 1, auto.progress.total)} of {auto.progress.total}
                  {auto.progress.label ? ` — ${auto.progress.label}` : ''}
                </div>
                <div className="progress" style={{ marginTop: 8 }}>
                  <div className="progress-fill" style={{ width: `${(auto.progress.i / Math.max(1, auto.progress.total)) * 100}%` }} />
                </div>
              </div>
            </div>
          )}
          {(auto?.result || auto?.partial?.some(Boolean)) && (
            <div style={{ marginTop: 14 }}>
              <div className="section-title" style={{ fontSize: 18, marginBottom: 8 }}>Your plan, day by day</div>
              {(auto.result || auto.partial).map((r, i) => r ? (
                <div key={r.stop.name}>
                  {(r.along?.sights?.length > 0 || r.along?.food?.length > 0) && (
                    <div className="along-row">
                      <div className="along-rail" />
                      <div className="along-card">
                        <div className="along-label">
                          <Icon name="road" size={11} /> On the way from {r.legFrom}
                        </div>
                        {r.along.sights.map((s) => (
                          <div key={s.id} className="along-item">
                            <Icon name="camera" size={13} />
                            <span>{s.name} <span className="dim">· {poiTypeLabel(s)}</span></span>
                          </div>
                        ))}
                        {r.along.food.map((f) => (
                          <div key={f.id} className="along-item">
                            <Icon name="food" size={13} />
                            <span>{f.name} <span className="dim">· {poiTypeLabel(f)}</span></span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                <div className="pick-card" style={{ padding: '12px 14px' }}>
                  <div className="pick-head">
                    <span className="pick-rank">{i + 1}</span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="pick-name" style={{ fontSize: 16.5 }}>{r.stop.name}</div>
                      <div className="pick-sub">Day {i + 1}</div>
                    </div>
                    {r.camp && (
                      <Button small variant="soft" icon="calendar" onClick={() => setBookingCg(r.camp)}>
                        Book
                      </Button>
                    )}
                  </div>
                  <ul className="pick-reasons" style={{ marginTop: 8 }}>
                    <li className="pick-reason tone-good">
                      <Icon name="tent" size={12} />
                      {r.camp ? `Stay: ${r.camp.name}` : rvMode ? 'No RV campground mapped nearby' : 'No campground mapped nearby'}
                    </li>
                    {r.sights.map((s) => (
                      <li key={s.id} className="pick-reason tone-info">
                        <Icon name="camera" size={12} />
                        {s.name} <span style={{ opacity: 0.7 }}>· {poiTypeLabel(s)}</span>
                      </li>
                    ))}
                    {r.food.map((f) => (
                      <li key={f.id} className="pick-reason tone-info">
                        <Icon name="food" size={12} />
                        {f.name} <span style={{ opacity: 0.7 }}>· {poiTypeLabel(f)}</span>
                      </li>
                    ))}
                    {r.sights.length === 0 && r.food.length === 0 && (
                      <li className="pick-reason tone-warn">
                        <Icon name="info" size={12} /> Sparse map data here — add your own finds later
                      </li>
                    )}
                  </ul>
                </div>
                </div>
              ) : (
                <div key={i} className="pick-card" style={{ padding: '12px 14px', opacity: 0.55 }}>
                  <div className="pick-head">
                    <span className="pick-rank">{i + 1}</span>
                    <div className="pick-name" style={{ fontSize: 16.5 }}>Planning…</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button full icon="route" onClick={createTrip} style={{ marginTop: 16 }} disabled={!!auto?.progress}>
            {auto?.result ? 'Create the Full Itinerary' : 'Create This Road Trip'}
          </Button>
          <p className="field-hint" style={{ textAlign: 'center', marginTop: 8 }}>
            {auto?.result
              ? 'Every stop, sight and meal lands on its own day — rearrange anything on the trip page.'
              : 'The route lands on the trip page; the stops become your itinerary.'}
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
      <BookingSheet open={!!bookingCg} onClose={() => setBookingCg(null)} cg={bookingCg} />
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
          {kind === 'stop' && !off && <WikiThumb hint={{ name: `${title} National Park`, kind: 'National Park' }} size={44} />}
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
