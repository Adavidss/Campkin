import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { wikiSummary } from '../lib/wiki.js'

// Photo + a paragraph + "Read on Wikipedia" for a place. Renders nothing
// until an article is found, so it never leaves a hole in the layout.
//   hint: { name, wikipedia?, state?, kind? }
//   variant: 'hero' (big photo, used at the top of a sheet)
//            'row'  (thumbnail + 2 lines, used in lists)
export default function WikiCard({ hint, variant = 'row', className, onLoaded }) {
  const [data, setData] = useState(undefined) // undefined=loading, null=none, {…}
  const key = `${hint?.wikipedia || ''}|${hint?.name || ''}|${hint?.state || ''}`

  useEffect(() => {
    if (!hint?.name) return
    let live = true
    setData(undefined)
    wikiSummary(hint)
      .then((d) => {
        if (!live) return
        setData(d)
        onLoaded?.(d)
      })
      .catch(() => live && setData(null))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  if (!data) return null

  if (variant === 'hero') {
    return (
      <div className={`wiki-hero ${className || ''}`}>
        {data.image && <img src={data.image} alt="" className="wiki-hero-img" loading="lazy" />}
        <div className="wiki-hero-body">
          <p className="wiki-extract">{clip(data.extract, 260)}</p>
          <a href={data.url} target="_blank" rel="noopener" className="wiki-link">
            <Icon name="book" size={13} /> Read on Wikipedia
          </a>
        </div>
      </div>
    )
  }

  return (
    <a href={data.url} target="_blank" rel="noopener" className={`wiki-row ${className || ''}`}>
      {data.thumb ? (
        <img src={data.thumb} alt="" className="wiki-thumb" loading="lazy" />
      ) : (
        <span className="wiki-thumb wiki-thumb-empty">
          <Icon name="book" size={16} />
        </span>
      )}
      <span className="wiki-row-body">
        <span className="wiki-row-text">{clip(data.extract, 140)}</span>
        <span className="wiki-row-more">Wikipedia <Icon name="external" size={11} /></span>
      </span>
    </a>
  )
}

// A bare photo (thumbnail) for a place — used inline in tight lists.
export function WikiThumb({ hint, size = 44, className }) {
  const [src, setSrc] = useState(null)
  const key = `${hint?.wikipedia || ''}|${hint?.name || ''}|${hint?.state || ''}`
  useEffect(() => {
    if (!hint?.name) return
    let live = true
    setSrc(null)
    wikiSummary(hint)
      .then((d) => live && d?.thumb && setSrc(d.thumb))
      .catch(() => {})
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  if (!src) return null
  return <img src={src} alt="" className={`wiki-thumb ${className || ''}`} style={{ width: size, height: size }} loading="lazy" />
}

function clip(s, n) {
  if (!s) return ''
  if (s.length <= n) return s
  const cut = s.slice(0, n)
  return cut.slice(0, cut.lastIndexOf(' ')) + '…'
}
