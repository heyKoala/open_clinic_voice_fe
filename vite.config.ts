import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Allow sharing the dev server through a tunnel (e.g. https://<id>-5173.inc1.devtunnels.ms).
    allowedHosts: ['.devtunnels.ms'],
    proxy: {
      // The browser only ever talks to this server; API and media go on to the backend. This keeps
      // the app working when opened from another machine via a tunnel (its "localhost" isn't ours).
      '/api': { target: 'http://localhost:8001' },
      '/media': { target: 'http://localhost:8001' },
      '/ws': {
        target: 'ws://localhost:8001',
        ws: true,
        // Suppress noisy ECONNABORTED errors from websocket proxying
        configure: (proxy, _options) => {
          proxy.on('error', (err: any, _req, _res) => {
            if (err.code === 'ECONNABORTED') return;
            console.log('proxy error', err);
          });
        }
      }
    }
  }
})
