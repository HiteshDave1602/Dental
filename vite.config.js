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
