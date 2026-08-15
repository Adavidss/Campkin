import React, { useEffect, useState } from 'react'

// Minimal hash router. Hash routing keeps deep links working anywhere GitHub
// Pages serves the app — only /Campkin/ is ever requested from the server.

function currentPath() {
  const h = window.location.hash || '#/'
  return h.replace(/^#\/?/, '')
}

export function useRoute() {
  const [path, setPath] = useState(currentPath())
  useEffect(() => {
    const onChange = () => {
      setPath(currentPath())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent)
  return { path, parts }
}

export function navigate(to, { replace = false } = {}) {
  const hash = '#/' + String(to).replace(/^[#/]+/, '')
  if (replace) {
    const url = new URL(window.location.href)
    url.hash = hash
    window.location.replace(url)
  } else {
    window.location.hash = hash
  }
}

export function back(fallback = '') {
  if (window.history.length > 1) window.history.back()
  else navigate(fallback)
}

export function Link({ to, children, className, ...rest }) {
  return (
    <a href={'#/' + String(to).replace(/^[#/]+/, '')} className={className} {...rest}>
      {children}
    </a>
  )
}
