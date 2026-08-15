import React, { useState } from 'react'
import { useApp, campgroundVisits } from '../data/store.jsx'
import { navigate } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, Card, Chips, EmptyState, Stars, useToast, Sheet, Field } from '../components/ui.jsx'
import { HOOKUP_TYPES } from '../data/model.js'
import { plural } from '../lib/util.js'

export default function Campgrounds() {
  const { state, actions } = useApp()
  const toast = useToast()
  const [filter, setFilter] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  let list = [...state.campgrounds].sort((a, b) => a.name.localeCompare(b.name))
  if (filter === 'favorites') list = list.filter((c) => c.favorite)
  if (filter === 'return') list = list.filter((c) => c.returnSomeday)

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Campgrounds</h1>
          {state.campgrounds.length > 0 && (
            <p className="page-sub">Your keepsake book of places you’ve stayed</p>
          )}
        </div>
        <Button icon="plus" small variant="soft" onClick={() => setAddOpen(true)}>
          Add
        </Button>
      </div>

      {state.campgrounds.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <Chips
            options={[
              { id: null, label: 'All', clearable: false },
              { id: 'favorites', label: 'Favorites', icon: 'heart' },
              { id: 'return', label: 'Return Someday', icon: 'bookmark' },
            ].filter((o) => o.id !== null)}
            value={filter}
            onChange={setFilter}
            ariaLabel="Filter campgrounds"
          />
        </div>
      )}

      {state.campgrounds.length === 0 ? (
        <EmptyState
          icon="tent"
          title="No campgrounds yet"
          text="Add a campground to a trip and it appears here — every stay collected in one book."
        >
          <Button variant="soft" onClick={() => navigate('trips')}>
            Go to Trips
          </Button>
        </EmptyState>
      ) : list.length === 0 ? (
        <EmptyState
          compact
          icon={filter === 'favorites' ? 'heart' : 'bookmark'}
          title={filter === 'favorites' ? 'No favorites yet' : 'Nothing saved yet'}
          text={
            filter === 'favorites'
              ? 'Tap the heart on a campground you loved.'
              : 'Mark campgrounds “Return Someday” to build your wish list.'
          }
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {list.map((cg) => (
            <CampgroundCard key={cg.id} cg={cg} />
          ))}
        </div>
      )}

      <AddCampgroundSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAdd={(fields) => {
          const cg = actions.addCampground(fields)
          toast('Campground added', { icon: 'check' })
          navigate(`campground/${cg.id}`)
        }}
      />
    </>
  )
}

function CampgroundCard({ cg }) {
  const { state } = useApp()
  const visits = campgroundVisits(state, cg.id)
  return (
    <Card as="button" className="card-tappable" onClick={() => navigate(`campground/${cg.id}`)} style={{ textAlign: 'left' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div className="trip-card-title" style={{ fontSize: 19 }}>{cg.name}</div>
          {cg.location && (
            <div style={{ fontSize: 13.5, color: 'var(--ink-faint)', marginTop: 1 }}>{cg.location}</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, color: 'var(--clay)' }}>
          {cg.sample && <span className="tag-sample">Sample</span>}
          {cg.favorite && <Icon name="heart" size={16} filled />}
          {cg.returnSomeday && <Icon name="bookmark" size={16} filled style={{ color: 'var(--sand-deep)' }} />}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {cg.rating > 0 && <Stars value={cg.rating} size={14} />}
        {visits.length > 0 && (
          <span style={{ fontSize: 13, color: 'var(--ink-faint)' }}>{plural(visits.length, 'stay')}</span>
        )}
        {cg.hookups && (
          <span className="badge" style={{ position: 'static' }}>{cg.hookups}</span>
        )}
      </div>
    </Card>
  )
}

function AddCampgroundSheet({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ name: '', location: '', hookups: '' })
  React.useEffect(() => {
    if (open) setForm({ name: '', location: '', hookups: '' })
  }, [open])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add a Campground"
      footer={
        <Button
          full
          onClick={() => {
            if (!form.name.trim()) return
            onAdd(form)
            onClose()
          }}
        >
          Add Campground
        </Button>
      }
    >
      <Field label="Name">
        <input className="input" value={form.name} onChange={set('name')} placeholder="Big Meadows Campground" data-autofocus />
      </Field>
      <Field label="Location">
        <input className="input" value={form.location} onChange={set('location')} placeholder="Shenandoah National Park, VA" />
      </Field>
      <Field label="Hookups">
        <Chips
          options={HOOKUP_TYPES.map((h) => ({ id: h, label: h }))}
          value={form.hookups}
          onChange={(v) => setForm((f) => ({ ...f, hookups: v || '' }))}
          ariaLabel="Hookups"
        />
      </Field>
    </Sheet>
  )
}
