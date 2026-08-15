import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon.jsx'
import { cx } from '../lib/util.js'

// ---------------------------------------------------------------------------
// Buttons

export function Button({
  variant = 'solid', // solid | soft | ghost | danger
  icon,
  children,
  full,
  small,
  as,
  className,
  type,
  ...rest
}) {
  const Tag = as || (rest.href ? 'a' : 'button')
  return (
    <Tag
      className={cx('btn', `btn-${variant}`, full && 'btn-full', small && 'btn-small', className)}
      type={Tag === 'button' ? type || 'button' : undefined}
      {...rest}
    >
      {icon && <Icon name={icon} size={small ? 16 : 18} />}
      {children && <span>{children}</span>}
    </Tag>
  )
}

export function IconBtn({ name, label, active, filled, className, size = 20, style, ...rest }) {
  return (
    <button
      type="button"
      className={cx('icon-btn', active && 'is-active', className)}
      aria-label={label}
      title={label}
      aria-pressed={active != null ? active : undefined}
      {...rest}
    >
      <Icon name={name} size={size} filled={filled ?? active} style={style} />
    </button>
  )
}

// ---------------------------------------------------------------------------
// Layout primitives

export function Card({ className, onClick, children, as, ...rest }) {
  const Tag = as || (onClick ? 'button' : 'div')
  return (
    <Tag
      className={cx('card', onClick && 'card-tappable', className)}
      onClick={onClick}
      type={Tag === 'button' ? 'button' : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function Section({ title, action, children, className }) {
  return (
    <section className={cx('section', className)}>
      {(title || action) && (
        <div className="section-head">
          {title && <h2 className="section-title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function EmptyState({ icon, title, text, children, compact }) {
  return (
    <div className={cx('empty-state', compact && 'is-compact')}>
      {icon && (
        <div className="empty-icon">
          <Icon name={icon} size={compact ? 24 : 32} strokeWidth={1.4} />
        </div>
      )}
      {title && <h3 className="empty-title">{title}</h3>}
      {text && <p className="empty-text">{text}</p>}
      {children && <div className="empty-actions">{children}</div>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Forms

export function Field({ label, hint, children, className }) {
  return (
    <label className={cx('field', className)}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  )
}

export function Chips({ options, value, onChange, ariaLabel, className }) {
  return (
    <div className={cx('chips', className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { id: o, label: o } : o
        const active = value === opt.id
        return (
          <button
            key={opt.id}
            type="button"
            className={cx('chip', active && 'is-active')}
            aria-pressed={active}
            onClick={() => onChange(active && opt.clearable !== false ? null : opt.id)}
          >
            {opt.icon && <Icon name={opt.icon} size={14} />}
            {opt.label}
            {opt.count != null && <span className="chip-count">{opt.count}</span>}
          </button>
        )
      })}
    </div>
  )
}

export function Segmented({ options, value, onChange, ariaLabel, className }) {
  return (
    <div className={cx('segmented', className)} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const opt = typeof o === 'string' ? { id: o, label: o } : o
        return (
          <button
            key={opt.id}
            type="button"
            className={cx('segment', value === opt.id && 'is-active')}
            aria-pressed={value === opt.id}
            onClick={() => onChange(opt.id)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export function Stars({ value = 0, onChange, size = 22, label = 'Rating' }) {
  if (!onChange) {
    return (
      <span className="stars" role="img" aria-label={`${value} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Icon key={n} name="star" size={size} filled={n <= value} className={n <= value ? 'star-on' : 'star-off'} />
        ))}
      </span>
    )
  }
  return (
    <div className="stars stars-input" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          className="star-btn"
          onClick={() => onChange(value === n ? 0 : n)}
        >
          <Icon name="star" size={size} filled={n <= value} className={n <= value ? 'star-on' : 'star-off'} />
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={cx('toggle', checked && 'is-on')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}

export function ProgressBar({ value, max, className }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className={cx('progress', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Rows

export function ListRow({ icon, iconEl, title, sub, right, onClick, href, className }) {
  const Tag = href ? 'a' : onClick ? 'button' : 'div'
  return (
    <Tag
      className={cx('list-row', (onClick || href) && 'is-tappable', className)}
      onClick={onClick}
      href={href}
      type={Tag === 'button' ? 'button' : undefined}
    >
      {(icon || iconEl) && <span className="row-icon">{iconEl || <Icon name={icon} size={20} />}</span>}
      <span className="row-main">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {right && <span className="row-right">{right}</span>}
    </Tag>
  )
}

// ---------------------------------------------------------------------------
// Sheet (bottom sheet on mobile, centered dialog on desktop)

export function Sheet({ open, onClose, title, children, footer, wide }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    // Move focus into the dialog.
    setTimeout(() => {
      ref.current?.querySelector('[data-autofocus]')?.focus?.() ||
        ref.current?.querySelector('button, input, textarea, select, a')?.focus?.()
    }, 30)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return createPortal(
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cx('sheet', wide && 'sheet-wide')} role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <div className="sheet-head">
          <h2 className="sheet-title">{title}</h2>
          <IconBtn name="close" label="Close" onClick={onClose} />
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </div>,
    document.body
  )
}

export function ConfirmSheet({ open, onClose, title, message, confirmLabel = 'Confirm', danger, onConfirm }) {
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="btn-row">
          <Button variant="soft" onClick={onClose} full>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'solid'}
            full
            data-autofocus
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="confirm-message">{message}</p>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Toasts

const ToastCtx = createContext(() => {})

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const idRef = useRef(0)
  const push = (message, opts = {}) => {
    const id = ++idRef.current
    setToasts((t) => [...t, { id, message, ...opts }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.duration || 3200)
  }
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('toast', t.tone && `toast-${t.tone}`)}>
            {t.icon && <Icon name={t.icon} size={16} />}
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
