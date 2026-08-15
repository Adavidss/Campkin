import React, { useEffect, useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { useApp, coverPhotoOf } from '../data/store.jsx'
import { usePhotoUrl } from '../lib/hooks.js'
import { wikiSummary } from '../lib/wiki.js'
import { navigate } from '../lib/router.jsx'
import { daysUntil, fmtRange, parseISO, todayISO } from '../lib/dates.js'
import { plural } from '../lib/util.js'

// A home-screen-widget-style countdown to the next trip: big number, the
// destination behind it, and it changes character as the day gets close —
// "in 3 weeks" → "6 days" → "Tomorrow!" → "Today — go." Ticks over at
// midnight without a reload.
export default function CountdownWidget({ trip }) {
  const { state } = useApp()
  const cover = coverPhotoOf(state, trip)
  const coverUrl = usePhotoUrl(cover?.id)
  const [wikiPhoto, setWikiPhoto] = useState(null)
  const [, tick] = useState(0)
  const cg = state.campgrounds.find((c) => c.id === trip.campgroundId)

  // Re-render at the next local midnight so the number rolls over.
  useEffect(() => {
    const now = new Date()
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5)
    const t = setTimeout(() => tick((n) => n + 1), next - now)
    return () => clearTimeout(t)
  })

  useEffect(() => {
    let live = true
    setWikiPhoto(null)
    const name = trip.destination?.split(',')[0]?.trim()
    if (!name || coverUrl) return
    wikiSummary({ name, state: trip.destination.split(',').slice(1).join(',').trim() })
      .then((d) => live && d?.thumb && setWikiPhoto(d.thumb))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [trip.destination, coverUrl])

  const n = daysUntil(trip.startDate)
  const photo = coverUrl || wikiPhoto
  const packed = trip.checklist.filter((i) => i.done).length
  const total = trip.checklist.length

  const { big, unit, line, mood } = useMemo(() => {
    if (n <= 0) return { big: 'Today', unit: '', line: 'Go time. Safe travels.', mood: 'now' }
    if (n === 1) return { big: 'Tomorrow', unit: '', line: 'Last check of the list tonight.', mood: 'soon' }
    if (n <= 6) return { big: String(n), unit: 'days', line: n <= 3 ? 'Almost there — start staging.' : 'Getting close.', mood: 'soon' }
    if (n <= 13) return { big: String(n), unit: 'days', line: 'Just over a week out.', mood: 'near' }
    if (n <= 55) {
      const w = Math.round(n / 7)
      return { big: String(n), unit: 'days', line: `About ${plural(w, 'week')} away.`, mood: 'far' }
    }
    const m = Math.round(n / 30)
    return { big: String(n), unit: 'days', line: `About ${plural(m, 'month')} out — plenty of time to plan.`, mood: 'far' }
  }, [n])

  const weekday = trip.startDate ? ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][parseISO(trip.startDate).getDay()] : ''

  return (
    <button
      type="button"
      className={`cdw mood-${mood} ${photo ? 'has-photo' : ''}`}
      onClick={() => navigate(`trip/${trip.id}`)}
      aria-label={`${trip.name}: ${big} ${unit}. Open trip.`}
    >
      {photo && <img src={photo} alt="" className="cdw-photo" />}
      <span className="cdw-scrim" aria-hidden="true" />
      <span className="cdw-body">
        <span className="cdw-eyebrow">
          <Icon name="calendar" size={12} /> Next trip{weekday ? ` · leaves ${weekday}` : ''}
        </span>
        <span className="cdw-count">
          <span className="cdw-big">{big}</span>
          {unit && <span className="cdw-unit">{unit}</span>}
        </span>
        <span className="cdw-name">{trip.name}</span>
        <span className="cdw-meta">
          {[trip.destination, fmtRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ')}
        </span>
        <span className="cdw-foot">
          <span className="cdw-line">{line}</span>
          {total > 0 && n <= 13 && (
            <span className="cdw-pack" title="Packing progress">
              <span className="cdw-pack-bar">
                <span style={{ width: `${Math.round((packed / total) * 100)}%` }} />
              </span>
              {packed}/{total} packed
            </span>
          )}
          {cg && n <= 6 && (
            <span className="cdw-cg">
              <Icon name="tent" size={11} /> {cg.name}
              {trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}
            </span>
          )}
        </span>
      </span>
      <span className="cdw-arrow" aria-hidden="true">
        <Icon name="chevronRight" size={18} />
      </span>
    </button>
  )
}
