import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Dev server runs on 5173 and talks to the FastAPI backend directly (see CORS_ORIGINS in the root .env).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
  test: { environment: 'node', setupFiles: ['./tests/setup.js'] },
})
