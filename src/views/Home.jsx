import React, { useMemo } from 'react'
import { useApp, tripsByStatus, passportCounts, coverPhotoOf } from '../data/store.jsx'
import { navigate, Link } from '../lib/router.jsx'
import { fmtRange, countdownLabel, daysUntil, fmtDate } from '../lib/dates.js'
import { appleMapsDirections, telHref } from '../lib/maps.js'
import Icon, { Logo } from '../components/Icon.jsx'
import { Button, Section, Stars, useToast } from '../components/ui.jsx'
import Stamp from '../components/Stamp.jsx'
import { usePhotoUrl } from '../lib/hooks.js'
import { plural } from '../lib/util.js'
import { saveBackupToDevice } from '../lib/backup.js'
import CountdownWidget from '../components/CountdownWidget.jsx'

export default function Home() {
  const { state, actions } = useApp()
  const { current, upcoming, past } = tripsByStatus(state.trips)
  const counts = passportCounts(state)
  const isEmpty = state.trips.length === 0 && state.places.length === 0

  if (isEmpty) return <FirstRun onSample={() => actions.loadSampleData()} />

  const hero = current[0] || upcoming[0] || past[0]
  const heroKind = current[0] ? 'current' : upcoming[0] ? 'upcoming' : 'past'
  const recentStamps = [...state.places]
    .filter((p) => p.visited)
    .sort((a, b) => ((a.dateVisited || '') > (b.dateVisited || '') ? -1 : 1))
    .slice(0, 4)

  return (
    <>
      <div className="home-brand">
        <Logo size={40} />
        <div>
          <h1>Campkin</h1>
          <div className="brand-sub">Your companion for the road ahead.</div>
        </div>
      </div>

      {heroKind === 'upcoming' && hero.startDate ? (
        <CountdownWidget trip={hero} />
      ) : (
        hero && <HeroCard trip={hero} kind={heroKind} />
      )}
      {/* If a trip is happening now, still show the countdown to the one after it. */}
      {heroKind === 'current' && upcoming[0]?.startDate && (
        <div style={{ marginTop: 10 }}>
          <CountdownWidget trip={upcoming[0]} />
        </div>
      )}

      <BackupNudge />

      <div className="quick-actions">
        <QuickAction icon="pin" label="Quick Trip" to="trips/quick" />
        <QuickAction icon="plus" label="Plan a Trip" to="trips/new" />
        <QuickAction icon="passport" label="Passport" to="passport" />
      </div>

      <div className="stat-line">
        <span><b>{counts.places}</b> {counts.places === 1 ? 'place' : 'places'}</span>
        <span><b>{state.trips.length}</b> {state.trips.length === 1 ? 'trip' : 'trips'}</span>
        <span><b>{counts.campgrounds}</b> {counts.campgrounds === 1 ? 'campground' : 'campgrounds'}</span>
        <span><b>{counts.states}</b> {counts.states === 1 ? 'state' : 'states'}</span>
      </div>

      {recentStamps.length > 0 && (
        <Section
          title="From your passport"
          action={
            <Link to="passport" className="btn btn-ghost btn-small">
              View all
            </Link>
          }
        >
          <div className="stamp-grid">
            {recentStamps.map((p) => (
              <Stamp key={p.id} place={p} onClick={() => navigate('passport')} />
            ))}
          </div>
        </Section>
      )}

      {past.length > 0 && <TakeMeBack past={past} />}
    </>
  )
}

// A quiet reminder once enough has changed since the last saved backup —
// the whole app lives on-device, so this is the safety net.
function BackupNudge() {
  const { state, actions } = useApp()
  const toast = useToast()
  const [busy, setBusy] = React.useState(false)
  const pending = state.settings.changesSinceBackup || 0
  const last = state.settings.lastBackupAt
  const daysSince = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null
  const due = pending >= 8 || (pending > 0 && (daysSince == null || daysSince >= 14))
  if (!due) return null

  async function save() {
    setBusy(true)
    try {
      const { via } = await saveBackupToDevice(await actions.snapshotForBackup())
      if (via !== 'cancelled') {
        actions.markBackedUp()
        toast(via === 'share' ? 'Choose Save to Files to keep it on your phone' : 'Backup saved', {
          icon: 'check',
          duration: 4500,
        })
      }
    } catch (err) {
      toast('The backup couldn’t be created.', { tone: 'danger' })
    }
    setBusy(false)
  }

  return (
    <div className="backup-nudge">
      <Icon name="download" size={17} />
      <span style={{ flex: 1 }}>
        {last
          ? `${pending} ${pending === 1 ? 'change' : 'changes'} since your last backup — save a copy to your phone.`
          : 'Your trips live only on this device. Save a backup to your phone’s Files.'}
      </span>
      <Button small onClick={save} disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </Button>
    </div>
  )
}

function FirstRun({ onSample }) {
  return (
    <div className="splash" style={{ minHeight: '70dvh' }}>
      <Logo size={72} />
      <h1 style={{ fontSize: 34 }}>Campkin</h1>
      <p style={{ color: 'var(--ink-soft)', marginTop: -6 }}>Your companion for the road ahead.</p>
      <p style={{ color: 'var(--ink-faint)', fontSize: 14.5, marginTop: 10 }}>
        Your next adventure starts here.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14, width: 260 }}>
        <Button icon="plus" full onClick={() => navigate('trips/new')}>
          Plan Your First Trip
        </Button>
        <Button variant="ghost" full onClick={onSample}>
          Explore with sample data
        </Button>
      </div>
    </div>
  )
}

function QuickAction({ icon, label, to }) {
  return (
    <Link to={to} className="quick-action">
      <span className="qa-icon">
        <Icon name={icon} size={22} />
      </span>
      {label}
    </Link>
  )
}

function HeroCard({ trip, kind }) {
  const { state } = useApp()
  const cover = coverPhotoOf(state, trip)
  const coverUrl = usePhotoUrl(cover?.id)
  const cg = state.campgrounds.find((c) => c.id === trip.campgroundId)

  const eyebrow =
    kind === 'current' ? (
      <>Happening now</>
    ) : kind === 'upcoming' ? (
      <>
        {trip.startDate && daysUntil(trip.startDate) >= 0
          ? countdownLabel(trip.startDate)
          : 'Coming up'}
      </>
    ) : (
      <>Most recent trip</>
    )

  return (
    <div className={`hero-card ${coverUrl ? 'has-photo' : ''}`}>
      {coverUrl && <img src={coverUrl} alt="" className="hero-photo" />}
      <div className="hero-inner">
        <div className="hero-eyebrow">
          <Icon name={kind === 'current' ? 'tent' : kind === 'upcoming' ? 'route' : 'book'} size={13} />
          {eyebrow}
        </div>
        <div className="hero-title">{trip.name}</div>
        <div className="hero-meta">
          {trip.destination && <span>{trip.destination}</span>}
          <span>{fmtRange(trip.startDate, trip.endDate)}</span>
        </div>
        {kind === 'current' && cg && (
          <div className="hero-meta" style={{ marginTop: 10 }}>
            <span>
              {cg.name}
              {trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}
            </span>
          </div>
        )}
        {kind === 'past' && trip.rating > 0 && (
          <div style={{ marginTop: 8 }}>
            <Stars value={trip.rating} size={15} />
          </div>
        )}
        <div className="hero-actions">
          <Button variant="soft" small onClick={() => navigate(`trip/${trip.id}`)}>
            {kind === 'past' ? 'Revisit trip' : 'Open trip'}
          </Button>
          {kind === 'current' && cg && (cg.address || cg.name) && (
            <Button
              variant="soft"
              small
              icon="map"
              href={appleMapsDirections(cg.address || `${cg.name}, ${cg.location}`)}
              target="_blank"
              rel="noopener"
            >
              Directions
            </Button>
          )}
          {kind === 'current' && cg?.phone && (
            <Button variant="soft" small icon="phone" href={telHref(cg.phone)}>
              Call
            </Button>
          )}
          {kind === 'upcoming' && <ChecklistPeek trip={trip} />}
        </div>
      </div>
    </div>
  )
}

function ChecklistPeek({ trip }) {
  const total = trip.checklist.length
  const done = trip.checklist.filter((i) => i.done).length
  if (!total) return null
  return (
    <Button variant="soft" small icon="list" onClick={() => navigate(`trip/${trip.id}/checklist`)}>
      Packing {done}/{total}
    </Button>
  )
}

function TakeMeBack({ past }) {
  const pick = useMemo(() => past[Math.floor(Math.random() * past.length)], [past.length])
  if (!pick) return null
  return (
    <Section title="">
      <button
        type="button"
        className="card card-tappable"
        onClick={() => {
          const t = past[Math.floor(Math.random() * past.length)]
          navigate(`trip/${t.id}`)
        }}
        style={{ display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <span className="row-icon" style={{ background: 'var(--pine-soft)' }}>
          <Icon name="sparkle" size={20} />
        </span>
        <span className="row-main">
          <span className="row-title">Take me back</span>
          <span className="row-sub">
            Reopen a memory — like {pick.name}, {fmtDate(pick.endDate || pick.startDate)}
          </span>
        </span>
        <Icon name="chevronRight" size={18} style={{ color: 'var(--ink-faint)' }} />
      </button>
    </Section>
  )
}
