// Client-side photo handling: photos are resized and compressed before they
// ever touch IndexedDB, so a phone camera roll doesn't fill browser storage.

const MAX_DIM = 1600
const QUALITY = 0.82

export async function compressImage(file) {
  const bitmap = await loadImage(file)
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, w, h)
  if (bitmap.close) bitmap.close()
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
  if (!blob) throw new Error('This image couldn’t be processed.')
  return { blob, width: w, height: h }
}

async function loadImage(file) {
  // createImageBitmap is fastest, but fall back to <img> decoding (which also
  // covers formats like HEIC on iOS Safari).
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file)
    } catch {
      /* fall through */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This image couldn’t be read.'))
    }
    img.src = url
  })
}

// Object-URL cache so photo blobs render without re-reading IndexedDB.
const urlCache = new Map()

export function cachedPhotoUrl(id, blob) {
  if (!urlCache.has(id)) urlCache.set(id, URL.createObjectURL(blob))
  return urlCache.get(id)
}

export function releasePhotoUrl(id) {
  const url = urlCache.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    urlCache.delete(id)
  }
}

export function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export function dataURLToBlob(dataURL) {
  const [head, body] = dataURL.split(',')
  const mime = head.match(/data:(.*?);/)?.[1] || 'image/jpeg'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
