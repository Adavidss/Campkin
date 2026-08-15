import React, { useEffect, useMemo, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import { Button, Card, EmptyState, Section, useToast } from '../components/ui.jsx'
import MapView, { DAY_COLORS } from '../components/MapView.jsx'
import WikiCard from '../components/WikiCard.jsx'
import { decodeShare } from '../lib/share.js'
import { fmtRange, parseISO } from '../lib/dates.js'
import { CATEGORY_BY_ID } from '../data/model.js'
import { appleMapsDirections, telHref, normalizeUrl } from '../lib/maps.js'
import { useMapDark } from '../lib/hooks.js'
import { roadMilesEstimate } from '../lib/geo.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// A trip someone shared with you: read-only, works with no data of your
// own, and can be saved into your Campkin as a copy.
export default function SharedTrip({ token }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const mapDark = useMapDark()
  const [t, setT] = useState(undefined) // undefined loading, null bad, {} ok
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let live = true
    decodeShare(token)
      .then((d) => live && setT(d))
      .catch(() => live && setT(null))
    return () => {
      live = false
    }
  }, [token])

  const byDay = useMemo(() => {
    if (!t) return []
    const map = new Map()
    for (const p of [...t.places].sort((a, b) => (a.day || 99) - (b.day || 99) || a.order - b.order)) {
      const k = p.day || 0
      if (!map.has(k)) map.set(k, [])
      map.get(k).push(p)
    }
    return [...map.entries()]
  }, [t])

  if (t === undefined) {
    return (
      <div className="splash" style={{ minHeight: '60dvh' }}>
        <Logo size={48} />
        <p style={{ color: 'var(--ink-faint)' }}>Opening the trip…</p>
      </div>
    )
  }
  if (t === null) {
    return (
      <EmptyState icon="route" title="This link didn’t open" text="It may be incomplete — ask for it to be sent again.">
        <Button variant="soft" onClick={() => navigate('')}>Go to Campkin</Button>
      </EmptyState>
    )
  }

  const dayLabel = (day) => {
    if (!day) return 'Ideas'
    if (!t.startDate) return `Day ${day}`
    const d = parseISO(t.startDate)
    d.setDate(d.getDate() + day - 1)
    return `Day ${day} · ${WEEKDAYS[d.getDay()]} ${d.getDate()}`
  }

  const located = t.places.filter((p) => p.lat != null)
  const start = t.route?.fromCoord
  const markers = [
    ...(start ? [{ id: 'start', lat: start.lat, lon: start.lon, kind: 'from', z: 100 }] : []),
    ...(t.cg?.lat != null ? [{ id: 'cg', lat: t.cg.lat, lon: t.cg.lon, kind: 'campground', z: 200 }] : []),
    ...located.map((p, i) => ({
      id: 'p' + i,
      lat: p.lat,
      lon: p.lon,
      kind: p.category === 'food' ? 'food' : p.category === 'campground' ? 'campground' : 'sight',
      color: p.day ? DAY_COLORS[(p.day - 1) % DAY_COLORS.length] : '#8b897d',
      label: p.day && p.category !== 'campground' ? String(p.day) : null,
    })),
  ]
  const ordered = located.filter((p) => p.day).sort((a, b) => a.day - b.day || a.order - b.order)
  const legs = []
  let prev = start || null
  for (const p of ordered) {
    if (prev) legs.push({ points: [prev, p], color: DAY_COLORS[(p.day - 1) % DAY_COLORS.length] })
    prev = p
  }
  if (t.cg?.lat != null && prev && !(prev.lat === t.cg.lat && prev.lon === t.cg.lon)) legs.push({ points: [prev, t.cg], color: '#33544A' })

  function saveCopy() {
    const trip = actions.createTrip({
      name: t.name,
      destination: t.destination || '',
      startDate: t.startDate || '',
      endDate: t.endDate || '',
    })
    const patch = { notes: t.notes || '', siteNumber: t.siteNumber || '', checkIn: t.checkIn || '', checkOut: t.checkOut || '' }
    if (t.route) patch.route = { ...t.route, notes: '' }
    if (t.cg) {
      const cg = actions.addCampground({
        name: t.cg.name,
        location: t.cg.location,
        address: t.cg.address,
        phone: t.cg.phone,
        website: t.cg.website,
        hookups: t.cg.hookups,
        lat: t.cg.lat,
        lon: t.cg.lon,
      })
      patch.campgroundId = cg.id
    }
    actions.updateTrip(trip.id, patch)
    for (const p of t.places) {
      actions.addPlace({
        name: p.name,
        category: p.category,
        state: p.state,
        notes: p.notes,
        day: p.day,
        order: p.order,
        lat: p.lat,
        lon: p.lon,
        visited: false,
        tripId: trip.id,
      })
    }
    setSaved(true)
    toast('Saved to your trips', { icon: 'check' })
    navigate(`trip/${trip.id}`, { replace: true })
  }

  const cat = (c) => CATEGORY_BY_ID[c] || CATEGORY_BY_ID.other

  return (
    <>
      <div className="shared-banner">
        <Logo size={26} />
        <span>A trip shared with you</span>
        <a href="#/" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 700 }}>Open Campkin</a>
      </div>

      <div className="page-head" style={{ marginTop: 6 }}>
        <div>
          <h1 className="page-title">{t.name}</h1>
          <p className="page-sub">
            {[t.destination, fmtRange(t.startDate, t.endDate)].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <Button icon="plus" onClick={saveCopy} disabled={saved}>
          {saved ? 'Saved' : 'Save to my Campkin'}
        </Button>
        {t.cg && (
          <Button variant="soft" icon="map" href={appleMapsDirections(t.cg.lat != null ? `${t.cg.lat},${t.cg.lon}` : t.cg.address || t.cg.name)} target="_blank" rel="noopener">
            Directions
          </Button>
        )}
      </div>

      {t.destination && <WikiCard variant="hero" hint={{ name: t.destination.split(',')[0], state: t.destination.split(',').slice(1).join(',').trim() }} />}

      {(markers.length > 0) && (
        <Section title="Map">
          <MapView markers={markers} legs={legs} fit="markers" dark={mapDark} height={280} />
          {legs.length > 0 && (
            <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', margin: '8px 4px 0' }}>
              ~{legs.reduce((s, l) => s + roadMilesEstimate(l.points[0], l.points[1]), 0)} mi across {legs.length} {legs.length === 1 ? 'leg' : 'legs'}
            </p>
          )}
        </Section>
      )}

      {(t.route || t.cg) && (
        <Section title="Getting there & staying">
          <Card>
            {t.route?.from && (
              <div style={{ marginBottom: t.cg ? 12 : 0 }}>
                <div className="memory-label">Route</div>
                <div style={{ fontWeight: 650, marginTop: 3 }}>
                  {t.route.from} <Icon name="chevronRight" size={12} style={{ color: 'var(--ink-faint)' }} /> {t.route.to || t.destination}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>
                  {[t.route.miles && `${t.route.miles} mi`, t.route.driveTime && `about ${t.route.driveTime}`].filter(Boolean).join(' · ')}
                </div>
              </div>
            )}
            {t.cg && (
              <div>
                <div className="memory-label">Campground</div>
                <div style={{ fontWeight: 650, marginTop: 3 }}>
                  {t.cg.name}
                  {t.siteNumber ? ` · Site ${t.siteNumber}` : ''}
                </div>
                <div style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>
                  {[t.cg.location, t.cg.hookups, t.checkIn && `check-in ${t.checkIn}`].filter(Boolean).join(' · ')}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                  {t.cg.phone && <Button variant="soft" small icon="phone" href={telHref(t.cg.phone)}>Call</Button>}
                  {t.cg.website && <Button variant="soft" small icon="globe" href={normalizeUrl(t.cg.website)} target="_blank" rel="noopener">Website</Button>}
                </div>
              </div>
            )}
          </Card>
        </Section>
      )}

      {byDay.length > 0 && (
        <Section title="The plan">
          {byDay.map(([day, list]) => (
            <div key={day} className="itin-day">
              <div className="itin-day-head">
                <span className="itin-day-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  {day > 0 && <span className="legend-dot" style={{ background: DAY_COLORS[(day - 1) % DAY_COLORS.length] }} />}
                  {dayLabel(day)}
                </span>
                <span className="itin-day-count">{list.length}</span>
              </div>
              {list.map((p, i) => (
                <div key={i} className="itin-row" style={{ padding: '10px 12px' }}>
                  <span className="itin-icon"><Icon name={cat(p.category).icon} size={15} /></span>
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span className="itin-name">{p.name}</span>
                    <span className="itin-sub">{[cat(p.category).label, p.notes].filter(Boolean).join(' · ')}</span>
                  </span>
                  {p.lat != null && (
                    <a className="icon-btn itin-mini" href={appleMapsDirections(`${p.lat},${p.lon}`)} target="_blank" rel="noopener" aria-label={`Directions to ${p.name}`}>
                      <Icon name="map" size={15} />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {t.notes && (
        <Section title="Notes">
          <Card><p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{t.notes}</p></Card>
        </Section>
      )}

      <div style={{ textAlign: 'center', margin: '28px 0 8px', color: 'var(--ink-faint)', fontSize: 12.5 }}>
        Made with <b>Campkin</b> · <a href="#/">plan your own</a>
      </div>
    </>
  )
}
