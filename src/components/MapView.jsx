import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Thin Leaflet wrapper. Markers are on-brand SVG divIcons (no image assets).
// markers: [{ id, lat, lon, kind: 'campground'|'rv-park'|'saved'|'from'|'to', selected, onClick }]
// user: { lat, lon } | null — shown as a pulsing dot
// fit: 'markers' | null — fit bounds to markers when they change
// line: [{lat,lon},{lat,lon}] | null — simple route overview line

function markerHtml(kind, selected) {
  const fill = selected ? 'var(--amber)' : kind === 'rv-park' ? 'var(--clay)' : 'var(--pine)'
  const glyph =
    kind === 'from' || kind === 'to'
      ? '<circle cx="12" cy="10.4" r="3" fill="#F6F1E5"/>'
      : `<path d="M12 5.6 7.2 14h9.6z" fill="none" stroke="#F6F1E5" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round"/>`
  return `<svg width="34" height="42" viewBox="0 0 24 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 29C12 29 2.6 18.4 2.6 10.9a9.4 9.4 0 1 1 18.8 0C21.4 18.4 12 29 12 29z" fill="${fill}" stroke="#F6F1E5" stroke-width="1.3"/>
    ${glyph}
  </svg>`
}

function makeIcon(kind, selected) {
  return L.divIcon({
    className: 'ck-marker' + (selected ? ' is-selected' : ''),
    html: markerHtml(kind, selected),
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
        icon: makeIcon(m.kind || 'campground', m.selected),
        keyboard: false,
        zIndexOffset: m.selected ? 500 : 0,
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
    if (fit === 'markers') {
      const pts = [...markers.map((m) => [m.lat, m.lon]), ...(user ? [[user.lat, user.lon]] : []), ...(line || []).map((p) => [p.lat, p.lon])]
      if (pts.length >= 2) map.fitBounds(L.latLngBounds(pts).pad(0.18), { animate: false })
      else if (pts.length === 1) map.setView(pts[0], zoom)
    }
  }, [markers, user, line, fit, zoom])

  return (
    <div
      ref={elRef}
      className={`${className || 'map-view'} ${dark ? 'map-dark' : ''}`}
      style={{ height }}
      aria-label="Map"
    />
  )
}
