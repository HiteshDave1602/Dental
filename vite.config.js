import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5174,
    // Fail loudly if 5174 is taken instead of silently moving to the next free
    // port. A different port is a different origin, which the /api proxy below
    // doesn't fix by itself for anything that bypasses it (see assetUrl in
    // src/Script/api.js) — better to see "port in use" than a mystery CORS error.
    strictPort: true,
    // The live API permits the deployed frontend origin but rejects localhost.
    // During local development Vite forwards same-origin /api requests to it,
    // so the browser never makes a cross-origin request.
    proxy: {
      '/api': {
        target: 'https://mypathfinder-api.duckdns.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
