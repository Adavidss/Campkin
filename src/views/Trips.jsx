import React, { useMemo, useState } from 'react'
import { useApp, tripsByStatus, tripStatus } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import { Button, EmptyState, Section, ListRow, Chips } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import TripCard from '../components/TripCard.jsx'
import { parseStateFrom, stateName } from '../lib/states.js'

const ORGANIZER_THRESHOLD = 6

export default function Trips() {
  const { state } = useApp()
  const { current, upcoming, past } = tripsByStatus(state.trips)
  const none = state.trips.length === 0
  const many = state.trips.length >= ORGANIZER_THRESHOLD
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState(null) // upcoming | past | favorites | rated
  const [sort, setSort] = useState('date') // date | name | rating

  const cgName = (t) => state.campgrounds.find((c) => c.id === t.campgroundId)?.name || ''

  const searching = q.trim().length >= 2 || !!filter
  const results = useMemo(() => {
    if (!searching) return null
    const needle = q.trim().toLowerCase()
    const match = (s) => s && s.toLowerCase().includes(needle)
    let list = state.trips.filter((t) => {
      if (!needle) return true
      const st = parseStateFrom(t.destination)
      return (
        match(t.name) ||
        match(t.destination) ||
        match(cgName(t)) ||
        match(t.notes) ||
        match(t.favoritePlace) ||
        (st && (match(stateName(st)) || st.toLowerCase() === needle)) ||
        (t.startDate || '').startsWith(needle)
      )
    })
    if (filter === 'upcoming') list = list.filter((t) => ['planned', 'active'].includes(tripStatus(t)))
    if (filter === 'past') list = list.filter((t) => t.completed || tripStatus(t) === 'past-due')
    if (filter === 'favorites') list = list.filter((t) => t.favorite)
    if (filter === 'rated') list = list.filter((t) => t.rating >= 4)
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name))
    else if (sort === 'rating') list.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else list.sort((a, b) => ((b.startDate || '') > (a.startDate || '') ? 1 : -1))
    return list
  }, [state.trips, q, filter, sort, searching])

  // Past trips grouped by year once there are many.
  const pastByYear = useMemo(() => {
    if (!many) return null
    const groups = new Map()
    for (const t of past) {
      const y = (t.startDate || t.endDate || '').slice(0, 4) || 'Undated'
      if (!groups.has(y)) groups.set(y, [])
      groups.get(y).push(t)
    }
    return [...groups.entries()].sort((a, b) => (a[0] > b[0] ? -1 : 1))
  }, [past, many])

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Trips</h1>
          {!none && (
            <p className="page-sub">
              {state.trips.length} {state.trips.length === 1 ? 'trip' : 'trips'} in your book
            </p>
          )}
        </div>
        <Button icon="plus" small onClick={() => navigate('trips/new')}>
          Plan a Trip
        </Button>
      </div>

      <div style={{ display: 'grid', gap: 8, marginBottom: 16 }}>
        <ListRow
          icon="pin"
          title="Quick Trip"
          sub="Tap a place near you — get a whole trip, ready to go"
          onClick={() => navigate('trips/quick')}
          right={<Icon name="chevronRight" size={16} />}
          className="ideas-row"
        />
        <ListRow
          icon="sparkle"
          title="Trip Ideas"
          sub="Recommended park runs near you, mapped and ranked"
          onClick={() => navigate('trips/ideas')}
          right={<Icon name="chevronRight" size={16} />}
          className="ideas-row"
        />
        <ListRow
          icon="rv"
          title="Plan a Road Trip"
          sub="A→B with parks, campgrounds, sights and food on the way"
          onClick={() => navigate('trips/roadtrip')}
          right={<Icon name="chevronRight" size={16} />}
          className="ideas-row"
        />
      </div>

      {none && (
        <EmptyState
          icon="route"
          title="No trips yet"
          text="Plan your first trip — a name and dates are all it takes to get rolling."
        >
          <Button icon="plus" onClick={() => navigate('trips/new')}>
            Plan Your First Trip
          </Button>
        </EmptyState>
      )}

      {/* ---- organizer: search + filters ---- */}
      {!none && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ position: 'relative' }}>
            <Icon name="search" size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
            <input
              className="input"
              style={{ paddingLeft: 36 }}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search trips — name, place, campground, state, year…"
              aria-label="Search trips"
            />
          </div>
          {(many || searching) && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Chips
                  className="is-nowrap"
                  options={[
                    { id: 'upcoming', label: 'Upcoming' },
                    { id: 'past', label: 'Past' },
                    { id: 'favorites', label: 'Favorites', icon: 'heart' },
                    { id: 'rated', label: '4★ & up', icon: 'star' },
                  ]}
                  value={filter}
                  onChange={setFilter}
                  ariaLabel="Filter trips"
                />
              </div>
              {searching && (
                <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort" style={{ width: 118, minHeight: 36, padding: '6px 30px 6px 10px', fontSize: 13.5 }}>
                  <option value="date">By date</option>
                  <option value="name">By name</option>
                  <option value="rating">By rating</option>
                </select>
              )}
            </div>
          )}
        </div>
      )}

      {searching ? (
        results.length === 0 ? (
          <EmptyState compact icon="search" title="No trips match" text="Try another word, or clear the filters." />
        ) : (
          <div className="cards" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <p style={{ fontSize: 13, color: 'var(--ink-faint)', margin: '0 2px' }}>
              {results.length} {results.length === 1 ? 'trip' : 'trips'}
            </p>
            {results.map((t) => (
              <TripCard key={t.id} trip={t} />
            ))}
          </div>
        )
      ) : (
        <>
          {current.length > 0 && (
            <div className="trip-group">
              <Section title="Happening now">
                <div className="cards">
                  {current.map((t) => (
                    <TripCard key={t.id} trip={t} />
                  ))}
                </div>
              </Section>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="trip-group">
              <Section title="Upcoming">
                <div className="cards">
                  {upcoming.map((t) => (
                    <TripCard key={t.id} trip={t} />
                  ))}
                </div>
              </Section>
            </div>
          )}

          {past.length > 0 && !pastByYear && (
            <div className="trip-group">
              <Section title="Past trips">
                <div className="cards">
                  {past.map((t) => (
                    <TripCard key={t.id} trip={t} />
                  ))}
                </div>
              </Section>
            </div>
          )}

          {pastByYear &&
            pastByYear.map(([year, list]) => (
              <div className="trip-group" key={year}>
                <Section
                  title={year}
                  action={<span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{list.length} {list.length === 1 ? 'trip' : 'trips'}</span>}
                >
                  <div className="cards">
                    {list.map((t) => (
                      <TripCard key={t.id} trip={t} />
                    ))}
                  </div>
                </Section>
              </div>
            ))}
        </>
      )}
    </>
  )
}
