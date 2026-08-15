import React, { useMemo, useState } from 'react'
import Icon from './Icon.jsx'
import { Button, IconBtn, EmptyState, Sheet, Field, Chips, useToast } from './ui.jsx'
import { useApp } from '../data/store.jsx'
import { CATEGORY_BY_ID, PLACE_CATEGORIES } from '../data/model.js'
import { appleMapsSearch } from '../lib/maps.js'
import { parseISO, toISO, todayISO, fmtDate } from '../lib/dates.js'
import { cx } from '../lib/util.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(trip, day) {
  if (!trip.startDate) return `Day ${day}`
  const d = parseISO(trip.startDate)
  d.setDate(d.getDate() + day - 1)
  return `Day ${day} · ${WEEKDAYS[d.getDay()]} ${d.getDate()}`
}

export function tripDayCount(trip) {
  if (!trip.startDate || !trip.endDate) return 3
  return Math.max(1, Math.round((parseISO(trip.endDate) - parseISO(trip.startDate)) / 86400000) + 1)
}

// Day-by-day plan for a trip: sights, food, and stops. Everything is a place
// record with a `day`; unscheduled places sit in "Ideas" until you slot them.
export default function Itinerary({ trip, places, onEdit, onDiscover, onAdd }) {
  const { actions } = useApp()
  const toast = useToast()
  const [moving, setMoving] = useState(null) // place being reassigned a day
  const dayCount = tripDayCount(trip)
  const days = Array.from({ length: dayCount }, (_, i) => i + 1)

  const byDay = useMemo(() => {
    const map = new Map()
    for (const d of days) map.set(d, [])
    const ideas = []
    for (const p of places) {
      if (p.day && map.has(p.day)) map.get(p.day).push(p)
      else ideas.push(p)
    }
    const sortFn = (a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt < b.createdAt ? -1 : 1)
    for (const d of days) map.get(d).sort(sortFn)
    ideas.sort(sortFn)
    return { map, ideas }
  }, [places, dayCount])

  const scheduled = places.length - byDay.ideas.length

  if (!places.length) {
    return (
      <EmptyState
        compact
        icon="pin"
        title="Nothing planned yet"
        text="Add sights, restaurants and stops — then slot them into days."
      >
        <Button variant="soft" small icon="sparkle" onClick={onDiscover}>
          Discover Nearby
        </Button>
        <Button variant="ghost" small icon="plus" onClick={onAdd}>
          Add a Place
        </Button>
      </EmptyState>
    )
  }

  return (
    <div className="itin">
      {days.map((d) => (
        <div key={d} className="itin-day">
          <div className="itin-day-head">
            <span className="itin-day-title">{dayLabel(trip, d)}</span>
            <span className="itin-day-count">{byDay.map.get(d).length || ''}</span>
          </div>
          {byDay.map.get(d).length === 0 ? (
            <button type="button" className="itin-empty" onClick={onAdd}>
              <Icon name="plus" size={13} /> Add something for this day
            </button>
          ) : (
            byDay.map.get(d).map((p, i, arr) => (
              <ItinRow
                key={p.id}
                p={p}
                first={i === 0}
                last={i === arr.length - 1}
                onEdit={() => onEdit(p)}
                onMoveDay={() => setMoving(p)}
                onUp={() => actions.movePlace(p.id, -1)}
                onDown={() => actions.movePlace(p.id, 1)}
              />
            ))
          )}
        </div>
      ))}

      {byDay.ideas.length > 0 && (
        <div className="itin-day is-ideas">
          <div className="itin-day-head">
            <span className="itin-day-title">Ideas · not scheduled yet</span>
            <span className="itin-day-count">{byDay.ideas.length}</span>
          </div>
          {byDay.ideas.map((p) => (
            <ItinRow key={p.id} p={p} onEdit={() => onEdit(p)} onMoveDay={() => setMoving(p)} isIdea />
          ))}
        </div>
      )}

      {scheduled === 0 && byDay.ideas.length >= 3 && (
        <Button
          variant="soft"
          small
          full
          icon="calendar"
          style={{ marginTop: 6 }}
          onClick={() => {
            autoSchedule(byDay.ideas, dayCount, actions)
            toast('Spread across your days — drag anything you like', { icon: 'check' })
          }}
        >
          Auto-plan these across {dayCount} {dayCount === 1 ? 'day' : 'days'}
        </Button>
      )}

      <Sheet open={!!moving} onClose={() => setMoving(null)} title={moving ? `Which day for ${moving.name}?` : ''}>
        <div className="chips" style={{ paddingBottom: 12 }}>
          {days.map((d) => (
            <button
              key={d}
              type="button"
              className={cx('chip', moving?.day === d && 'is-active')}
              onClick={() => {
                actions.setPlaceDay(moving.id, d)
                setMoving(null)
              }}
            >
              {dayLabel(trip, d)}
            </button>
          ))}
          <button
            type="button"
            className={cx('chip', moving && !moving.day && 'is-active')}
            onClick={() => {
              actions.setPlaceDay(moving.id, null)
              setMoving(null)
            }}
          >
            Just an idea
          </button>
        </div>
      </Sheet>
    </div>
  )
}

// Round-robin unscheduled items into days, keeping food & sights interleaved
// so no day is all restaurants. Simple and predictable.
export function autoSchedule(items, dayCount, actions) {
  const sights = items.filter((p) => p.category !== 'food')
  const food = items.filter((p) => p.category === 'food')
  const perDaySights = Math.ceil(sights.length / dayCount)
  const perDayFood = Math.ceil(food.length / dayCount)
  let si = 0
  let fi = 0
  for (let d = 1; d <= dayCount; d++) {
    for (let k = 0; k < perDaySights && si < sights.length; k++) actions.setPlaceDay(sights[si++].id, d)
    for (let k = 0; k < perDayFood && fi < food.length; k++) actions.setPlaceDay(food[fi++].id, d)
  }
}

function ItinRow({ p, first, last, isIdea, onEdit, onMoveDay, onUp, onDown }) {
  const { actions } = useApp()
  const cat = CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other
  return (
    <div className={cx('itin-row', p.visited && 'is-done')}>
      <button
        type="button"
        className="itin-check"
        aria-label={p.visited ? 'Mark not done' : 'Mark done'}
        aria-pressed={p.visited}
        onClick={() =>
          actions.updatePlace(p.id, p.visited ? { visited: false } : { visited: true, dateVisited: todayISO() })
        }
      >
        <Icon name="check" size={13} strokeWidth={2.4} />
      </button>
      <button type="button" className="itin-main" onClick={onEdit}>
        <span className="itin-icon">
          <Icon name={cat.icon} size={15} />
        </span>
        <span style={{ minWidth: 0 }}>
          <span className="itin-name">{p.name}</span>
          <span className="itin-sub">{[cat.label, p.notes].filter(Boolean).join(' · ')}</span>
        </span>
      </button>
      <div className="itin-actions">
        {!isIdea && (
          <>
            <IconBtn name="chevronDown" label="Move down" onClick={onDown} disabled={last} className="itin-mini" style={{ transform: 'rotate(0deg)' }} />
            <IconBtn name="chevronDown" label="Move up" onClick={onUp} disabled={first} className="itin-mini" style={{ transform: 'rotate(180deg)' }} />
          </>
        )}
        <IconBtn name="calendar" label="Change day" onClick={onMoveDay} className="itin-mini" />
        <a
          href={appleMapsSearch(p.lat != null ? `${p.lat},${p.lon}` : `${p.name}${p.state ? ', ' + p.state : ''}`)}
          target="_blank"
          rel="noopener"
          className="icon-btn itin-mini"
          aria-label={`Open ${p.name} in Maps`}
        >
          <Icon name="map" size={15} />
        </a>
      </div>
    </div>
  )
}
