import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  // Explicitly set the build target to avoid old browser polyfills issues
  build: {
    target: 'esnext',
    minify: 'esbuild',
  },
})
