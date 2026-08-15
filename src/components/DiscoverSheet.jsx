import React, { useEffect, useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Sheet, Button, Segmented, EmptyState, useToast } from './ui.jsx'
import { useApp } from '../data/store.jsx'
import { fetchPOIs, topPOIs, poiIcon, poiTypeLabel } from '../lib/pois.js'
import { appleMapsSearch } from '../lib/maps.js'
import { todayISO } from '../lib/dates.js'

// "Sights & Food" — POI recommendations around a point, reused by trips and
// road-trip stops. With a tripId, picks can be added straight to the trip's
// Things to Do list.
export default function DiscoverSheet({ open, onClose, center, tripId }) {
  const { actions } = useApp()
  const toast = useToast()
  const [tab, setTab] = useState('sights')
  const [state, setState] = useState({ sights: null, food: null }) // null | 'loading' | 'error' | []
  const [added, setAdded] = useState(() => new Set())
  const [nonce, setNonce] = useState(0) // bump to retry

  useEffect(() => {
    if (!open) return
    setState({ sights: null, food: null })
    setTab('sights')
    setAdded(new Set())
  }, [open, center?.lat, center?.lon])

  useEffect(() => {
    if (!open || !center) return
    let cancelled = false
    const ctrl = new AbortController()
    setState((s) => ({ ...s, [tab]: 'loading' }))
    fetchPOIs(tab, center.lat, center.lon, tab === 'food' ? 10 : 15, { signal: ctrl.signal })
      .then((pois) => {
        if (!cancelled) setState((s) => ({ ...s, [tab]: topPOIs(pois, center, 6) }))
      })
      .catch((err) => {
        if (cancelled || err.name === 'AbortError') return
        console.error(err)
        setState((s) => ({ ...s, [tab]: 'error' }))
      })
    return () => {
      cancelled = true
      ctrl.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, center?.lat, center?.lon, nonce])

  if (!center) return null
  const current = state[tab]

  function addToTrip(p) {
    const category =
      p.kind === 'food'
        ? 'food'
        : p.natural === 'peak' || p.natural === 'waterfall' || p.natural === 'arch'
          ? 'other'
          : p.historic || p.tourism === 'museum'
            ? 'historic-site'
            : 'landmark'
    actions.addPlace({
      name: p.name,
      category,
      dateVisited: todayISO(),
      notes: poiTypeLabel(p),
      visited: false,
      tripId,
      lat: p.lat,
      lon: p.lon,
    })
    setAdded((s) => new Set(s).add(p.id))
    toast('Added to Things to Do', { icon: 'check' })
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Around ${center.label || 'here'}`} wide>
      <Segmented
        options={[
          { id: 'sights', label: 'Sights' },
          { id: 'food', label: 'Food & Drink' },
        ]}
        value={tab}
        onChange={setTab}
        ariaLabel="Discovery type"
      />
      <div style={{ marginTop: 14 }}>
        {current === 'loading' && (
          <p style={{ textAlign: 'center', color: 'var(--ink-faint)', fontSize: 14, margin: '18px 0' }}>
            {tab === 'food' ? 'Sniffing out the good spots…' : 'Scouting the area…'}
          </p>
        )}
        {current === 'error' && (
          <EmptyState compact icon="refresh" title="Couldn’t reach the map service">
            <Button variant="soft" small icon="refresh" onClick={() => setNonce((n) => n + 1)}>
              Try again
            </Button>
          </EmptyState>
        )}
        {Array.isArray(current) && current.length === 0 && (
          <EmptyState
            compact
            icon={tab === 'food' ? 'food' : 'camera'}
            title="Nothing mapped out here"
            text="Sparse map data — the area may still be full of surprises."
          />
        )}
        {Array.isArray(current) &&
          current.map((p) => (
            <div key={p.id} className="pick-card" style={{ padding: '12px 14px' }}>
              <div className="pick-head">
                <span className="row-icon" style={{ width: 36, height: 36 }}>
                  <Icon name={poiIcon(p)} size={19} />
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="pick-name" style={{ fontSize: 16 }}>{p.name}</div>
                  <div className="pick-sub">{poiTypeLabel(p)}</div>
                </div>
              </div>
              <ul className="pick-reasons" style={{ marginTop: 7 }}>
                {p.reasons.slice(0, 3).map((re, j) => (
                  <li key={j} className={`pick-reason tone-${re.tone}`}>
                    <Icon name={re.tone === 'good' ? 'check' : 'info'} size={12} />
                    {re.text}
                  </li>
                ))}
              </ul>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 9 }}>
                {tripId && (
                  <Button
                    variant="soft"
                    small
                    icon={added.has(p.id) ? 'check' : 'plus'}
                    disabled={added.has(p.id)}
                    onClick={() => addToTrip(p)}
                  >
                    {added.has(p.id) ? 'On the list' : 'Add to trip'}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  small
                  icon="map"
                  href={appleMapsSearch(`${p.lat},${p.lon}`)}
                  target="_blank"
                  rel="noopener"
                >
                  Map
                </Button>
              </div>
            </div>
          ))}
        <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 10, lineHeight: 1.5 }}>
          Ranked from OpenStreetMap — famous spots surface first, hidden gems hide even from maps.
        </p>
      </div>
    </Sheet>
  )
}
