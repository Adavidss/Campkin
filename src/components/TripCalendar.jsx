import React, { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { Button, IconBtn, Sheet, useToast } from './ui.jsx'
import { DAY_COLORS } from './MapView.jsx'
import { useApp } from '../data/store.jsx'
import { CATEGORY_BY_ID } from '../data/model.js'
import { parseISO, toISO, fmtDate, todayISO } from '../lib/dates.js'
import { cx } from '../lib/util.js'

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function addDays(iso, n) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}
function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000)
}

// An interactive month calendar for ONE trip: the trip's days are shaded and
// numbered, each day shows how many stops it holds, tap a day to see and
// manage its stops, tap outside the range to extend or shorten the trip.
export default function TripCalendar({ trip, places, onAddToDay, onEditPlace }) {
  const { actions } = useApp()
  const toast = useToast()
  const start = trip.startDate || todayISO()
  const end = trip.endDate || start
  const [month, setMonth] = useState(() => {
    const d = parseISO(start)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [openDay, setOpenDay] = useState(null) // trip day number
  const [mode, setMode] = useState('view') // view | start | end

  const dayCount = Math.max(1, daysBetween(start, end) + 1)
  const countByDay = useMemo(() => {
    const m = new Map()
    for (const p of places) if (p.day) m.set(p.day, (m.get(p.day) || 0) + 1)
    return m
  }, [places])
  const unscheduled = places.filter((p) => !p.day).length

  // month grid cells
  const first = new Date(month.y, month.m, 1)
  const lead = first.getDay()
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(month.y, month.m, d)))
  while (cells.length % 7) cells.push(null)

  const tripDayOf = (iso) => (iso >= start && iso <= end ? daysBetween(start, iso) + 1 : null)

  function onTapDay(iso) {
    if (mode === 'start') {
      if (iso > end) {
        toast('Pick a day on or before the last day.')
        return
      }
      reshape(iso, end)
      setMode('view')
      return
    }
    if (mode === 'end') {
      if (iso < start) {
        toast('Pick a day on or after the first day.')
        return
      }
      reshape(start, iso)
      setMode('view')
      return
    }
    const td = tripDayOf(iso)
    if (td) setOpenDay(td)
    else if (iso > end) {
      // Tapping past the end extends the trip to that day.
      reshape(start, iso)
      toast(`Trip now runs through ${fmtDate(iso, { year: false })}`, { icon: 'calendar' })
    } else if (iso < start) {
      reshape(iso, end)
      toast(`Trip now starts ${fmtDate(iso, { year: false })}`, { icon: 'calendar' })
    }
  }

  // Change dates, keeping every stop on the same calendar date where possible.
  function reshape(newStart, newEnd) {
    const shift = daysBetween(start, newStart) // +N if start moved later
    const newCount = daysBetween(newStart, newEnd) + 1
    actions.updateTrip(trip.id, { startDate: newStart, endDate: newEnd })
    for (const p of places) {
      if (!p.day) continue
      let nd = p.day - shift
      if (nd < 1 || nd > newCount) nd = null // fell off the trip → back to Ideas
      if (nd !== p.day) actions.setPlaceDay(p.id, nd)
    }
  }

  const openList = openDay
    ? places
        .filter((p) => p.day === openDay)
        .sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt < b.createdAt ? -1 : 1))
    : []
  const openISO = openDay ? addDays(start, openDay - 1) : null

  return (
    <div className="tcal">
      <div className="tcal-head">
        <IconBtn name="chevronLeft" label="Previous month" onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} />
        <div className="tcal-month">
          {MONTHS[month.m]} {month.y}
        </div>
        <IconBtn name="chevronRight" label="Next month" onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} />
      </div>

      <div className="tcal-grid" role="grid" aria-label={`${trip.name} calendar`}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="tcal-wd">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="tcal-cell is-blank" />
          const td = tripDayOf(iso)
          const n = td ? countByDay.get(td) || 0 : 0
          const isStart = iso === start
          const isEnd = iso === end
          const today = iso === todayISO()
          return (
            <button
              key={iso}
              type="button"
              className={cx('tcal-cell', td && 'is-trip', isStart && 'is-start', isEnd && 'is-end', today && 'is-today', mode !== 'view' && 'is-picking')}
              style={td ? { '--day-color': DAY_COLORS[(td - 1) % DAY_COLORS.length] } : undefined}
              onClick={() => onTapDay(iso)}
              aria-label={`${fmtDate(iso)}${td ? `, trip day ${td}, ${n} stops` : ''}`}
            >
              <span className="tcal-num">{parseISO(iso).getDate()}</span>
              {td && <span className="tcal-daynum">D{td}</span>}
              {n > 0 && (
                <span className="tcal-dots" aria-hidden="true">
                  {Array.from({ length: Math.min(n, 4) }, (_, k) => (
                    <i key={k} />
                  ))}
                  {n > 4 && <b>+</b>}
                </span>
              )}
            </button>
          )
        })}
      </div>

      <div className="tcal-foot">
        <span>
          <b>{dayCount}</b> {dayCount === 1 ? 'day' : 'days'} · {fmtDate(start, { year: false })} – {fmtDate(end)}
          {unscheduled > 0 && ` · ${unscheduled} unscheduled`}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" className={cx('chip', mode === 'start' && 'is-active')} onClick={() => setMode(mode === 'start' ? 'view' : 'start')}>
            Change start
          </button>
          <button type="button" className={cx('chip', mode === 'end' && 'is-active')} onClick={() => setMode(mode === 'end' ? 'view' : 'end')}>
            Change end
          </button>
        </div>
      </div>
      {mode !== 'view' && (
        <p className="tcal-hint">Tap the new {mode === 'start' ? 'first' : 'last'} day. Stops keep their dates; any that fall off go back to Ideas.</p>
      )}
      {mode === 'view' && <p className="tcal-hint">Tap a trip day to see its stops · tap a day after the end to extend the trip</p>}

      {/* day sheet */}
      <Sheet open={!!openDay} onClose={() => setOpenDay(null)} title="">
        {openDay && (
          <div style={{ paddingBottom: 6 }}>
            <div className="memory-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="legend-dot" style={{ background: DAY_COLORS[(openDay - 1) % DAY_COLORS.length] }} />
              Day {openDay} of {dayCount}
            </div>
            <h3 style={{ fontSize: 22, marginTop: 4 }}>{fmtDate(openISO)}</h3>
            {openList.length === 0 ? (
              <p style={{ fontSize: 14, color: 'var(--ink-faint)', margin: '10px 0 14px' }}>Nothing planned yet — a free day, or add something.</p>
            ) : (
              <div style={{ margin: '12px 0' }}>
                {openList.map((p, i) => {
                  const cat = CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other
                  return (
                    <div key={p.id} className={cx('itin-row', p.visited && 'is-done')}>
                      <button
                        type="button"
                        className="itin-check"
                        aria-label={p.visited ? 'Mark not done' : 'Mark done'}
                        onClick={() => actions.updatePlace(p.id, p.visited ? { visited: false } : { visited: true, dateVisited: openISO })}
                      >
                        <Icon name="check" size={13} strokeWidth={2.4} />
                      </button>
                      <button type="button" className="itin-main" onClick={() => { setOpenDay(null); onEditPlace(p) }}>
                        <span className="itin-icon"><Icon name={cat.icon} size={15} /></span>
                        <span style={{ minWidth: 0 }}>
                          <span className="itin-name">{p.name}</span>
                          <span className="itin-sub">{[cat.label, p.notes].filter(Boolean).join(' · ')}</span>
                        </span>
                      </button>
                      <div className="itin-actions">
                        <IconBtn name="chevronDown" label="Move up" className="itin-mini" disabled={i === 0} onClick={() => actions.movePlace(p.id, -1)} style={{ transform: 'rotate(180deg)' }} />
                        <IconBtn name="chevronDown" label="Move down" className="itin-mini" disabled={i === openList.length - 1} onClick={() => actions.movePlace(p.id, 1)} />
                        <IconBtn name="chevronRight" label="Move to next day" className="itin-mini" disabled={openDay >= dayCount} onClick={() => actions.setPlaceDay(p.id, openDay + 1)} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button small icon="plus" onClick={() => { setOpenDay(null); onAddToDay(openDay) }}>
                Add to this day
              </Button>
              {unscheduled > 0 && (
                <Button
                  variant="soft"
                  small
                  icon="sparkle"
                  onClick={() => {
                    // Pull one unscheduled idea onto this day.
                    const idea = places.find((p) => !p.day)
                    if (idea) {
                      actions.setPlaceDay(idea.id, openDay)
                      toast(`${idea.name} → Day ${openDay}`, { icon: 'check' })
                    }
                  }}
                >
                  Pull in an idea ({unscheduled})
                </Button>
              )}
              {openDay > 1 && (
                <Button variant="ghost" small icon="chevronLeft" onClick={() => setOpenDay(openDay - 1)}>
                  Day {openDay - 1}
                </Button>
              )}
              {openDay < dayCount && (
                <Button variant="ghost" small icon="chevronRight" onClick={() => setOpenDay(openDay + 1)}>
                  Day {openDay + 1}
                </Button>
              )}
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

// All trips across the months — the planning overview.
export function TripsCalendar({ trips, onOpen }) {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const first = new Date(month.y, month.m, 1)
  const lead = first.getDay()
  const daysInMonth = new Date(month.y, month.m + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < lead; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(toISO(new Date(month.y, month.m, d)))
  while (cells.length % 7) cells.push(null)

  const dated = trips.filter((t) => t.startDate)
  const colorOf = (t) => DAY_COLORS[Math.abs(hash(t.id)) % DAY_COLORS.length]
  const onDay = (iso) => dated.filter((t) => iso >= t.startDate && iso <= (t.endDate || t.startDate))
  const monthTrips = dated
    .filter((t) => {
      const mStart = toISO(first)
      const mEnd = toISO(new Date(month.y, month.m, daysInMonth))
      return t.startDate <= mEnd && (t.endDate || t.startDate) >= mStart
    })
    .sort((a, b) => (a.startDate < b.startDate ? -1 : 1))

  return (
    <div className="tcal">
      <div className="tcal-head">
        <IconBtn name="chevronLeft" label="Previous month" onClick={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))} />
        <div className="tcal-month">
          {MONTHS[month.m]} {month.y}
        </div>
        <IconBtn name="chevronRight" label="Next month" onClick={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))} />
      </div>
      <div className="tcal-grid">
        {WEEKDAYS.map((w, i) => (
          <div key={i} className="tcal-wd">
            {w}
          </div>
        ))}
        {cells.map((iso, i) => {
          if (!iso) return <div key={i} className="tcal-cell is-blank" />
          const ts = onDay(iso)
          const today = iso === todayISO()
          const t0 = ts[0]
          return (
            <button
              key={iso}
              type="button"
              className={cx('tcal-cell', ts.length && 'is-trip', today && 'is-today', t0 && iso === t0.startDate && 'is-start', t0 && iso === (t0.endDate || t0.startDate) && 'is-end')}
              style={t0 ? { '--day-color': colorOf(t0) } : undefined}
              onClick={() => t0 && onOpen(t0)}
              aria-label={`${fmtDate(iso)}${ts.length ? `, ${ts.map((t) => t.name).join(', ')}` : ''}`}
            >
              <span className="tcal-num">{parseISO(iso).getDate()}</span>
              {ts.length > 1 && <span className="tcal-daynum">+{ts.length - 1}</span>}
            </button>
          )
        })}
      </div>
      {monthTrips.length > 0 ? (
        <div style={{ marginTop: 10 }}>
          {monthTrips.map((t) => (
            <button key={t.id} type="button" className="tcal-trip" onClick={() => onOpen(t)}>
              <span className="legend-dot" style={{ background: colorOf(t) }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="tcal-trip-name">{t.name}</span>
                <span className="tcal-trip-dates">
                  {fmtDate(t.startDate, { year: false })}
                  {t.endDate && t.endDate !== t.startDate ? ` – ${fmtDate(t.endDate, { year: false })}` : ''}
                  {t.destination ? ` · ${t.destination}` : ''}
                </span>
              </span>
              <Icon name="chevronRight" size={16} style={{ color: 'var(--ink-faint)' }} />
            </button>
          ))}
        </div>
      ) : (
        <p className="tcal-hint">No trips this month — the road is wide open.</p>
      )}
    </div>
  )
}

function hash(s) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h
}
