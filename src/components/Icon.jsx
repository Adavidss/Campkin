import React from 'react'

// Hand-drawn stroke icon set — one consistent 24×24 grid, thin lines,
// round caps. `filled` swaps star/heart/bookmark to their filled forms.

const P = (d, extra) => <path d={d} {...extra} />
const C = (cx, cy, r, extra) => <circle cx={cx} cy={cy} r={r} {...extra} />

const ICONS = {
  // --- navigation & actions -------------------------------------------------
  home: () => (
    <>
      {P('M4 11.2 12 4.8l8 6.4')}
      {P('M6.2 9.8V19h11.6V9.8')}
    </>
  ),
  signpost: () => (
    <>
      {P('M12 3.2V21')}
      {P('M12 5h5.8l2.2 2-2.2 2H12z')}
      {P('M12 11h-5.8L4 13l2.2 2H12z')}
      {P('M9.5 21h5')}
    </>
  ),
  passport: () => (
    <>
      {P('M6.2 3.6h11.6a.9.9 0 0 1 .9.9v15a.9.9 0 0 1-.9.9H6.2a.9.9 0 0 1-.9-.9v-15a.9.9 0 0 1 .9-.9z')}
      {C(12, 10, 3)}
      {P('M9 16.4h6')}
    </>
  ),
  tent: () => (
    <>
      {P('M12 4.6 3.6 19h16.8z')}
      {P('M12 12.4 8.2 19h7.6z')}
      {P('M2 19h20')}
    </>
  ),
  dots: () => (
    <>
      {C(5, 12, 1.5, { fill: 'currentColor', stroke: 'none' })}
      {C(12, 12, 1.5, { fill: 'currentColor', stroke: 'none' })}
      {C(19, 12, 1.5, { fill: 'currentColor', stroke: 'none' })}
    </>
  ),
  plus: () => (
    <>
      {P('M12 5v14')}
      {P('M5 12h14')}
    </>
  ),
  chevronRight: () => P('M9 5l7 7-7 7'),
  chevronLeft: () => P('M15 5l-7 7 7 7'),
  chevronDown: () => P('M5 9l7 7 7-7'),
  arrowLeft: () => (
    <>
      {P('M19 12H5')}
      {P('M11 6l-6 6 6 6')}
    </>
  ),
  check: () => P('M4.5 12.5l5 5L19.5 6.5'),
  close: () => (
    <>
      {P('M6 6l12 12')}
      {P('M18 6L6 18')}
    </>
  ),
  star: (filled) =>
    P('M12 3.4l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z', filled ? { fill: 'currentColor' } : undefined),
  heart: (filled) =>
    P('M12 20.1C7 16.5 3.4 13.3 3.4 9.7c0-2.5 1.9-4.4 4.3-4.4 1.7 0 3.3 1 4.3 2.6 1-1.6 2.6-2.6 4.3-2.6 2.4 0 4.3 1.9 4.3 4.4 0 3.6-3.6 6.8-8.6 10.4z', filled ? { fill: 'currentColor' } : undefined),
  bookmark: (filled) =>
    P('M7 4h10v16.2l-5-3.7-5 3.7z', filled ? { fill: 'currentColor' } : undefined),
  pin: () => (
    <>
      {P('M12 21c-3.4-3.4-6.3-7-6.3-10.4a6.3 6.3 0 1 1 12.6 0C18.3 14 15.4 17.6 12 21z')}
      {C(12, 10.4, 2.3)}
    </>
  ),
  phone: () => P('M5.2 4h3.6L10.4 8.4 8.2 10.2a12.8 12.8 0 0 0 5.6 5.6l1.8-2.2 4.4 1.6v3.6a1.6 1.6 0 0 1-1.8 1.6C10.6 19.5 4.5 13.4 3.6 5.8A1.6 1.6 0 0 1 5.2 4z'),
  globe: () => (
    <>
      {C(12, 12, 8.6)}
      {P('M3.4 12h17.2')}
      {P('M12 3.4c2.8 3.2 2.8 14 0 17.2c-2.8-3.2-2.8-14 0-17.2')}
    </>
  ),
  map: () => (
    <>
      {P('M9 4.4 3.4 6.2v13.4L9 17.8l6 1.8 5.6-1.8V4.4L15 6.2z')}
      {P('M9 4.4v13.4')}
      {P('M15 6.2v13.4')}
    </>
  ),
  calendar: () => (
    <>
      {P('M4.4 5.6h15.2v14H4.4z')}
      {P('M4.4 9.8h15.2')}
      {P('M8.2 3.4v3.8M15.8 3.4v3.8')}
    </>
  ),
  clock: () => (
    <>
      {C(12, 12, 8.6)}
      {P('M12 7.2V12l3.4 2')}
    </>
  ),
  note: () => (
    <>
      {P('M6 3.6h8.6l3.4 3.4v13.4H6z')}
      {P('M14.6 3.6V7h3.4')}
      {P('M9 12h6M9 15.4h4')}
    </>
  ),
  camera: () => (
    <>
      {P('M4 8h3.2l1.7-2.6h6.2L16.8 8H20v11H4z')}
      {C(12, 13.2, 3.2)}
    </>
  ),
  image: () => (
    <>
      {P('M4.4 4.8h15.2v14.4H4.4z')}
      {C(9, 9.6, 1.7)}
      {P('M4.8 16.4l4.6-4.6 3.6 3.6 2.6-2.6 4 4')}
    </>
  ),
  trash: () => (
    <>
      {P('M4.5 6.6h15')}
      {P('M9.2 6.6V4.2h5.6v2.4')}
      {P('M6.4 6.6l.9 13h9.4l.9-13')}
      {P('M10.2 10v6M13.8 10v6')}
    </>
  ),
  pencil: () => (
    <>
      {P('M4.4 19.6l.9-3.9L16.6 4.4a2 2 0 0 1 2.9 2.9L8.2 18.6z')}
      {P('M14.6 6.4l2.9 2.9')}
    </>
  ),
  search: () => (
    <>
      {C(10.8, 10.8, 6.2)}
      {P('M15.4 15.4 20.4 20.4')}
    </>
  ),
  download: () => (
    <>
      {P('M12 4v11')}
      {P('M7.6 10.8 12 15.2l4.4-4.4')}
      {P('M5 19.4h14')}
    </>
  ),
  upload: () => (
    <>
      {P('M12 15V4')}
      {P('M7.6 8.2 12 3.8l4.4 4.4')}
      {P('M5 19.4h14')}
    </>
  ),
  refresh: () => (
    <>
      {P('M20 12a8 8 0 1 1-2.4-5.7')}
      {P('M20.4 3.6v4.6h-4.6')}
    </>
  ),
  external: () => (
    <>
      {P('M13.6 5h5.4v5.4')}
      {P('M19 5l-8.4 8.4')}
      {P('M9.4 6.2H4.8v13h13v-4.6')}
    </>
  ),
  sliders: () => (
    <>
      {P('M4 7.4h16M4 12h16M4 16.6h16')}
      {C(9.2, 7.4, 1.9, { className: 'ck-knob' })}
      {C(15, 12, 1.9, { className: 'ck-knob' })}
      {C(7.4, 16.6, 1.9, { className: 'ck-knob' })}
    </>
  ),
  flag: () => (
    <>
      {P('M6 21V3.8')}
      {P('M6 4.8c2-1.2 4-1.2 6 0s4 1.2 6 0v8.4c-2 1.2-4 1.2-6 0s-4-1.2-6 0')}
    </>
  ),
  sparkle: () => P('M12 3.8l1.9 5.3 5.3 1.9-5.3 1.9L12 18.2l-1.9-5.3-5.3-1.9 5.3-1.9z'),
  route: () => (
    <>
      {C(5.4, 18.4, 2.1)}
      {C(18.6, 5.4, 2.1)}
      {P('M7.5 18.4h7a3.4 3.4 0 0 0 0-6.8h-5a3.4 3.4 0 0 1 0-6.8h7')}
    </>
  ),
  rv: () => (
    <>
      {P('M3.4 16.4V8a2 2 0 0 1 2-2h10.2l5 4.6v5.8h-2.2')}
      {P('M3.4 16.4h2.4M9.8 16.4h4.4')}
      {C(7.2, 17, 1.9)}
      {C(16.2, 17, 1.9)}
      {P('M12.8 6v4.2h5.4')}
      {P('M6.2 9.4h3.4')}
    </>
  ),
  book: () => (
    <>
      {P('M5 20.2a2.2 2.2 0 0 1 2.2-2.2H19V3.4H7.2A2.2 2.2 0 0 0 5 5.6z')}
      {P('M5 20.2A2.2 2.2 0 0 0 7.2 22.4H19v-4.4')}
      {P('M9 7.4h6')}
    </>
  ),
  info: () => (
    <>
      {C(12, 12, 8.6)}
      {P('M12 11v5.4')}
      {C(12, 7.8, 0.4, { fill: 'currentColor' })}
    </>
  ),
  moon: () => P('M19.8 14.2A8.2 8.2 0 0 1 9.8 4.2a8.2 8.2 0 1 0 10 10z'),
  sun: () => (
    <>
      {C(12, 12, 3.6)}
      {P('M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.6 5.6l1.6 1.6M16.8 16.8l1.6 1.6M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6')}
    </>
  ),
  list: () => (
    <>
      {P('M8.6 6.4h11M8.6 12h11M8.6 17.6h11')}
      {P('M4 5.6l1 1 1.8-2')}
      {P('M4 11.2l1 1 1.8-2')}
      {P('M4 16.8l1 1 1.8-2')}
    </>
  ),

  // --- park & stamp motifs ---------------------------------------------------
  mountains: () => (
    <>
      {P('M2.6 18.4 8.8 7.6l3.6 6.2 2.4-4 6.6 8.6z')}
      {P('M7.2 10.4l1.6 1.6 1.6-1.6')}
    </>
  ),
  canyon: () => (
    <>
      {P('M3 18.4h3.6v-4h3v-4.6h4.8v4.6h3v4H21')}
      {C(18, 7, 1.8)}
    </>
  ),
  desert: () => (
    <>
      {P('M3 17.4h18')}
      {C(16.4, 9, 2.6)}
      {P('M4.6 17.4c1.6-3.6 5-3.6 6.6 0')}
    </>
  ),
  waves: () => (
    <>
      {P('M3 9.4c2-2 4-2 6 0s4 2 6 0 4-2 6 0')}
      {P('M3 14.8c2-2 4-2 6 0s4 2 6 0 4-2 6 0')}
    </>
  ),
  forest: () => (
    <>
      {P('M9 3.8 5 10.2h2.2L4 15.6h10L10.8 10.2H13z')}
      {P('M9 15.6v3.6')}
      {P('M16.6 8.4l-2.6 4.2h1.4L13.6 16h6l-1.8-3.4h1.4z')}
      {P('M16.6 16v2.8')}
    </>
  ),
  cave: () => (
    <>
      {P('M4 19v-4.6a8 8 0 0 1 16 0V19')}
      {P('M8.4 19v-3a3.6 3.6 0 0 1 7.2 0v3')}
      {P('M2.6 19h18.8')}
    </>
  ),
  island: () => (
    <>
      {P('M4.6 18.4c2.4-4.6 12.4-4.6 14.8 0')}
      {P('M12.6 14.6c.4-3.6.2-5.6-.8-7.6')}
      {P('M11.8 7c-1.6-1.8-4-2-5.6-.6')}
      {P('M11.8 7c1.6-1.8 4-2 5.6-.6')}
      {P('M11.8 7c-.2-2 .6-3.6 2.2-4.6')}
    </>
  ),
  volcano: () => (
    <>
      {P('M9.4 6.4h5.2L19 18.4H5z')}
      {P('M9.4 6.4c.8 1.2 1.7 1.2 2.6 0s1.7-1.2 2.6 0')}
      {P('M12 2.2c.8.7.8 1.6 0 2.4')}
    </>
  ),
  arch: () => (
    <>
      {P('M4.4 18.4V9.6a7.6 7.6 0 0 1 15.2 0v8.8')}
      {P('M8.8 18.4v-7a3.2 3.2 0 0 1 6.4 0v7')}
      {P('M3 18.4h18')}
    </>
  ),
  dunes: () => (
    <>
      {P('M2.6 16.8c2.6-5.6 6.6-5.6 9.4 0')}
      {P('M8.6 16.8c3-5 8.4-5 12.8 0')}
      {C(6.4, 6.6, 2)}
    </>
  ),
  glacier: () => (
    <>
      {P('M5 14.4l3-6 3 2.4 2-4.4 6 8')}
      {P('M3 17.6c2-1.6 4-1.6 6 0s4 1.6 6 0 4-1.6 6 0')}
    </>
  ),
  swamp: () => (
    <>
      {P('M9 17V8.6M12.4 17V5.8M15.8 17v-7')}
      {P('M12.4 5.8v3.4')}
      {P('M11.7 6h1.4v2.6h-1.4z', { fill: 'currentColor', stroke: 'none' })}
      {P('M4 17.6c2-1.4 4-1.4 6 0s4 1.4 6 0 3-1.4 4.6 0')}
    </>
  ),
  geyser: () => (
    <>
      {P('M12 19v-6.4')}
      {P('M12 12.6c0-3-2.4-3.4-2.4-6.2C9.6 4.4 10.8 3 12 3s2.4 1.4 2.4 3.4c0 2.8-2.4 3.2-2.4 6.2')}
      {C(7.8, 8, 0.5, { fill: 'currentColor' })}
      {C(16.2, 8, 0.5, { fill: 'currentColor' })}
      {P('M6.6 19h10.8')}
    </>
  ),
  tree: () => (
    <>
      {P('M12 2.8 6.4 15h11.2z')}
      {P('M12 15v5.2')}
    </>
  ),
  cactus: () => (
    <>
      {P('M10.4 19.6V6.6a1.9 1.9 0 0 1 3.8 0v13')}
      {P('M10.4 13.2H8.6a2 2 0 0 1-2-2V9')}
      {P('M14.2 11h1.8a2 2 0 0 0 2-2V7.4')}
      {P('M6 19.6h12.6')}
    </>
  ),
  column: () => (
    <>
      {P('M5.4 9.2 12 4.4l6.6 4.8z')}
      {P('M8.4 9.2v7.6M12 9.2v7.6M15.6 9.2v7.6')}
      {P('M6.6 16.8h10.8M5.4 19.4h13.2')}
    </>
  ),
  town: () => (
    <>
      {P('M4 19v-8h5v8')}
      {P('M9 19V6.6h6V19')}
      {P('M15 19v-5.6h5V19')}
      {P('M3 19h18')}
      {P('M11.4 9.4h1.2M11.4 12.4h1.2')}
    </>
  ),
  landmark: () => (
    <>
      {P('M10.6 18.6 11.4 4.6h1.2l.8 14z')}
      {P('M7.6 18.6h8.8')}
    </>
  ),
  road: () => (
    <>
      {P('M4.6 20C10 16 6.4 10.4 12 8c4-1.7 5.4-3 6.4-5')}
      {P('M9.6 13.4l1.4 1.4M12.6 8.8l1.4 1.4M16.6 4.8l1.2 1.2', { strokeDasharray: '0.1 3' })}
    </>
  ),
}

export default function Icon({ name, size = 20, filled = false, strokeWidth = 1.7, className, ...rest }) {
  const render = ICONS[name] || ICONS.pin
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {render(filled)}
    </svg>
  )
}

// The Campkin mark: a tent under a moon with the road ahead leading to it.
export function Logo({ size = 28, className }) {
  const maskId = React.useId()
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect width="48" height="48" fill="black" />
          <circle cx="31.8" cy="12.2" r="5" fill="white" />
          <circle cx="34.7" cy="9.5" r="4.7" fill="black" />
        </mask>
      </defs>
      <circle cx="24" cy="24" r="22" fill="var(--logo-bg, #33544A)" />
      <rect width="48" height="48" fill="var(--logo-moon, #E8DCBF)" mask={`url(#${maskId})`} />
      <path
        d="M13.5 34.5 23 17.2l9.5 17.3"
        stroke="var(--logo-line, #F6F1E5)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 34.5 23 27.2l4 7.3"
        stroke="var(--logo-line, #F6F1E5)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g fill="var(--logo-line, #F6F1E5)">
        <circle cx="13" cy="40.3" r="1.3" />
        <circle cx="18" cy="39.5" r="1.3" />
        <circle cx="23" cy="40.1" r="1.3" />
        <circle cx="28" cy="40.4" r="1.3" />
        <circle cx="33" cy="39.7" r="1.3" />
      </g>
    </svg>
  )
}
