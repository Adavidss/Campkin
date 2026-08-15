import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Thin Leaflet wrapper. Markers are on-brand SVG divIcons (no image assets).
// markers: [{ id, lat, lon, kind: 'campground'|'rv-park'|'saved'|'from'|'to', selected, onClick }]
// user: { lat, lon } | null — shown as a pulsing dot
// fit: 'markers' | null — fit bounds to markers when they change
// line: [{lat,lon},{lat,lon}] | null — simple route overview line

// Day palette for itinerary pins — distinct, still on-brand.
export const DAY_COLORS = ['#33544A', '#5B7C8C', '#A3705C', '#C08C33', '#7D9682', '#8A6C9C', '#B0574A', '#4F7F9F']

function markerHtml(kind, selected, color, label) {
  const fill = color || (selected ? 'var(--amber)' : kind === 'rv-park' ? 'var(--clay)' : 'var(--pine)')
  let glyph
  if (label != null) {
    glyph = `<text x="12" y="14" text-anchor="middle" font-family="-apple-system,Segoe UI,Roboto,sans-serif" font-size="9.5" font-weight="700" fill="#F6F1E5">${String(label).slice(0, 3)}</text>`
  } else if (kind === 'from' || kind === 'to') {
    glyph = '<circle cx="12" cy="10.4" r="3" fill="#F6F1E5"/>'
  } else if (kind === 'food') {
    glyph = '<path d="M9 6v4a1.5 1.5 0 0 0 3 0V6M10.5 6v9M14.6 12V6c-1.4.6-2 2-2 3.6 0 1.2.4 2 1.2 2.4z M14.6 12v3" fill="none" stroke="#F6F1E5" stroke-width="1.4" stroke-linecap="round"/>'
  } else if (kind === 'sight') {
    glyph = '<path d="M7 9.4h2l1-1.5h4l1 1.5h2v6.2H7z" fill="none" stroke="#F6F1E5" stroke-width="1.4" stroke-linejoin="round"/><circle cx="12" cy="12.2" r="1.7" fill="none" stroke="#F6F1E5" stroke-width="1.3"/>'
  } else {
    glyph = `<path d="M12 5.6 7.2 14h9.6z" fill="none" stroke="#F6F1E5" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`
  }
  const ring = selected ? '<circle cx="12" cy="10.9" r="11.2" fill="none" stroke="var(--amber)" stroke-width="2"/>' : ''
  return `<svg width="34" height="42" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
    ${ring}
    <path d="M12 29C12 29 2.6 18.4 2.6 10.9a9.4 9.4 0 1 1 18.8 0C21.4 18.4 12 29 12 29z" fill="${fill}" stroke="#F6F1E5" stroke-width="1.3"/>
    ${glyph}
  </svg>`
}

function makeIcon(kind, selected, color, label) {
  return L.divIcon({
    className: 'ck-marker' + (selected ? ' is-selected' : ''),
    html: markerHtml(kind, selected, color, label),
    iconSize: [34, 42],
    iconAnchor: [17, 40],
  })
}

const USER_ICON = L.divIcon({
  className: 'ck-user-dot',
  html: '<span class="ck-user-inner"></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

export default function MapView({
  center,
  zoom = 10,
  markers = [],
  user = null,
  line = null,
  legs = null,
  fit = null,
  onMoved,
  height = 300,
  interactive = true,
  dark = false,
  className,
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const layerRef = useRef(null)
  const onMovedRef = useRef(onMoved)
  onMovedRef.current = onMoved

  // init once
  useEffect(() => {
    const map = L.map(elRef.current, {
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      touchZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      tapHold: false,
    })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)
    if (interactive) L.control.zoom({ position: 'bottomright' }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)
    map.setView([center?.lat ?? 39, center?.lon ?? -96], zoom)
    map.on('moveend', () => {
      const c = map.getCenter()
      onMovedRef.current?.({ lat: c.lat, lon: c.lng }, map.getZoom())
    })
    mapRef.current = map
    // The pane sometimes mounts before layout settles.
    setTimeout(() => map.invalidateSize(), 60)
    return () => {
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // recenter when center prop changes meaningfully
  useEffect(() => {
    const map = mapRef.current
    if (!map || !center) return
    const cur = map.getCenter()
    if (Math.abs(cur.lat - center.lat) > 1e-6 || Math.abs(cur.lng - center.lon) > 1e-6) {
      map.setView([center.lat, center.lon], zoom, { animate: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center?.lat, center?.lon])

  // sync markers / user dot / line
  useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()
    for (const m of markers) {
      const mk = L.marker([m.lat, m.lon], {
        icon: makeIcon(m.kind || 'campground', m.selected, m.color, m.label),
        keyboard: false,
        zIndexOffset: m.selected ? 500 : m.z || 0,
      })
      if (m.onClick) mk.on('click', () => m.onClick(m))
      mk.addTo(layer)
    }
    if (user) L.marker([user.lat, user.lon], { icon: USER_ICON, keyboard: false }).addTo(layer)
    if (line && line.length >= 2) {
      L.polyline(
        line.map((p) => [p.lat, p.lon]),
        { color: '#33544A', weight: 3, opacity: 0.75, dashArray: '1 7', lineCap: 'round' }
      ).addTo(layer)
    }
    // Multiple colored legs: [{ points:[{lat,lon}…], color }]
    for (const leg of legs || []) {
      if (leg.points.length < 2) continue
      L.polyline(
        leg.points.map((p) => [p.lat, p.lon]),
        { color: leg.color || '#33544A', weight: leg.weight || 3.5, opacity: 0.85, lineCap: 'round', lineJoin: 'round', dashArray: leg.dashed ? '1 7' : null }
      ).addTo(layer)
    }
    if (fit === 'markers') {
      const pts = [
        ...markers.map((m) => [m.lat, m.lon]),
        ...(user ? [[user.lat, user.lon]] : []),
        ...(line || []).map((p) => [p.lat, p.lon]),
        ...(legs || []).flatMap((l) => l.points.map((p) => [p.lat, p.lon])),
      ]
      if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts).pad(0.18), { animate: false })
      else if (pts.length === 1) map.setView(pts[0], zoom)
    }
  }, [markers, user, line, legs, fit, zoom])

  return (
    <div
      ref={elRef}
      className={`${className || 'map-view'} ${dark ? 'map-dark' : ''}`}
      style={{ height }}
      aria-label="Map"
    />
  )
}
