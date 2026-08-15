import React from 'react'
import { useApp, tripsByStatus } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import { Button, EmptyState, Section, ListRow } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import TripCard from '../components/TripCard.jsx'

export default function Trips() {
  const { state } = useApp()
  const { current, upcoming, past } = tripsByStatus(state.trips)
  const none = state.trips.length === 0

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

      {past.length > 0 && (
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
    </>
  )
}
