import React, { useState } from 'react'
import { useApp, campgroundVisits } from '../data/store.jsx'
import { navigate, back, Link } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import {
  Button, IconBtn, Card, Section, Field, Chips, Sheet, ConfirmSheet, Stars, ListRow,
  EmptyState, useToast,
} from '../components/ui.jsx'
import PhotoStrip from '../components/PhotoStrip.jsx'
import { fmtRange } from '../lib/dates.js'
import { appleMapsDirections, googleMapsDirections, telHref, normalizeUrl } from '../lib/maps.js'
import { useAutosaveText } from '../lib/hooks.js'
import { HOOKUP_TYPES } from '../data/model.js'

export default function CampgroundDetail({ campgroundId }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const cg = state.campgrounds.find((c) => c.id === campgroundId)
  const [editOpen, setEditOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!cg) {
    return (
      <EmptyState icon="tent" title="Campground not found" text="It may have been removed.">
        <Button variant="soft" onClick={() => navigate('campgrounds')}>Back to Campgrounds</Button>
      </EmptyState>
    )
  }

  const visits = campgroundVisits(state, cg.id)
  const remembers = visits
    .filter((t) => t.rememberNextTime)
    .map((t) => ({ tripId: t.id, text: t.rememberNextTime, when: fmtRange(t.startDate, t.endDate) }))
  const dest = cg.address || `${cg.name}${cg.location ? ', ' + cg.location : ''}`

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('campgrounds')}>
        <Icon name="arrowLeft" size={16} /> Campgrounds
      </button>

      <div className="detail-head">
        <div className="detail-title-row">
          <h1 className="detail-title">{cg.name}</h1>
          <div className="detail-actions">
            <IconBtn name="dots" label="Campground options" onClick={() => setMenuOpen(true)} />
          </div>
        </div>
        <div className="detail-meta">
          {cg.location && <span>{cg.location}</span>}
          {cg.hookups && <span>{cg.hookups}</span>}
          {cg.sample && <span className="tag-sample">Sample</span>}
        </div>
      </div>

      <Card style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <Stars value={cg.rating} onChange={(v) => actions.updateCampground(cg.id, { rating: v })} size={24} label={`Rating for ${cg.name}`} />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant={cg.favorite ? 'solid' : 'soft'}
              small
              icon="heart"
              onClick={() => actions.updateCampground(cg.id, { favorite: !cg.favorite })}
              aria-pressed={cg.favorite}
            >
              {cg.favorite ? 'Favorite' : 'Favorite'}
            </Button>
            <Button
              variant={cg.returnSomeday ? 'solid' : 'soft'}
              small
              icon="bookmark"
              onClick={() => actions.updateCampground(cg.id, { returnSomeday: !cg.returnSomeday })}
              aria-pressed={cg.returnSomeday}
            >
              Return Someday
            </Button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Button variant="soft" small icon="map" href={appleMapsDirections(dest)} target="_blank" rel="noopener">
            Directions
          </Button>
          {cg.phone && (
            <Button variant="soft" small icon="phone" href={telHref(cg.phone)}>
              Call
            </Button>
          )}
          {cg.website && (
            <Button variant="soft" small icon="globe" href={normalizeUrl(cg.website)} target="_blank" rel="noopener">
              Website
            </Button>
          )}
          <Button variant="ghost" small icon="pencil" onClick={() => setEditOpen(true)}>
            Edit
          </Button>
        </div>
      </Card>

      <Section title="Stays">
        {visits.length === 0 ? (
          <EmptyState compact icon="calendar" title="No stays recorded" text="Link this campground to a trip and stays appear here." />
        ) : (
          visits.map((t) => (
            <ListRow
              key={t.id}
              icon="calendar"
              className="row-wrap"
              title={fmtRange(t.startDate, t.endDate)}
              sub={[t.siteNumber && `Site ${t.siteNumber}`, t.name].filter(Boolean).join(' · ')}
              href={`#/trip/${t.id}`}
              right={
                <>
                  {t.rating > 0 && <Stars value={t.rating} size={12} />}
                  <Icon name="chevronRight" size={16} />
                </>
              }
            />
          ))
        )}
      </Section>

      {remembers.length > 0 && (
        <Section title="Remember next time">
          {remembers.map((r) => (
            <div key={r.tripId} className="memory-tile remember-card" style={{ marginBottom: 8 }}>
              <div className="memory-value">{r.text}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 5 }}>{r.when}</div>
            </div>
          ))}
        </Section>
      )}

      <Section title="Notes">
        <NotesCard cg={cg} />
      </Section>

      <Section title="Photos">
        <PhotoStrip entityType="campground" entityId={cg.id} />
      </Section>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Campground options">
        <ListRow icon="pencil" title="Edit details" onClick={() => { setMenuOpen(false); setEditOpen(true) }} />
        <ListRow
          icon="trash"
          title="Delete campground"
          sub="Removes it from your book and passport"
          onClick={() => { setMenuOpen(false); setConfirmDelete(true) }}
        />
      </Sheet>

      <EditSheet cg={cg} open={editOpen} onClose={() => setEditOpen(false)} />

      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this campground?"
        message={`“${cg.name}” will be removed from your campground book and passport. Trips that stayed here keep their own details.`}
        confirmLabel="Delete Campground"
        danger
        onConfirm={() => {
          actions.deleteCampground(cg.id)
          toast('Campground deleted')
          navigate('campgrounds', { replace: true })
        }}
      />
    </>
  )
}

function NotesCard({ cg }) {
  const { actions } = useApp()
  const { value, onChange, saved } = useAutosaveText(cg.notes, (v) =>
    actions.updateCampground(cg.id, { notes: v })
  )
  return (
    <Card>
      <textarea
        className="notes-area"
        style={{ minHeight: 70 }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Favorite loop, best sites, the things worth knowing…"
        aria-label="Campground notes"
      />
      <div className="save-hint" style={{ opacity: saved ? 1 : 0 }}>
        <Icon name="check" size={12} /> Saved
      </div>
    </Card>
  )
}

function EditSheet({ cg, open, onClose }) {
  const { actions } = useApp()
  const [form, setForm] = useState({})
  React.useEffect(() => {
    if (open)
      setForm({
        name: cg.name,
        location: cg.location,
        address: cg.address,
        phone: cg.phone,
        website: cg.website,
        hookups: cg.hookups,
      })
  }, [open, cg])
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Edit campground"
      footer={
        <Button
          full
          onClick={() => {
            if (!form.name?.trim()) return
            actions.updateCampground(cg.id, { ...form, name: form.name.trim() })
            onClose()
          }}
        >
          Save
        </Button>
      }
    >
      <Field label="Name">
        <input className="input" value={form.name || ''} onChange={set('name')} data-autofocus />
      </Field>
      <Field label="Location">
        <input className="input" value={form.location || ''} onChange={set('location')} placeholder="Shenandoah National Park, VA" />
      </Field>
      <Field label="Address">
        <input className="input" value={form.address || ''} onChange={set('address')} />
      </Field>
      <Field label="Hookups">
        <Chips
          options={HOOKUP_TYPES.map((h) => ({ id: h, label: h }))}
          value={form.hookups}
          onChange={(v) => setForm((f) => ({ ...f, hookups: v || '' }))}
          ariaLabel="Hookups"
        />
      </Field>
      <div className="form-grid-2">
        <Field label="Phone">
          <input className="input" type="tel" value={form.phone || ''} onChange={set('phone')} />
        </Field>
        <Field label="Website">
          <input className="input" inputMode="url" value={form.website || ''} onChange={set('website')} />
        </Field>
      </div>
    </Sheet>
  )
}
