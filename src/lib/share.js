// Sharing a trip: as readable text (iMessage, email, notes) and as a link
// that opens a read-only copy of the trip for anyone — no account, no server.
// The link carries the trip itself, compressed into the URL hash.

import { fmtRange, fmtDate, parseISO } from './dates.js'
import { CATEGORY_BY_ID } from '../data/model.js'
import { appleMapsDirections } from './maps.js'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function dayLabel(trip, day) {
  if (!trip.startDate) return `Day ${day}`
  const d = parseISO(trip.startDate)
  d.setDate(d.getDate() + day - 1)
  return `Day ${day} · ${WEEKDAYS[d.getDay()]} ${fmtDate(toISOLocal(d), { year: false })}`
}
function toISOLocal(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// A compact, portable snapshot of a trip — everything someone else needs to
// follow along, nothing personal beyond what's on the itinerary.
export function tripToShareable(trip, cg, places) {
  return {
    v: 1,
    name: trip.name,
    destination: trip.destination,
    startDate: trip.startDate,
    endDate: trip.endDate,
    siteNumber: trip.siteNumber || '',
    checkIn: trip.checkIn || '',
    checkOut: trip.checkOut || '',
    notes: trip.notes || '',
    route: trip.route
      ? {
          from: trip.route.from,
          to: trip.route.to,
          miles: trip.route.miles,
          driveTime: trip.route.driveTime,
          fromCoord: trip.route.fromCoord ? { lat: trip.route.fromCoord.lat, lon: trip.route.fromCoord.lon } : null,
          toCoord: trip.route.toCoord ? { lat: trip.route.toCoord.lat, lon: trip.route.toCoord.lon } : null,
        }
      : null,
    cg: cg
      ? {
          name: cg.name,
          location: cg.location || '',
          address: cg.address || '',
          phone: cg.phone || '',
          website: cg.website || '',
          hookups: cg.hookups || '',
          lat: cg.lat ?? null,
          lon: cg.lon ?? null,
        }
      : null,
    places: places.map((p) => ({
      name: p.name,
      category: p.category,
      day: p.day ?? null,
      order: p.order || 0,
      notes: p.notes || '',
      lat: p.lat ?? null,
      lon: p.lon ?? null,
      state: p.state || null,
    })),
  }
}

// ---- text -------------------------------------------------------------------

export function tripToText(shareable, { link } = {}) {
  const t = shareable
  const lines = []
  lines.push(`🚐 ${t.name}`)
  const when = fmtRange(t.startDate, t.endDate)
  if (t.destination || when) lines.push([t.destination, when].filter(Boolean).join(' · '))
  lines.push('')
  if (t.route?.from) {
    lines.push(`🛣 ${t.route.from} → ${t.route.to || t.destination}${t.route.miles ? ` · ${t.route.miles} mi` : ''}${t.route.driveTime ? ` · ~${t.route.driveTime}` : ''}`)
  }
  if (t.cg) {
    lines.push(`⛺ ${t.cg.name}${t.siteNumber ? ` · Site ${t.siteNumber}` : ''}${t.cg.hookups ? ` · ${t.cg.hookups}` : ''}`)
    if (t.cg.address) lines.push(`   ${t.cg.address}`)
    if (t.cg.phone) lines.push(`   ${t.cg.phone}`)
    if (t.checkIn || t.checkOut) lines.push(`   ${[t.checkIn && `Check-in ${t.checkIn}`, t.checkOut && `Check-out ${t.checkOut}`].filter(Boolean).join(' · ')}`)
  }
  if (t.route?.from || t.cg) lines.push('')

  const byDay = new Map()
  const ideas = []
  for (const p of [...t.places].sort((a, b) => (a.day || 99) - (b.day || 99) || a.order - b.order)) {
    if (p.day) {
      if (!byDay.has(p.day)) byDay.set(p.day, [])
      byDay.get(p.day).push(p)
    } else ideas.push(p)
  }
  const emoji = (c) => ({ food: '🍽', 'national-park': '🏞', campground: '⛺', 'scenic-drive': '🛣', beach: '🏖', 'historic-site': '🏛', landmark: '📍', city: '🏙', 'state-park': '🌲' })[c] || '📍'
  for (const [day, list] of byDay) {
    lines.push(dayLabel(t, day))
    for (const p of list) lines.push(`  ${emoji(p.category)} ${p.name}${p.notes ? ` — ${p.notes}` : ''}`)
    lines.push('')
  }
  if (ideas.length) {
    lines.push('Ideas')
    for (const p of ideas) lines.push(`  ${emoji(p.category)} ${p.name}`)
    lines.push('')
  }
  if (t.notes) {
    lines.push(`📝 ${t.notes}`)
    lines.push('')
  }
  if (link) lines.push(`Open in Campkin: ${link}`)
  else lines.push('— shared from Campkin')
  return lines.join('\n').trim()
}

// ---- link ------------------------------------------------------------------

// UTF-8 → base64url (via CompressionStream when available for short links)
async function encode(obj) {
  const json = JSON.stringify(obj)
  let bytes = new TextEncoder().encode(json)
  let flag = 'j'
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw')
      const w = cs.writable.getWriter()
      w.write(bytes)
      w.close()
      const buf = await new Response(cs.readable).arrayBuffer()
      const z = new Uint8Array(buf)
      if (z.length < bytes.length) {
        bytes = z
        flag = 'z'
      }
    } catch {
      /* fall back to plain */
    }
  }
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return flag + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function decodeShare(token) {
  if (!token || token.length < 2) return null
  const flag = token[0]
  const b64 = token.slice(1).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  let bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  if (flag === 'z') {
    const ds = new DecompressionStream('deflate-raw')
    const w = ds.writable.getWriter()
    w.write(bytes)
    w.close()
    bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer())
  }
  const obj = JSON.parse(new TextDecoder().decode(bytes))
  if (!obj || obj.v !== 1 || typeof obj.name !== 'string') throw new Error('Not a Campkin trip link.')
  return obj
}

export async function tripShareLink(shareable) {
  const token = await encode(shareable)
  const base = `${location.origin}${location.pathname}`
  return `${base}#/shared/${token}`
}

// Native share sheet when available, else copy to clipboard.
export async function shareText({ title, text, url }) {
  if (navigator.share) {
    try {
      await navigator.share(url ? { title, text, url } : { title, text })
      return 'shared'
    } catch (err) {
      if (err.name === 'AbortError') return 'cancelled'
    }
  }
  await navigator.clipboard.writeText(url ? `${text}\n${url}` : text)
  return 'copied'
}
