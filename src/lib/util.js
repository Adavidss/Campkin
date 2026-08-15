// Small shared utilities.

export function uid() {
  // Time-sortable, collision-safe enough for a single-device app.
  return (
    Date.now().toString(36) +
    '-' +
    Math.random().toString(36).slice(2, 8)
  )
}

export function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

export function normalizeName(s) {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

export function plural(n, singular, pluralWord) {
  return `${n} ${n === 1 ? singular : pluralWord || singular + 's'}`
}

export function debounce(fn, ms) {
  let t
  const wrapped = (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  wrapped.flush = (...args) => {
    clearTimeout(t)
    fn(...args)
  }
  return wrapped
}

// Deterministic small hash for stable per-item visual variation (stamp tilt etc.)
export function hashCode(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
