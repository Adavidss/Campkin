// Render a trip as a postcard PNG — for sharing to Messages/Instagram/etc.
// Drawn on canvas so it works fully offline; the destination photo comes
// from Wikipedia (CORS-friendly) when available, else a pine gradient.

import { fmtRange } from './dates.js'

const W = 1200
const H = 800

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(' ')
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = w
    } else line = test
  }
  if (line) lines.push(line)
  return lines
}

export async function renderPostcard({ trip, cg, places, photoUrl, rvMode = true }) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // background: photo or gradient
  const img = await loadImage(photoUrl)
  if (img) {
    const scale = Math.max(W / img.width, H / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh)
  } else {
    const g = ctx.createLinearGradient(0, 0, W, H)
    g.addColorStop(0, '#33544A')
    g.addColorStop(1, '#1f342c')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, W, H)
    // subtle ridge line
    ctx.strokeStyle = 'rgba(246,241,229,0.18)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.moveTo(0, 560)
    ctx.lineTo(220, 420)
    ctx.lineTo(380, 500)
    ctx.lineTo(560, 340)
    ctx.lineTo(760, 470)
    ctx.lineTo(940, 380)
    ctx.lineTo(1200, 520)
    ctx.stroke()
  }
  // scrim
  const s = ctx.createLinearGradient(0, 0, 0, H)
  s.addColorStop(0, 'rgba(23,28,24,0.18)')
  s.addColorStop(0.5, 'rgba(23,28,24,0.28)')
  s.addColorStop(1, 'rgba(23,28,24,0.9)')
  ctx.fillStyle = s
  ctx.fillRect(0, 0, W, H)

  const cream = '#F6F1E5'
  ctx.fillStyle = cream
  ctx.textBaseline = 'alphabetic'

  // brand
  ctx.font = '600 30px "Iowan Old Style", Palatino, Georgia, serif'
  ctx.fillText('Campkin', 56, 66)

  // stamp (top right)
  ctx.save()
  ctx.translate(W - 130, 130)
  ctx.rotate(0.14)
  ctx.strokeStyle = 'rgba(246,241,229,0.92)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(0, 0, 66, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(0, 0, 58, 0, Math.PI * 2)
  ctx.stroke()
  ctx.font = '800 15px -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(rvMode ? 'RV TRIP' : 'CAMPING', 0, -6)
  ctx.font = '600 13px -apple-system, "Segoe UI", Roboto, sans-serif'
  const yr = (trip.startDate || '').slice(0, 4)
  ctx.fillText(yr || 'SOON', 0, 16)
  ctx.textAlign = 'left'
  ctx.restore()

  // eyebrow
  const eyebrow = trip.completed ? 'A trip to remember' : 'Coming up'
  ctx.font = '800 20px -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(246,241,229,0.85)'
  ctx.fillText(eyebrow.toUpperCase().split('').join(String.fromCharCode(8202)), 56, 560)

  // title
  ctx.fillStyle = cream
  ctx.font = '600 66px "Iowan Old Style", Palatino, Georgia, serif'
  const titleLines = wrap(ctx, trip.name, W - 112).slice(0, 2)
  let y = 636
  for (const line of titleLines) {
    ctx.fillText(line, 56, y)
    y += 70
  }

  // meta
  ctx.font = '500 26px -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(246,241,229,0.9)'
  const meta = [trip.destination, fmtRange(trip.startDate, trip.endDate)].filter(Boolean).join('  ·  ')
  ctx.fillText(meta, 56, y + 2)
  y += 40

  // stops / campground
  const bits = []
  if (cg) bits.push(`⛺ ${cg.name}${trip.siteNumber ? ` · Site ${trip.siteNumber}` : ''}`)
  const named = places.filter((p) => p.category !== 'campground').slice(0, 4).map((p) => p.name)
  if (named.length) bits.push(named.join('  ·  '))
  ctx.font = '400 22px -apple-system, "Segoe UI", Roboto, sans-serif'
  ctx.fillStyle = 'rgba(246,241,229,0.82)'
  for (const b of bits.slice(0, 2)) {
    const line = wrap(ctx, b, W - 112)[0]
    ctx.fillText(line, 56, y)
    y += 30
  }

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), 'image/png'))
}

export async function sharePostcard(blob, filename, title) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
  return 'downloaded'
}
