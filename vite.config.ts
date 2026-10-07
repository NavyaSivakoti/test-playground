import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app is served from static hosting under /<repo>/. Override with BASE_PATH if the repo name differs.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/test-playground/',
  plugins: [react()],
  server: { port: 5199 },
  // All pages are eagerly registered (their meta drives routing and coverage); one bundle is expected.
  build: { chunkSizeWarningLimit: 2500 },
  preview: { port: 5198 },
})
