import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // base: '/caba-android-app/', // Commented out for local development
  plugins: [
    react(),
  ],
})