import React, { useEffect } from 'react'
import { useApp } from './data/store.jsx'
import { useRoute, Link } from './lib/router.jsx'
import Icon, { Logo } from './components/Icon.jsx'
import { useToast } from './components/ui.jsx'
import Home from './views/Home.jsx'
import Trips from './views/Trips.jsx'
import TripNew from './views/TripNew.jsx'
import TripDetail from './views/TripDetail.jsx'
import Checklist from './views/Checklist.jsx'
import TripComplete from './views/TripComplete.jsx'
import Campgrounds from './views/Campgrounds.jsx'
import CampgroundDetail from './views/CampgroundDetail.jsx'
import Passport from './views/Passport.jsx'
import More from './views/More.jsx'

const NAV = [
  { id: '', label: 'Home', icon: 'home' },
  { id: 'trips', label: 'Trips', icon: 'signpost' },
  { id: 'passport', label: 'Passport', icon: 'passport' },
  { id: 'campgrounds', label: 'Campgrounds', icon: 'tent' },
  { id: 'more', label: 'More', icon: 'dots' },
]

function activeNav(p0) {
  if (!p0) return ''
  if (p0 === 'trip' || p0 === 'trips') return 'trips'
  if (p0 === 'campground' || p0 === 'campgrounds') return 'campgrounds'
  if (p0 === 'passport') return 'passport'
  return 'more'
}

function Router({ parts }) {
  const [p0, p1, p2] = parts
  if (!p0) return <Home />
  if (p0 === 'trips') return p1 === 'new' ? <TripNew /> : <Trips />
  if (p0 === 'trip' && p1) {
    if (p2 === 'checklist') return <Checklist tripId={p1} focusCat={parts[3]} />
    if (p2 === 'complete') return <TripComplete tripId={p1} />
    return <TripDetail tripId={p1} />
  }
  if (p0 === 'campgrounds') return <Campgrounds />
  if (p0 === 'campground' && p1) return <CampgroundDetail campgroundId={p1} />
  if (p0 === 'passport') return <Passport tab={p1 || 'stamps'} />
  if (p0 === 'more') return <More sub={p1} />
  return <Home />
}

export default function App() {
  const { state } = useApp()
  const { parts } = useRoute()
  const toast = useToast()
  const active = activeNav(parts[0])

  // Surface rare storage failures instead of losing data silently.
  useEffect(() => {
    const onErr = () =>
      toast('Campkin couldn’t save that change. Storage may be full — download a backup.', {
        tone: 'danger',
        duration: 6000,
      })
    window.addEventListener('campkin:storage-error', onErr)
    return () => window.removeEventListener('campkin:storage-error', onErr)
  }, [toast])

  // Theme: auto follows the system, or an explicit choice from Settings.
  const theme = state?.settings?.theme || 'auto'
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'auto' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.content = dark ? '#191d1a' : '#F7F3EA'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  if (!state) {
    return (
      <div className="splash">
        <Logo size={56} />
        <div className="splash-word">Campkin</div>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="splash">
        <Logo size={56} />
        <div className="splash-word">Campkin</div>
        <p style={{ maxWidth: 320, textAlign: 'center' }}>
          Campkin couldn’t open its storage on this device ({state.error}). Try closing other
          Campkin tabs, or check that private browsing isn’t blocking storage.
        </p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="top-bar">
        <Link to="" className="top-brand">
          <Logo size={30} />
          Campkin
        </Link>
        <nav className="top-links" aria-label="Primary">
          {NAV.map((n) => (
            <Link key={n.id} to={n.id} className={`top-link ${active === n.id ? 'is-active' : ''}`}>
              <Icon name={n.icon} size={17} />
              {n.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="page" key={parts.join('/') || 'home'}>
        <Router parts={parts} />
      </main>

      <nav className="bottom-nav" aria-label="Primary">
        {NAV.map((n) => (
          <Link
            key={n.id}
            to={n.id}
            className={`nav-item ${active === n.id ? 'is-active' : ''}`}
            aria-current={active === n.id ? 'page' : undefined}
          >
            <Icon name={n.icon} size={22} strokeWidth={active === n.id ? 2 : 1.6} />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
