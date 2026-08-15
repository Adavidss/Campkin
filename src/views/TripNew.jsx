import React, { useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import { Button, Card, Field, useToast } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { todayISO } from '../lib/dates.js'

export default function TripNew() {
  const { actions } = useApp()
  const toast = useToast()
  const [name, setName] = useState('')
  const [destination, setDestination] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) {
      toast('Give the trip a name to get started.')
      return
    }
    let end = endDate
    if (startDate && (!end || end < startDate)) end = startDate
    const trip = actions.createTrip({ name, destination, startDate, endDate: end })
    toast('Trip created', { icon: 'check' })
    navigate(`trip/${trip.id}`, { replace: true })
  }

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('trips')}>
        <Icon name="arrowLeft" size={16} /> Trips
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Plan a Trip</h1>
          <p className="page-sub">Just the essentials — everything else can come later.</p>
        </div>
      </div>

      <Card as="form" onSubmit={submit}>
        <Field label="Trip name">
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Shenandoah Weekend"
            autoFocus
            required
          />
        </Field>
        <Field label="Destination">
          <input
            className="input"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="Shenandoah National Park, VA"
            autoComplete="off"
          />
        </Field>
        <div className="form-grid-2">
          <Field label="First night">
            <input
              className="input"
              type="date"
              value={startDate}
              min="2000-01-01"
              onChange={(e) => {
                setStartDate(e.target.value)
                if (endDate && endDate < e.target.value) setEndDate(e.target.value)
              }}
            />
          </Field>
          <Field label="Last day">
            <input
              className="input"
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </div>
        <Button type="submit" full icon="route" onClick={submit}>
          Create Trip
        </Button>
        <p className="field-hint" style={{ textAlign: 'center', marginTop: 10 }}>
          You can add the campground, checklist, and route from the trip page.
        </p>
      </Card>
    </>
  )
}
