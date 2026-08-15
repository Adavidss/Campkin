import React from 'react'
import Icon from './Icon.jsx'
import { Stars } from './ui.jsx'
import { useApp, tripStatus, coverPhotoOf } from '../data/store.jsx'
import { usePhotoUrl } from '../lib/hooks.js'
import { fmtRange, countdownLabel } from '../lib/dates.js'
import { navigate } from '../lib/router.jsx'
import { cx } from '../lib/util.js'

export default function TripCard({ trip }) {
  const { state } = useApp()
  const cover = coverPhotoOf(state, trip)
  const coverUrl = usePhotoUrl(cover?.id)
  const status = tripStatus(trip)
  const cg = state.campgrounds.find((c) => c.id === trip.campgroundId)
  const countdown = status === 'planned' && trip.startDate ? countdownLabel(trip.startDate) : null

  return (
    <button
      type="button"
      className={cx('card card-tappable trip-card', coverUrl && 'has-cover')}
      onClick={() => navigate(`trip/${trip.id}`)}
    >
      {coverUrl && (
        <>
          <img src={coverUrl} alt="" className="trip-cover" />
          <span className="trip-cover-scrim" aria-hidden="true" />
        </>
      )}
      <span className="trip-card-badges">
        {trip.sample && <span className="tag-sample">Sample</span>}
        {status === 'active' && <span className="badge badge-now">Now</span>}
        {status === 'past-due' && <span className="badge badge-soon">Ready to complete</span>}
        {countdown && <span className="badge badge-soon">{countdown}</span>}
        {trip.favorite && (
          <span className="badge badge-heart" aria-label="Favorite">
            <Icon name="heart" size={12} filled />
          </span>
        )}
      </span>
      <span className="trip-card-title">{trip.name}</span>
      <span className="trip-card-meta">
        {trip.destination && <span>{trip.destination}</span>}
        {(trip.startDate || trip.endDate) && <span>{fmtRange(trip.startDate, trip.endDate)}</span>}
      </span>
      <span className="trip-card-meta">
        {cg && (
          <span>
            <Icon name="tent" size={12} /> {cg.name}
            {trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}
          </span>
        )}
        {trip.completed && trip.rating > 0 && <Stars value={trip.rating} size={13} />}
      </span>
    </button>
  )
}
