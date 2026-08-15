import React, { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import { Card } from './ui.jsx'
import { fetchForecast, weatherMeta, RV_WIND_MPH, FORECAST_DAYS } from '../lib/weather.js'
import { geocodePlace } from '../lib/osm.js'
import { parseISO, toISO, todayISO, fmtDate } from '../lib/dates.js'
import { useApp } from '../data/store.jsx'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Forecast for the campground (or destination) across the trip's dates.
export default function TripWeather({ trip, cg }) {
  const { state } = useApp()
  const [status, setStatus] = useState('loading') // loading | ready | error | nowhere
  const [days, setDays] = useState([])
  const [placeLabel, setPlaceLabel] = useState('')

  useEffect(() => {
    let live = true
    async function load() {
      setStatus('loading')
      try {
        let lat = cg?.lat
        let lon = cg?.lon
        let label = cg?.name
        if (lat == null) {
          const q = cg?.address || trip.destination
          if (!q) {
            if (live) setStatus('nowhere')
            return
          }
          const place = await geocodePlace(q)
          if (!place) {
            if (live) setStatus('nowhere')
            return
          }
          lat = place.lat
          lon = place.lon
          label = label || place.label
        }
        const all = await fetchForecast(lat, lon)
        if (!live) return
        setPlaceLabel(label || 'the campground')
        setDays(all)
        setStatus('ready')
      } catch (err) {
        console.error(err)
        if (live) setStatus('error')
      }
    }
    load()
    return () => {
      live = false
    }
  }, [trip.id, trip.destination, cg?.lat, cg?.lon, cg?.address])

  if (status === 'nowhere') return null

  const today = todayISO()
  const start = trip.startDate || today
  const end = trip.endDate || start
  const inTrip = days.filter((d) => d.date >= start && d.date <= end)
  const windy = inTrip.some((d) => d.wind >= RV_WIND_MPH)
  const rvMode = state.settings.rvMode

  return (
    <Card style={{ padding: '14px 16px' }}>
      {status === 'loading' && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>Checking the forecast…</p>
      )}
      {status === 'error' && (
        <p style={{ fontSize: 13.5, color: 'var(--ink-faint)' }}>
          The forecast couldn’t be reached — it’ll try again next time you open the trip.
        </p>
      )}
      {status === 'ready' && inTrip.length === 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <Icon name="cloud" size={18} style={{ color: 'var(--ink-faint)', marginTop: 1 }} />
          <p style={{ fontSize: 13.5, color: 'var(--ink-faint)', lineHeight: 1.5 }}>
            {start > today
              ? `The forecast for ${placeLabel} opens about ${FORECAST_DAYS} days out — check back around ${fmtDate(forecastOpens(start))}.`
              : 'These dates are outside the forecast window.'}
          </p>
        </div>
      )}
      {status === 'ready' && inTrip.length > 0 && (
        <>
          <div className="weather-rows">
            {inTrip.map((d) => {
              const meta = weatherMeta(d.code)
              const wd = WEEKDAYS[parseISO(d.date).getDay()]
              return (
                <div key={d.date} className="weather-row">
                  <span className="wx-day">
                    {wd} <span className="wx-date">{parseISO(d.date).getDate()}</span>
                  </span>
                  <span className="wx-icon" title={meta.label}>
                    <Icon name={meta.icon} size={19} />
                  </span>
                  <span className="wx-label">{meta.label}</span>
                  <span className="wx-precip">{d.precip != null && d.precip >= 15 ? `${d.precip}%` : ''}</span>
                  <span className="wx-temp">
                    {d.hi}° <span className="wx-lo">{d.lo}°</span>
                  </span>
                </div>
              )
            })}
          </div>
          {inTrip.length < tripDayCount(start, end) && (
            <p style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 8 }}>
              Later days will appear as the forecast window reaches them.
            </p>
          )}
          {windy && rvMode && (
            <div className="rv-fit-note is-tight" style={{ marginTop: 10 }}>
              <Icon name="wind" size={16} />
              Gusty days ahead — mind the awning and plan extra time driving high-profile.
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function forecastOpens(startISO) {
  const d = parseISO(startISO)
  d.setDate(d.getDate() - (FORECAST_DAYS - 1))
  return toISO(d)
}

function tripDayCount(start, end) {
  return Math.round((parseISO(end) - parseISO(start)) / 86400000) + 1
}
