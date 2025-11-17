import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'
export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    })
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: !isProd,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // React vendor chunk
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) {
            return 'react-vendor'
          }
          
          // UI vendor chunk (Radix UI components)
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-vendor'
          }
          
          // Charts vendor chunk
          if (id.includes('node_modules/chart.js') || id.includes('node_modules/recharts') || id.includes('node_modules/react-chartjs-2')) {
            return 'charts-vendor'
          }
          
          // Supabase vendor chunk
          if (id.includes('node_modules/@supabase')) {
            return 'supabase-vendor'
          }
          
          // Utils vendor chunk
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/clsx') || id.includes('node_modules/fuse.js') || id.includes('node_modules/tailwind-merge')) {
            return 'utils-vendor'
          }
          
          // Form libraries
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform') || id.includes('node_modules/zod')) {
            return 'form-vendor'
          }
          
          // Icons library
          if (id.includes('node_modules/lucide-react')) {
            return 'icons-vendor'
          }
          
          // Other large dependencies
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
        // Improve caching with content hash
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.css')) {
            return 'assets/css/[name]-[hash][extname]'
          }
          return 'assets/[ext]/[name]-[hash][extname]'
        },
      },
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
    ],
    exclude: ['@vite/client', '@vite/env'],
  },
})

