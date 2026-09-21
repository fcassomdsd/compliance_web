import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(), // The official plugin for Vue 3 support
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Optional: Set the base path if you deploy to a non-root path (e.g., GitHub Pages)
  // base: '/aviation-safety-compliance-system/', 
  
  // Optional: Customize development server options
  server: {
    port: 3000, // Use a custom port for the dev server
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: process.env.VITE_API_PROXY_TARGET || process.env.VITE_AUTH_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
      // Same-origin Node-RED access in development, mirroring the nginx route
      // used in production. It targets the app server (not Node-RED itself) for
      // the same reason production does: a gateway call has to carry the app
      // session, the API key and the specialty-scope check. No rewrite — the app
      // server owns the /nodered prefix and strips it before forwarding.
      '/nodered': {
        target: process.env.VITE_API_PROXY_TARGET || process.env.VITE_AUTH_PROXY_TARGET || 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
