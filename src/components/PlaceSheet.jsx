import React, { useEffect, useState } from 'react'
import { Sheet, Button, Field, Chips, useToast, ConfirmSheet } from './ui.jsx'
import { useApp } from '../data/store.jsx'
import { PLACE_CATEGORIES } from '../data/model.js'
import { STATES, parseStateFrom } from '../lib/states.js'
import { todayISO } from '../lib/dates.js'
import { geocodePlace } from '../lib/osm.js'

// Add / edit a place. Used from trips ("Things to do") and the Passport.
export default function PlaceSheet({ open, onClose, place, tripId, defaultVisited = true, defaultDay = null }) {
  const { actions } = useApp()
  const toast = useToast()
  const editing = !!place
  const [name, setName] = useState('')
  const [category, setCategory] = useState('other')
  const [stateAb, setStateAb] = useState('')
  const [date, setDate] = useState(todayISO())
  const [notes, setNotes] = useState('')
  const [visited, setVisited] = useState(defaultVisited)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(place?.name || '')
    setCategory(place?.category || 'other')
    setStateAb(place?.state || '')
    setDate(place?.dateVisited || todayISO())
    setNotes(place?.notes || '')
    setVisited(place ? place.visited : defaultVisited)
    setConfirmDelete(false)
  }, [open, place, defaultVisited])

  function submit(e) {
    e?.preventDefault()
    if (!name.trim()) {
      toast('Give the place a name.')
      return
    }
    const fields = {
      name: name.trim(),
      category,
      state: stateAb || parseStateFrom(name) || null,
      dateVisited: date,
      notes: notes.trim(),
      visited,
      tripId: place ? place.tripId : tripId || null,
    }
    if (!place && defaultDay) fields.day = defaultDay
    let saved
    if (editing) {
      saved = actions.updatePlace(place.id, fields)
      toast('Place updated', { icon: 'check' })
    } else {
      saved = actions.addPlace(fields)
      toast(visited ? 'Added to your passport' : 'Saved to the list', {
        icon: visited ? 'passport' : 'check',
      })
    }
    onClose()
    // Pin it on the trip map: geocode in the background if we don't have a
    // location yet (name + state is usually enough for a landmark or town).
    if (saved && saved.lat == null && (place ? place.name !== fields.name : true)) {
      const q = [fields.name, fields.state].filter(Boolean).join(', ')
      geocodePlace(q)
        .then((r) => r && actions.updatePlace(saved.id, { lat: r.lat, lon: r.lon }))
        .catch(() => {})
    }
  }

  const isDerived = place && place.source !== 'manual'

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title={editing ? 'Edit Place' : 'Add a Place'}
        footer={
          <div className="btn-row">
            {editing && !isDerived && (
              <Button variant="soft" icon="trash" onClick={() => setConfirmDelete(true)}>
                Remove
              </Button>
            )}
            <Button full onClick={submit}>
              {editing ? 'Save' : visited ? 'Add Place' : 'Save for Later'}
            </Button>
          </div>
        }
      >
        <form onSubmit={submit}>
          <Field label="Name">
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Skyline Drive"
              data-autofocus
              disabled={isDerived}
            />
          </Field>
          <Field label="Category">
            <Chips
              options={PLACE_CATEGORIES.map((c) => ({ id: c.id, label: c.label, clearable: false }))}
              value={category}
              onChange={(v) => v && setCategory(v)}
              ariaLabel="Category"
            />
          </Field>
          <div className="form-grid-2">
            <Field label="State">
              <select className="select" value={stateAb} onChange={(e) => setStateAb(e.target.value)}>
                <option value="">—</option>
                {STATES.map((s) => (
                  <option key={s.ab} value={s.ab}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={visited ? 'Date visited' : 'For trip on'}>
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Note">
            <textarea
              className="textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Worth the stop?"
              rows={2}
            />
          </Field>
          {!isDerived && (
            <Field label="Status">
              <div className="segmented" role="group" aria-label="Visited status">
                <button
                  type="button"
                  className={`segment ${visited ? 'is-active' : ''}`}
                  aria-pressed={visited}
                  onClick={() => setVisited(true)}
                >
                  Been here
                </button>
                <button
                  type="button"
                  className={`segment ${!visited ? 'is-active' : ''}`}
                  aria-pressed={!visited}
                  onClick={() => setVisited(false)}
                >
                  Want to go
                </button>
              </div>
            </Field>
          )}
        </form>
      </Sheet>

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Remove this place?"
        message={`“${place?.name}” will be removed from your passport and lists. This can’t be undone.`}
        confirmLabel="Remove Place"
        danger
        onConfirm={() => {
          actions.deletePlace(place.id)
          toast('Place removed')
          onClose()
        }}
      />
    </>
  )
}
