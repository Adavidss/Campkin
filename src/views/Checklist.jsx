import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { navigate, back } from '../lib/router.jsx'
import Icon from '../components/Icon.jsx'
import { Button, IconBtn, Sheet, ConfirmSheet, ListRow, ProgressBar, EmptyState, useToast } from '../components/ui.jsx'
import { CHECKLIST_CATEGORIES } from '../data/checklists.js'
import { cx } from '../lib/util.js'

export default function Checklist({ tripId, focusCat }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const trip = state.trips.find((t) => t.id === tripId)
  const [editMode, setEditMode] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const groupRefs = useRef({})

  useEffect(() => {
    if (focusCat && groupRefs.current[focusCat]) {
      setTimeout(() => groupRefs.current[focusCat]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120)
    }
  }, [focusCat])

  if (!trip) {
    return (
      <EmptyState icon="list" title="Trip not found">
        <Button variant="soft" onClick={() => navigate('trips')}>Back to Trips</Button>
      </EmptyState>
    )
  }

  const items = trip.checklist
  const total = items.length
  const done = items.filter((i) => i.done).length
  const cats = CHECKLIST_CATEGORIES.filter((c) => items.some((i) => i.cat === c))
  const extraCats = [...new Set(items.map((i) => i.cat))].filter((c) => !CHECKLIST_CATEGORIES.includes(c))

  return (
    <>
      <button type="button" className="page-back" onClick={() => back(`trip/${trip.id}`)}>
        <Icon name="arrowLeft" size={16} /> {trip.name}
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Checklist</h1>
          <p className="page-sub">
            {done} of {total} checked
          </p>
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <IconBtn
            name="pencil"
            label={editMode ? 'Done editing' : 'Edit items'}
            active={editMode}
            filled={false}
            onClick={() => setEditMode((v) => !v)}
          />
          <IconBtn name="dots" label="Checklist options" onClick={() => setMenuOpen(true)} />
        </div>
      </div>

      <ProgressBar value={done} max={total} />

      {[...cats, ...extraCats].map((cat) => (
        <Group
          key={cat}
          cat={cat}
          items={items.filter((i) => i.cat === cat)}
          tripId={trip.id}
          editMode={editMode}
          highlight={focusCat === cat}
          refFn={(el) => (groupRefs.current[cat] = el)}
        />
      ))}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Checklist options">
        <ListRow
          icon="refresh"
          title="Uncheck everything"
          sub="Start the list fresh — items stay"
          onClick={() => {
            setMenuOpen(false)
            setConfirmReset(true)
          }}
        />
        <ListRow
          icon="list"
          title="Restore default items"
          sub="Bring back any default items you removed"
          onClick={() => {
            actions.restoreDefaultChecklist(trip.id)
            setMenuOpen(false)
            toast('Default items restored', { icon: 'check' })
          }}
        />
      </Sheet>

      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Uncheck everything?"
        message="Every item will be unchecked so you can run the list again. Nothing is removed."
        confirmLabel="Uncheck All"
        onConfirm={() => {
          actions.resetChecklist(trip.id)
          toast('Checklist reset')
        }}
      />
    </>
  )
}

function Group({ cat, items, tripId, editMode, highlight, refFn }) {
  const { actions } = useApp()
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [keep, setKeep] = useState(false)
  const done = items.filter((i) => i.done).length

  function add(e) {
    e?.preventDefault()
    if (!label.trim()) return
    actions.addChecklistItem(tripId, cat, label, keep)
    setLabel('')
  }

  return (
    <div className="check-group" ref={refFn}>
      <div className="check-group-head">
        <h2 className="check-group-title" style={highlight ? { color: 'var(--pine)' } : undefined}>
          {cat}
        </h2>
        <span className="check-group-count">
          {done}/{items.length}
        </span>
      </div>
      <div className="check-items">
        {items.map((item) => (
          <div key={item.id} style={{ display: 'flex', alignItems: 'stretch' }}>
            <button
              type="button"
              className={cx('check-item', item.done && 'is-done')}
              onClick={() => actions.toggleChecklistItem(tripId, item.id)}
              aria-pressed={item.done}
              style={{ flex: 1 }}
            >
              <span className="check-box">
                <Icon name="check" size={14} strokeWidth={2.4} />
              </span>
              <span className="check-label">{item.label}</span>
              {item.custom && !editMode && (
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', fontWeight: 700, letterSpacing: '0.06em' }}>
                  ADDED
                </span>
              )}
            </button>
            {editMode && (
              <button
                type="button"
                className="icon-btn check-remove"
                style={{ alignSelf: 'center', marginRight: 6 }}
                aria-label={`Remove ${item.label}`}
                onClick={() => actions.removeChecklistItem(tripId, item.id)}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        ))}
        {adding ? (
          <form className="check-add" onSubmit={add}>
            <input
              className="input"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={`Add to ${cat}…`}
              autoFocus
              onBlur={() => {
                if (!label.trim()) setAdding(false)
              }}
            />
            <button
              type="button"
              className={cx('chip', keep && 'is-active')}
              onClick={() => setKeep((v) => !v)}
              aria-pressed={keep}
              title="Also add to every future trip"
            >
              Keep
            </button>
            <Button small type="submit" onClick={add}>
              Add
            </Button>
          </form>
        ) : (
          <button type="button" className="check-item" onClick={() => setAdding(true)}>
            <span className="check-box" style={{ border: '1.8px dashed var(--line-strong)' }}>
              <Icon name="plus" size={13} strokeWidth={2} style={{ color: 'var(--ink-faint)' }} />
            </span>
            <span className="check-label" style={{ color: 'var(--ink-faint)' }}>
              Add item
            </span>
          </button>
        )}
      </div>
    </div>
  )
}
