import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const config = {
    plugins: [react()],
    base: '/',
  }

  // If we are building for production (GitHub Pages), use the repo name
  if (command !== 'serve') {
    config.base = '/caba-android-app/'
  }

  return config
})