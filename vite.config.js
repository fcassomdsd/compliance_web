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
  },
})
