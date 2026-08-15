import React, { useRef, useState } from 'react'
import Icon from './Icon.jsx'
import { Sheet, Button, useToast } from './ui.jsx'
import { useApp, photosFor } from '../data/store.jsx'
import { usePhotoUrl } from '../lib/hooks.js'

function Thumb({ photo, onOpen }) {
  const url = usePhotoUrl(photo.id)
  return (
    <button type="button" className="photo-thumb" onClick={() => onOpen(photo)} aria-label="View photo">
      {url && <img src={url} alt="" />}
    </button>
  )
}

export default function PhotoStrip({ entityType, entityId, coverId, onSetCover }) {
  const { state, actions } = useApp()
  const toast = useToast()
  const inputRef = useRef(null)
  const [viewing, setViewing] = useState(null)
  const [busy, setBusy] = useState(false)
  const photos = photosFor(state, entityType, entityId)
  const viewingUrl = usePhotoUrl(viewing?.id)

  async function onFiles(e) {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (!files.length) return
    setBusy(true)
    let added = 0
    for (const file of files) {
      try {
        await actions.addPhoto(entityType, entityId, file)
        added++
      } catch (err) {
        console.error(err)
        toast(err.message || 'That photo couldn’t be added.', { tone: 'danger' })
      }
    }
    setBusy(false)
    if (added) toast(added === 1 ? 'Photo added' : `${added} photos added`, { icon: 'camera' })
  }

  return (
    <>
      <div className="photo-strip">
        {photos.map((p) => (
          <Thumb key={p.id} photo={p} onOpen={setViewing} />
        ))}
        <button
          type="button"
          className="photo-add"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
        >
          <Icon name="camera" size={20} />
          {busy ? 'Adding…' : 'Add photo'}
        </button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="visually-hidden"
        onChange={onFiles}
        aria-label="Add photos"
        tabIndex={-1}
      />

      <Sheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        title="Photo"
        footer={
          <div className="btn-row">
            {onSetCover && viewing && (
              <Button
                variant="soft"
                full
                icon="image"
                disabled={coverId === viewing.id}
                onClick={() => {
                  onSetCover(viewing.id)
                  toast('Cover photo set', { icon: 'check' })
                  setViewing(null)
                }}
              >
                {coverId === viewing.id ? 'Current cover' : 'Make cover'}
              </Button>
            )}
            <Button
              variant="danger"
              full
              icon="trash"
              onClick={() => {
                actions.deletePhoto(viewing.id)
                setViewing(null)
                toast('Photo removed')
              }}
            >
              Remove
            </Button>
          </div>
        }
      >
        <div className="lightbox">{viewingUrl && <img src={viewingUrl} alt="Trip photo" />}</div>
      </Sheet>
    </>
  )
}
