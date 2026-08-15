// Daily forecasts from Open-Meteo — free, keyless, CORS-friendly.
// Forecasts reach ~16 days out; beyond that Campkin says so instead of guessing.

export const FORECAST_DAYS = 16

import { cacheGet, cacheSet, dedupe, HOUR } from './netcache.js'

export async function fetchForecast(lat, lon, { signal } = {}) {
  const key = `wx:${lat.toFixed(2)},${lon.toFixed(2)}`
  const hit = await cacheGet(key, HOUR)
  if (hit) return hit
  return dedupe(key, () => fetchForecastRaw(lat, lon, key, signal))
}

async function fetchForecastRaw(lat, lon, key, signal) {

  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max' +
    '&temperature_unit=fahrenheit&wind_speed_unit=mph' +
    `&timezone=auto&forecast_days=${FORECAST_DAYS}`
  const timeout = AbortSignal.timeout(12000)
  const resp = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout })
  if (!resp.ok) throw new Error('The forecast service is unavailable right now.')
  const data = await resp.json()
  const d = data.daily || {}
  const days = (d.time || []).map((date, i) => ({
    date,
    code: d.weather_code?.[i] ?? null,
    hi: Math.round(d.temperature_2m_max?.[i] ?? 0),
    lo: Math.round(d.temperature_2m_min?.[i] ?? 0),
    precip: d.precipitation_probability_max?.[i] ?? null,
    wind: Math.round(d.wind_speed_10m_max?.[i] ?? 0),
  }))
  await cacheSet(key, days)
  return days
}

// WMO weather codes → icon + label
export function weatherMeta(code) {
  if (code === 0) return { icon: 'sun', label: 'Clear' }
  if (code === 1) return { icon: 'sun', label: 'Mostly clear' }
  if (code === 2) return { icon: 'cloud', label: 'Partly cloudy' }
  if (code === 3) return { icon: 'cloud', label: 'Overcast' }
  if (code === 45 || code === 48) return { icon: 'fog', label: 'Fog' }
  if (code >= 51 && code <= 57) return { icon: 'rain', label: 'Drizzle' }
  if (code >= 61 && code <= 67) return { icon: 'rain', label: 'Rain' }
  if (code >= 71 && code <= 77) return { icon: 'snow', label: 'Snow' }
  if (code >= 80 && code <= 82) return { icon: 'rain', label: 'Showers' }
  if (code === 85 || code === 86) return { icon: 'snow', label: 'Snow showers' }
  if (code >= 95) return { icon: 'storm', label: 'T-storms' }
  return { icon: 'cloud', label: 'Weather' }
}

// Winds an RVer should actually care about (awnings, high-profile driving).
export const RV_WIND_MPH = 25
