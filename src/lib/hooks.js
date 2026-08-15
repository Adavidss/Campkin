import { useEffect, useRef, useState } from 'react'
import { useApp } from '../data/store.jsx'
import { cachedPhotoUrl } from './images.js'

// Effective map style: the user's explicit map choice, else the app theme.
export function useMapDark() {
  const { state } = useApp()
  const theme = state?.settings?.theme || 'auto'
  const mapDark = state?.settings?.mapDark
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => setSystemDark(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  if (mapDark != null) return mapDark
  return theme === 'dark' || (theme === 'auto' && systemDark)
}

// Resolve a stored photo id to a displayable object URL.
export function usePhotoUrl(photoId) {
  const { actions } = useApp()
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let live = true
    if (!photoId) {
      setUrl(null)
      return
    }
    actions.getPhotoBlob(photoId).then((blob) => {
      if (live && blob) setUrl(cachedPhotoUrl(photoId, blob))
    })
    return () => {
      live = false
    }
  }, [photoId, actions])
  return url
}

// Debounced autosave for free-text fields: local state updates instantly,
// persistence happens ~600ms after typing stops — and always on unmount.
export function useAutosaveText(initial, save) {
  const [value, setValue] = useState(initial ?? '')
  const [saved, setSaved] = useState(false)
  const saveRef = useRef(save)
  saveRef.current = save
  const valueRef = useRef(value)
  const pendingRef = useRef(false)
  const timerRef = useRef(null)

  const commit = () => {
    if (!pendingRef.current) return
    pendingRef.current = false
    saveRef.current(valueRef.current)
    setSaved(true)
    setTimeout(() => setSaved(false), 1600)
  }

  const onChange = (v) => {
    setValue(v)
    valueRef.current = v
    pendingRef.current = true
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(commit, 600)
  }

  useEffect(
    () => () => {
      clearTimeout(timerRef.current)
      if (pendingRef.current) saveRef.current(valueRef.current)
    },
    []
  )

  return { value, onChange, flush: commit, saved }
}
