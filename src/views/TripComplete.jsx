import React, { useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Card, Field, Segmented, Stars, EmptyState, useToast, Section } from '../components/ui.jsx'
import { useCelebrate } from '../components/Celebrate.jsx'
import PhotoStrip from '../components/PhotoStrip.jsx'
import { WOULD_RETURN } from '../data/model.js'
import { fmtRange } from '../lib/dates.js'

export default function TripComplete({ tripId }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const celebrate = useCelebrate()
  const trip = state.trips.find((t) => t.id === tripId)
  const editing = trip?.completed
  const [rating, setRating] = useState(trip?.rating || 0)
  const [wouldReturn, setWouldReturn] = useState(trip?.wouldReturn || null)
  const [favoritePart, setFavoritePart] = useState(trip?.favoritePart || '')
  const [favoriteMeal, setFavoriteMeal] = useState(trip?.favoriteMeal || '')
  const [favoritePlace, setFavoritePlace] = useState(trip?.favoritePlace || '')
  const [memory, setMemory] = useState(trip?.memory || '')
  const [remember, setRemember] = useState(trip?.rememberNextTime || '')

  if (!trip) {
    return (
      <EmptyState icon="route" title="Trip not found">
        <Button variant="soft" onClick={() => navigate('trips')}>Back to Trips</Button>
      </EmptyState>
    )
  }

  const cg = state.campgrounds.find((c) => c.id === trip.campgroundId)

  function finish(withRecap) {
    const recap = withRecap
      ? { rating, wouldReturn, favoritePart, favoriteMeal, favoritePlace, memory, rememberNextTime: remember }
      : {}
    actions.completeTrip(trip.id, recap)
    navigate(`trip/${trip.id}`, { replace: true })
    if (editing) toast('Recap saved', { icon: 'check' })
    else
      celebrate({
        title: 'Into the travel book it goes.',
        sub: rating ? `${trip.name} — ${'★'.repeat(rating)}. Your passport just got a little fuller.` : `${trip.name} is a keepsake now. Your passport just got a little fuller.`,
        stampWord: 'COMPLETED',
        icon: 'passport',
        kind: 'complete',
      })
  }

  return (
    <>
      <button type="button" className="page-back" onClick={() => back(`trip/${trip.id}`)}>
        <Icon name="arrowLeft" size={16} /> {trip.name}
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{editing ? 'Edit Recap' : 'Complete Trip'}</h1>
          <p className="page-sub">
            {trip.name} · {fmtRange(trip.startDate, trip.endDate)}
            {cg ? ` · ${cg.name}` : ''}
          </p>
        </div>
      </div>

      {!editing && (
        <p style={{ color: 'var(--ink-faint)', fontSize: 14, margin: '0 2px 16px' }}>
          A minute of memories, all optional — skip anything.
        </p>
      )}

      <Card style={{ textAlign: 'center', padding: '20px 16px' }}>
        <div className="memory-label" style={{ marginBottom: 8 }}>Overall</div>
        <Stars value={rating} onChange={setRating} size={30} label="Overall rating" />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <div className="memory-label" style={{ marginBottom: 8 }}>Would you come back?</div>
        <Segmented
          options={WOULD_RETURN}
          value={wouldReturn}
          onChange={(v) => setWouldReturn(wouldReturn === v ? null : v)}
          ariaLabel="Would you come back?"
        />
      </Card>

      <Card style={{ marginTop: 10 }}>
        <Field label="Favorite part">
          <input className="input" value={favoritePart} onChange={(e) => setFavoritePart(e.target.value)} placeholder="Sunset from the meadow" />
        </Field>
        <Field label="Favorite meal or restaurant">
          <input className="input" value={favoriteMeal} onChange={(e) => setFavoriteMeal(e.target.value)} />
        </Field>
        <Field label="Favorite place">
          <input className="input" value={favoritePlace} onChange={(e) => setFavoritePlace(e.target.value)} placeholder="Skyline Drive" />
        </Field>
        <Field label="A quick memory">
          <textarea className="textarea" rows={3} value={memory} onChange={(e) => setMemory(e.target.value)} placeholder="The one moment worth keeping." />
        </Field>
        <Field label="Remember for next time">
          <textarea className="textarea" rows={2} value={remember} onChange={(e) => setRemember(e.target.value)} placeholder="Site 42 has more shade." />
        </Field>
      </Card>

      <Section title="A few photos">
        <PhotoStrip entityType="trip" entityId={trip.id} coverId={trip.coverPhotoId} onSetCover={(pid) => actions.updateTrip(trip.id, { coverPhotoId: pid })} />
      </Section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 20 }}>
        <Button full icon="check" onClick={() => finish(true)}>
          {editing ? 'Save Recap' : 'Complete Trip'}
        </Button>
        {!editing && (
          <Button variant="ghost" full onClick={() => finish(false)}>
            Skip the recap — just complete
          </Button>
        )}
      </div>
    </>
  )
}
