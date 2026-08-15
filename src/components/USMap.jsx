import React from 'react'
import { STATES } from '../lib/states.js'

// Square-tile cartogram of the 50 states. Tap a tile to correct your record.
const TILE = 30
const GAP = 4
const STEP = TILE + GAP

export default function USMap({ visited, onToggle }) {
  const cols = Math.max(...STATES.map((s) => s.col)) + 1
  const rows = Math.max(...STATES.map((s) => s.row)) + 1
  const w = cols * STEP - GAP
  const h = rows * STEP - GAP
  return (
    <svg
      className="us-map"
      viewBox={`0 0 ${w} ${h}`}
      role="group"
      aria-label={`Map of visited states: ${[...visited].sort().join(', ') || 'none yet'}`}
    >
      {STATES.map((s) => {
        const x = s.col * STEP
        const y = s.row * STEP
        const isVisited = visited.has(s.ab)
        return (
          <g
            key={s.ab}
            role="button"
            tabIndex={0}
            aria-pressed={isVisited}
            aria-label={`${s.name}${isVisited ? ', visited' : ', not visited'}`}
            onClick={() => onToggle?.(s.ab, isVisited)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onToggle?.(s.ab, isVisited)
              }
            }}
            style={{ cursor: onToggle ? 'pointer' : 'default' }}
          >
            <rect
              className={`map-tile ${isVisited ? 'is-visited' : ''}`}
              x={x}
              y={y}
              width={TILE}
              height={TILE}
              rx={7}
            />
            <text
              className={`map-tile-label ${isVisited ? 'is-visited' : ''}`}
              x={x + TILE / 2}
              y={y + TILE / 2 + 3}
              textAnchor="middle"
            >
              {s.ab}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
