import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { Sheet, Button, ListRow, useToast } from './ui.jsx'
import { tripToShareable, tripToText, tripShareLink, shareText } from '../lib/share.js'

// "Share this trip" — as a message, a link, or a copied plan.
export default function ShareSheet({ open, onClose, trip, cg, places }) {
  const toast = useToast()
  const [link, setLink] = useState(null)
  const [preview, setPreview] = useState('')

  useEffect(() => {
    if (!open || !trip) return
    const shareable = tripToShareable(trip, cg, places)
    setPreview(tripToText(shareable))
    setLink(null)
    tripShareLink(shareable).then(setLink).catch(() => setLink(null))
  }, [open, trip, cg, places])

  if (!trip) return null
  const shareable = tripToShareable(trip, cg, places)

  async function doShare(mode) {
    const text = tripToText(shareable, { link: mode === 'text-only' ? null : link })
    const res = await shareText({
      title: trip.name,
      text: mode === 'link' ? `${trip.name} — open the full plan in Campkin` : text,
      url: mode === 'text-only' ? null : link,
    })
    if (res === 'shared') toast('Shared', { icon: 'check' })
    else if (res === 'copied') toast('Copied — paste it anywhere', { icon: 'check' })
    if (res !== 'cancelled') onClose()
  }

  return (
    <Sheet open={open} onClose={onClose} title="Share this trip" wide>
      <ListRow
        icon="note"
        title="Send the plan as a message"
        sub="Dates, campground, day-by-day — reads well in iMessage or email, plus a link to open it in Campkin"
        onClick={() => doShare('full')}
        right={<Icon name="chevronRight" size={16} />}
      />
      <ListRow
        icon="external"
        title="Send just the link"
        sub={link ? 'Anyone can open it — no app or account needed' : 'Preparing link…'}
        onClick={() => link && doShare('link')}
        right={<Icon name="chevronRight" size={16} />}
      />
      <ListRow
        icon="pencil"
        title="Copy the plain text"
        sub="No link — for notes, a printout, or a group thread"
        onClick={async () => {
          await navigator.clipboard.writeText(tripToText(shareable))
          toast('Plan copied', { icon: 'check' })
          onClose()
        }}
        right={<Icon name="chevronRight" size={16} />}
      />
      <div className="share-preview">
        <div className="memory-label" style={{ marginBottom: 6 }}>Preview</div>
        <pre className="share-pre">{preview}</pre>
      </div>
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 10, lineHeight: 1.5 }}>
        The link carries the trip itself — nothing is uploaded anywhere. Whoever opens it can save a
        copy into their own Campkin.
      </p>
    </Sheet>
  )
}
