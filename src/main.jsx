import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './data/store.jsx'
import { ToastProvider } from './components/ui.jsx'
import { CelebrateProvider } from './components/Celebrate.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <ToastProvider>
        <CelebrateProvider>
          <App />
        </CelebrateProvider>
      </ToastProvider>
    </AppProvider>
  </React.StrictMode>
)

// Offline support (production builds only — the service worker is generated at
// build time with the asset list baked in). When a new version's worker takes
// over, reload once so updates appear on the first visit, not the second.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
    let hadController = !!navigator.serviceWorker.controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !window.__campkinReloaded) {
        window.__campkinReloaded = true
        window.location.reload()
      }
      hadController = true
    })
  })
}
