import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AppProvider } from './data/store.jsx'
import { ToastProvider } from './components/ui.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </AppProvider>
  </React.StrictMode>
)

// Offline support (production builds only — the service worker is generated at
// build time with the asset list baked in).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + 'sw.js').catch(() => {})
  })
}
