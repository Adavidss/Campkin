import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Campkin is served from https://adavidss.github.io/Campkin/ (and any custom
// domain under /Campkin/), so the base path must never be assumed to be "/".
export default defineConfig({
  base: '/Campkin/',
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  server: { port: 3160, strictPort: true },
  preview: { port: 3160, strictPort: true },
})
