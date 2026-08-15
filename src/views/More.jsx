import React, { useMemo, useRef, useState } from 'react'
import { useApp, campgroundVisits } from '../data/store.jsx'
import { navigate, back, Link } from '../lib/router.jsx'
import Icon, { Logo } from '../components/Icon.jsx'
import {
  Button, Card, Section, Sheet, ConfirmSheet, ListRow, EmptyState, Segmented, Toggle, Field, useToast,
} from '../components/ui.jsx'
import { RV_TYPES } from '../lib/geo.js'
import Stamp from '../components/Stamp.jsx'
import TripCard from '../components/TripCard.jsx'
import { createBackupFile, readBackupFile } from '../lib/backup.js'
import { NATIONAL_PARKS, PARK_BY_ID } from '../data/parks.js'
import { CATEGORY_BY_ID } from '../data/model.js'
import { stateName } from '../lib/states.js'
import { fmtDate } from '../lib/dates.js'

export default function More({ sub }) {
  if (sub === 'favorites') return <Favorites />
  if (sub === 'return-someday') return <ReturnSomeday />
  if (sub === 'search') return <Search />
  return <MoreHome />
}

function MoreHome() {
  const { state, actions } = useApp()
  const toast = useToast()
  const fileRef = useRef(null)
  const [restorePreview, setRestorePreview] = useState(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmRemoveSample, setConfirmRemoveSample] = useState(false)
  const [busy, setBusy] = useState(false)
  const hasSample = state.trips.some((t) => t.sample) || state.places.some((p) => p.sample)

  async function downloadBackup() {
    setBusy(true)
    try {
      const snapshot = await actions.snapshotForBackup()
      const { count } = await createBackupFile(snapshot)
      toast(`Backup saved — ${count} records tucked away`, { icon: 'download', duration: 4000 })
    } catch (err) {
      console.error(err)
      toast('The backup couldn’t be created.', { tone: 'danger' })
    }
    setBusy(false)
  }

  async function onRestoreFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const parsed = await readBackupFile(file)
      setRestorePreview(parsed)
    } catch (err) {
      toast(err.message, { tone: 'danger', duration: 5000 })
    }
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">More</h1>
      </div>

      <Section title="Your RV">
        <RVSection />
      </Section>

      <Section title="Collections">
        <ListRow icon="heart" title="Favorites" sub="Trips, campgrounds, places and parks you loved" href="#/more/favorites" right={<Icon name="chevronRight" size={16} />} />
        <ListRow icon="bookmark" title="Return Someday" sub="Your travel inspiration board" href="#/more/return-someday" right={<Icon name="chevronRight" size={16} />} />
        <ListRow icon="search" title="Search" sub="Find anything across Campkin" href="#/more/search" right={<Icon name="chevronRight" size={16} />} />
      </Section>

      <Section title="Keep your adventures safe">
        <Card>
          <div className="storage-note" style={{ marginBottom: 14 }}>
            <Icon name="info" size={16} />
            <span>
              Campkin lives entirely on this device — nothing is sent anywhere. A backup file keeps
              your trips, passport, and photos safe if this device is lost or its browser data is
              cleared.
            </span>
          </div>
          <div className="btn-row">
            <Button icon="download" full onClick={downloadBackup} disabled={busy}>
              {busy ? 'Preparing…' : 'Download Backup'}
            </Button>
            <Button variant="soft" icon="upload" full onClick={() => fileRef.current?.click()}>
              Restore Backup
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            tabIndex={-1}
            onChange={onRestoreFile}
            aria-label="Choose a Campkin backup file"
          />
        </Card>
      </Section>

      <Section title="Appearance">
        <Card>
          <Segmented
            options={[
              { id: 'auto', label: 'Match Device' },
              { id: 'light', label: 'Light' },
              { id: 'dark', label: 'Dark' },
            ]}
            value={state.settings.theme || 'auto'}
            onChange={(v) => actions.updateSettings({ theme: v })}
            ariaLabel="Theme"
          />
        </Card>
      </Section>

      <Section title="Sample data">
        {hasSample ? (
          <ListRow
            icon="trash"
            title="Remove sample data"
            sub="Clears the example trips, campgrounds and stamps"
            onClick={() => setConfirmRemoveSample(true)}
          />
        ) : (
          <ListRow
            icon="sparkle"
            title="Add sample data"
            sub="See Campkin with a few example adventures"
            onClick={() => {
              actions.loadSampleData()
              toast('Sample adventures added', { icon: 'sparkle' })
            }}
          />
        )}
      </Section>

      <Section title="">
        <ListRow
          icon="trash"
          title="Reset Campkin"
          sub="Erase everything on this device"
          onClick={() => setConfirmReset(true)}
        />
      </Section>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, margin: '34px 0 10px', color: 'var(--ink-faint)' }}>
        <Logo size={36} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, color: 'var(--ink-soft)' }}>Campkin</div>
        <div style={{ fontSize: 12.5 }}>Your companion for the road ahead.</div>
        <div style={{ fontSize: 11.5 }}>v{__APP_VERSION__}</div>
      </div>

      {/* restore preview + confirm */}
      <Sheet
        open={!!restorePreview}
        onClose={() => setRestorePreview(null)}
        title="Restore this backup?"
        footer={
          <div className="btn-row">
            <Button variant="soft" full onClick={() => setRestorePreview(null)}>
              Cancel
            </Button>
            <Button
              full
              icon="upload"
              onClick={async () => {
                try {
                  await actions.restoreAll(restorePreview.payload)
                  setRestorePreview(null)
                  toast('Backup restored — welcome back', { icon: 'check', duration: 4000 })
                  navigate('')
                } catch (err) {
                  console.error(err)
                  toast('Restore failed — your current data is untouched.', { tone: 'danger', duration: 5000 })
                }
              }}
            >
              Restore
            </Button>
          </div>
        }
      >
        {restorePreview && (
          <>
            <p className="confirm-message">
              This backup{restorePreview.summary.exportedAt ? ` from ${fmtDate(restorePreview.summary.exportedAt.slice(0, 10))}` : ''} contains:
            </p>
            <ul style={{ margin: '0 0 12px', paddingLeft: 22, color: 'var(--ink-soft)', lineHeight: 1.8 }}>
              <li>{restorePreview.summary.trips} trips</li>
              <li>{restorePreview.summary.campgrounds} campgrounds</li>
              <li>{restorePreview.summary.places} passport places</li>
              <li>{restorePreview.summary.photos} photos</li>
            </ul>
            <p className="confirm-message">
              Restoring <b>replaces everything currently in Campkin on this device</b>. If today’s
              data matters, download a backup of it first.
            </p>
          </>
        )}
      </Sheet>

      <ConfirmSheet
        open={confirmRemoveSample}
        onClose={() => setConfirmRemoveSample(false)}
        title="Remove sample data?"
        message="The example trips, campgrounds, places and stamps will be removed. Anything you added yourself stays."
        confirmLabel="Remove Samples"
        onConfirm={() => {
          actions.removeSampleData()
          toast('Sample data removed')
        }}
      />

      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase everything?"
        message="Every trip, campground, passport stamp and photo on this device will be permanently erased. If you might want any of it back, download a backup first."
        confirmLabel="Erase Everything"
        danger
        onConfirm={async () => {
          await actions.resetAll()
          toast('Campkin has been reset')
          navigate('')
        }}
      />
    </>
  )
}

/* ---- RV profile -------------------------------------------------------------- */

function RVSection() {
  const { state, actions } = useApp()
  const rv = state.settings.rv || {}
  const on = state.settings.rvMode
  const setRV = (patch) => actions.updateSettings({ rv: { ...rv, ...patch } })

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontWeight: 650 }}>RV Mode</div>
          <div style={{ fontSize: 13, color: 'var(--ink-faint)', marginTop: 1 }}>
            RV checklists, RV-pace drive times, and rig-size checks on the map
          </div>
        </div>
        <Toggle checked={on} onChange={(v) => actions.updateSettings({ rvMode: v })} label="RV Mode" />
      </div>

      {on && (
        <div className="fade-up" style={{ marginTop: 16 }}>
          <Field label="Type">
            <select className="select" value={rv.type || 'travel-trailer'} onChange={(e) => setRV({ type: e.target.value })}>
              {RV_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <div className="form-grid-2">
            <Field label="Length (ft)" hint="Total, bumper to hitch">
              <input
                className="input"
                inputMode="decimal"
                value={rv.lengthFt ?? ''}
                onChange={(e) => setRV({ lengthFt: e.target.value.replace(/[^\d.]/g, '') })}
                placeholder="32"
              />
            </Field>
            <Field label="Height (ft)" hint="For low-clearance awareness">
              <input
                className="input"
                inputMode="decimal"
                value={rv.heightFt ?? ''}
                onChange={(e) => setRV({ heightFt: e.target.value.replace(/[^\d.]/g, '') })}
                placeholder="11.5"
              />
            </Field>
          </div>
          <p className="field-hint" style={{ marginTop: 2 }}>
            Your rig’s length is checked against campground size limits on the Find Nearby map.
          </p>
        </div>
      )}
    </Card>
  )
}

/* ---- favorites -------------------------------------------------------------- */

function Favorites() {
  const { state } = useApp()
  const trips = state.trips.filter((t) => t.favorite)
  const cgs = state.campgrounds.filter((c) => c.favorite)
  const places = state.places.filter((p) => p.favorite)
  const parks = NATIONAL_PARKS.filter((p) => state.parks[p.id]?.favorite)
  const none = !trips.length && !cgs.length && !places.length && !parks.length

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('more')}>
        <Icon name="arrowLeft" size={16} /> More
      </button>
      <div className="page-head">
        <h1 className="page-title">Favorites</h1>
      </div>
      {none && (
        <EmptyState
          icon="heart"
          title="Nothing here yet"
          text="Tap the heart on trips, campgrounds, places, or parks to gather them here."
        />
      )}
      {trips.length > 0 && (
        <Section title="Trips">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {trips.map((t) => <TripCard key={t.id} trip={t} />)}
          </div>
        </Section>
      )}
      {cgs.length > 0 && (
        <Section title="Campgrounds">
          {cgs.map((c) => (
            <ListRow key={c.id} icon="tent" title={c.name} sub={c.location} href={`#/campground/${c.id}`} right={<Icon name="chevronRight" size={16} />} />
          ))}
        </Section>
      )}
      {places.length > 0 && (
        <Section title="Places">
          <div className="stamp-grid">
            {places.map((p) => <Stamp key={p.id} place={p} onClick={() => navigate('passport')} />)}
          </div>
        </Section>
      )}
      {parks.length > 0 && (
        <Section title="National Parks">
          {parks.map((p) => (
            <ListRow key={p.id} icon={p.motif} title={p.name} sub={p.states.map(stateName).join(', ')} onClick={() => navigate('passport/parks')} right={<Icon name="chevronRight" size={16} />} />
          ))}
        </Section>
      )}
    </>
  )
}

/* ---- return someday ---------------------------------------------------------- */

function ReturnSomeday() {
  const { state } = useApp()
  const cgs = state.campgrounds.filter((c) => c.returnSomeday)
  const places = state.places.filter((p) => p.returnSomeday)
  const parks = NATIONAL_PARKS.filter((p) => state.parks[p.id]?.status === 'want')
  const none = !cgs.length && !places.length && !parks.length

  const cards = [
    ...parks.map((p) => ({
      key: `park-${p.id}`,
      icon: p.motif,
      title: p.name,
      sub: p.states.map(stateName).join(', '),
      onClick: () => navigate('passport/parks'),
    })),
    ...cgs.map((c) => ({
      key: `cg-${c.id}`,
      icon: 'tent',
      title: c.name,
      sub: c.location || 'Campground',
      onClick: () => navigate(`campground/${c.id}`),
    })),
    ...places.map((p) => ({
      key: `pl-${p.id}`,
      icon: (CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other).icon,
      title: p.name,
      sub: [
        (CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other).label,
        p.state && stateName(p.state),
      ].filter(Boolean).join(' · '),
      onClick: () => navigate('passport'),
    })),
  ]

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('more')}>
        <Icon name="arrowLeft" size={16} /> More
      </button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Return Someday</h1>
          <p className="page-sub">Places calling you back</p>
        </div>
      </div>
      {none ? (
        <EmptyState
          icon="bookmark"
          title="Your someday list is empty"
          text="Mark campgrounds, parks, and places “Return Someday” and they gather here — a quiet promise to go back."
        />
      ) : (
        <div className="memory-grid">
          {cards.map((c) => (
            <button key={c.key} type="button" className="memory-tile card-tappable" onClick={c.onClick} style={{ textAlign: 'left', cursor: 'pointer' }}>
              <span className="row-icon" style={{ marginBottom: 8 }}>
                <Icon name={c.icon} size={19} />
              </span>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16.5, lineHeight: 1.2 }}>{c.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 3 }}>{c.sub}</div>
              <div style={{ fontSize: 11, color: 'var(--sand-deep)', fontWeight: 750, letterSpacing: '0.07em', textTransform: 'uppercase', marginTop: 8 }}>
                Return Someday
              </div>
            </button>
          ))}
        </div>
      )}
    </>
  )
}

/* ---- search ------------------------------------------------------------------- */

function Search() {
  const { state } = useApp()
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  const results = useMemo(() => {
    if (query.length < 2) return null
    const match = (s) => s && s.toLowerCase().includes(query)
    return {
      trips: state.trips.filter((t) => match(t.name) || match(t.destination)),
      campgrounds: state.campgrounds.filter((c) => match(c.name) || match(c.location)),
      places: state.places.filter((p) => match(p.name) || match(p.notes)),
      parks: NATIONAL_PARKS.filter((p) => match(p.name)),
    }
  }, [query, state])

  const total = results
    ? results.trips.length + results.campgrounds.length + results.places.length + results.parks.length
    : 0

  return (
    <>
      <button type="button" className="page-back" onClick={() => back('more')}>
        <Icon name="arrowLeft" size={16} /> More
      </button>
      <div className="page-head">
        <h1 className="page-title">Search</h1>
      </div>
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Icon name="search" size={17} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)' }} />
        <input
          className="input"
          style={{ paddingLeft: 38 }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Trips, campgrounds, places, parks…"
          autoFocus
          aria-label="Search Campkin"
        />
      </div>

      {results && total === 0 && (
        <EmptyState compact icon="search" title="No matches" text={`Nothing found for “${q.trim()}”.`} />
      )}

      {results?.trips.length > 0 && (
        <Section title="Trips">
          {results.trips.map((t) => (
            <ListRow key={t.id} icon="route" title={t.name} sub={t.destination} href={`#/trip/${t.id}`} right={<Icon name="chevronRight" size={16} />} />
          ))}
        </Section>
      )}
      {results?.campgrounds.length > 0 && (
        <Section title="Campgrounds">
          {results.campgrounds.map((c) => (
            <ListRow key={c.id} icon="tent" title={c.name} sub={c.location} href={`#/campground/${c.id}`} right={<Icon name="chevronRight" size={16} />} />
          ))}
        </Section>
      )}
      {results?.places.length > 0 && (
        <Section title="Places">
          {results.places.map((p) => (
            <ListRow
              key={p.id}
              icon={(CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other).icon}
              title={p.name}
              sub={[(CATEGORY_BY_ID[p.category] || CATEGORY_BY_ID.other).label, p.state].filter(Boolean).join(' · ')}
              onClick={() => navigate('passport')}
              right={<Icon name="chevronRight" size={16} />}
            />
          ))}
        </Section>
      )}
      {results?.parks.length > 0 && (
        <Section title="National Parks">
          {results.parks.map((p) => (
            <ListRow key={p.id} icon={p.motif} title={p.name} sub={p.states.map(stateName).join(', ')} onClick={() => navigate('passport/parks')} right={<Icon name="chevronRight" size={16} />} />
          ))}
        </Section>
      )}
    </>
  )
}
