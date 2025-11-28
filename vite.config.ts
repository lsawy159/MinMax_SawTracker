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
  server: {
    port: 5174,
    strictPort: true,
    host: '0.0.0.0',
    cors: true,  // ← إضافة مهمة لـ TestSprite
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5174,
      clientPort: 5174  // ← إضافة مهمة
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - React core libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'vendor'
          }
          
          // Radix UI components
          if (id.includes('node_modules/@radix-ui')) {
            return 'radix-ui'
          }
          
          // Chart libraries
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/react-chartjs-2') || id.includes('node_modules/recharts')) {
            return 'charts'
          }
          
          // Excel and export libraries
          if (id.includes('node_modules/xlsx') || id.includes('node_modules/file-saver')) {
            return 'excel-export'
          }
          
          // Utility libraries
          if (id.includes('node_modules/fuse.js') || id.includes('node_modules/date-fns') || id.includes('node_modules/hijri-converter')) {
            return 'utils'
          }
          
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          
          // Other large node_modules
          if (id.includes('node_modules')) {
            return 'vendor-other'
          }
        },
      },
    },
  },
})
