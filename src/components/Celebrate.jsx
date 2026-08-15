import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon, { Logo } from './Icon.jsx'
import { Button } from './ui.jsx'

// A brief, tasteful moment of delight: a passport stamp slams down with a
// burst of leaf-and-pine confetti, then gets out of the way. Fires when a
// trip is created, completed, or a stamp is earned. Respects reduced motion.

const CelebrateCtx = createContext(() => {})

const CONFETTI_COLORS = ['#33544A', '#7D9682', '#D9C9A4', '#A3705C', '#5B7C8C', '#C08C33', '#E8DCBF']

export function CelebrateProvider({ children }) {
  const [moment, setMoment] = useState(null) // { title, sub, kind, actions }
  const canvasRef = useRef(null)
  const timerRef = useRef(null)

  const celebrate = useCallback((opts) => {
    setMoment({ id: Date.now(), ...opts })
  }, [])

  const dismiss = () => setMoment(null)

  useEffect(() => {
    if (!moment) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduce) burst(canvasRef.current)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(dismiss, moment.actions ? 6500 : 2600)
    return () => clearTimeout(timerRef.current)
  }, [moment?.id])

  return (
    <CelebrateCtx.Provider value={celebrate}>
      {children}
      {moment &&
        createPortal(
          <div className="celebrate-layer" onClick={dismiss} role="status" aria-live="polite">
            <canvas ref={canvasRef} className="celebrate-canvas" />
            <div className="celebrate-card" onClick={(e) => e.stopPropagation()}>
              <div className={`celebrate-stamp kind-${moment.kind || 'trip'}`}>
                <div className="celebrate-stamp-inner">
                  <Icon name={moment.icon || 'tent'} size={30} strokeWidth={1.7} />
                  <span className="celebrate-stamp-word">{moment.stampWord || 'SAVED'}</span>
                </div>
              </div>
              <div className="celebrate-title">{moment.title}</div>
              {moment.sub && <div className="celebrate-sub">{moment.sub}</div>}
              {moment.actions && (
                <div className="celebrate-actions">
                  {moment.actions.map((a, i) => (
                    <Button
                      key={i}
                      small
                      variant={i === 0 ? 'solid' : 'soft'}
                      icon={a.icon}
                      onClick={() => {
                        dismiss()
                        a.onClick()
                      }}
                    >
                      {a.label}
                    </Button>
                  ))}
                  <button type="button" className="celebrate-later" onClick={dismiss}>
                    Later
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </CelebrateCtx.Provider>
  )
}

export function useCelebrate() {
  return useContext(CelebrateCtx)
}

// Small hand-rolled confetti — leaves and flecks, ~1.6s, no library.
function burst(canvas) {
  if (!canvas) return
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  const w = (canvas.width = window.innerWidth * dpr)
  const h = (canvas.height = window.innerHeight * dpr)
  const ctx = canvas.getContext('2d')
  const cx = w / 2
  const cy = h * 0.42
  const N = 90
  const parts = Array.from({ length: N }, () => {
    const a = Math.random() * Math.PI * 2
    const sp = (6 + Math.random() * 11) * dpr
    return {
      x: cx,
      y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 6 * dpr,
      r: (3 + Math.random() * 4) * dpr,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      leaf: Math.random() < 0.45,
    }
  })
  const start = performance.now()
  const dur = 1600
  function frame(t) {
    const p = (t - start) / dur
    if (p >= 1) {
      ctx.clearRect(0, 0, w, h)
      return
    }
    ctx.clearRect(0, 0, w, h)
    ctx.globalAlpha = 1 - Math.max(0, p - 0.6) / 0.4
    for (const q of parts) {
      q.vy += 0.35 * dpr
      q.vx *= 0.985
      q.x += q.vx
      q.y += q.vy
      q.rot += q.vr
      ctx.save()
      ctx.translate(q.x, q.y)
      ctx.rotate(q.rot)
      ctx.fillStyle = q.color
      if (q.leaf) {
        ctx.beginPath()
        ctx.ellipse(0, 0, q.r * 1.6, q.r * 0.8, 0, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-q.r / 2, -q.r / 2, q.r, q.r * 1.4)
      }
      ctx.restore()
    }
    requestAnimationFrame(frame)
  }
  requestAnimationFrame(frame)
}
