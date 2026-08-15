import React, { useEffect, useState } from 'react'
import Icon, { Logo } from './Icon.jsx'
import { Button, useToast } from './ui.jsx'
import { useApp, coverPhotoOf } from '../data/store.jsx'
import { usePhotoUrl } from '../lib/hooks.js'
import { wikiSummary } from '../lib/wiki.js'
import { renderPostcard, sharePostcard } from '../lib/postcard.js'
import { fmtRange } from '../lib/dates.js'

// A live postcard preview of the trip + one tap to share it as an image.
// Uses your own cover photo if you've added one, else the destination's
// Wikipedia photo, else a pine gradient.
export default function Postcard({ trip, cg, places, compact = false }) {
  const { state } = useApp()
  const toast = useToast()
  const cover = coverPhotoOf(state, trip)
  const coverUrl = usePhotoUrl(cover?.id)
  const [wikiPhoto, setWikiPhoto] = useState(null)
  const [busy, setBusy] = useState(false)
  const rvMode = state.settings.rvMode

  useEffect(() => {
    let live = true
    setWikiPhoto(null)
    const name = trip.destination?.split(',')[0]?.trim()
    if (!name) return
    wikiSummary({ name, state: trip.destination.split(',').slice(1).join(',').trim() })
      .then((d) => live && d?.thumb && setWikiPhoto(d.thumb))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [trip.destination])

  const photo = coverUrl || wikiPhoto
  const stops = places.filter((p) => p.category !== 'campground').slice(0, 3).map((p) => p.name)

  async function share() {
    setBusy(true)
    try {
      const blob = await renderPostcard({ trip, cg, places, photoUrl: photo, rvMode })
      const res = await sharePostcard(blob, `${trip.name.replace(/[^\w]+/g, '-')}-postcard.png`, trip.name)
      if (res === 'shared') toast('Postcard sent ✦', { icon: 'check' })
      else if (res === 'downloaded') toast('Postcard saved to your downloads', { icon: 'download' })
    } catch (err) {
      console.error(err)
      toast('Couldn’t make the postcard right now.', { tone: 'danger' })
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="postcard" style={compact ? { aspectRatio: '2 / 1' } : undefined}>
        {photo && <img src={photo} alt="" className="postcard-photo" crossOrigin="anonymous" />}
        <div className="postcard-scrim" />
        <div className="postcard-brand">
          <Logo size={18} /> Campkin
        </div>
        <div className="postcard-stamp">
          <span>{rvMode ? 'RV TRIP' : 'CAMPING'}</span>
          <span style={{ fontSize: 10, letterSpacing: '0.06em' }}>{(trip.startDate || '').slice(0, 4) || 'SOON'}</span>
        </div>
        <div className="postcard-body">
          <div className="postcard-eyebrow">{trip.completed ? 'A trip to remember' : 'Coming up'}</div>
          <div className="postcard-title">{trip.name}</div>
          <div className="postcard-meta">{[trip.destination, fmtRange(trip.startDate, trip.endDate)].filter(Boolean).join(' · ')}</div>
          {(cg || stops.length > 0) && !compact && (
            <div className="postcard-stops">
              {cg && <div>⛺ {cg.name}{trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}</div>}
              {stops.length > 0 && <div>{stops.join(' · ')}</div>}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
        <Button small icon="share" onClick={share} disabled={busy}>
          {busy ? 'Making postcard…' : 'Share postcard'}
        </Button>
        <span style={{ fontSize: 12, color: 'var(--ink-faint)', alignSelf: 'center' }}>
          {coverUrl ? 'Using your cover photo' : wikiPhoto ? 'Photo via Wikipedia' : 'Add a photo to the trip to feature it'}
        </span>
      </div>
    </div>
  )
}
