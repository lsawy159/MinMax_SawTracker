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
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      'scheduler',
    ],
    exclude: ['@vite/client', '@vite/env'],
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
    },
    // تعطيل caching في development
    middlewareMode: false,
    fs: {
      strict: false,
    }
  },
  build: {
    target: 'esnext',
    minify: 'esbuild', // استخدام esbuild للـ minification
    rollupOptions: {
      preserveEntrySignatures: 'strict', // الحفاظ على توقيعات الدخول
      output: {
        // تحسين تقسيم الحزم لتجنب مشاكل التهيئة
        manualChunks: (id) => {
          // React core - يجب أن يكون أولاً ومنفصلاً تماماً
          // يشمل React, ReactDOM, و React internals (scheduler, etc.)
          if (
            id.includes('node_modules/react/') || 
            id.includes('node_modules/react-dom/') ||
            id.includes('node_modules/scheduler/') ||
            id.includes('node_modules/object-assign/') ||
            (id.includes('node_modules') && id.includes('react') && !id.includes('react-router'))
          ) {
            return 'vendor-react'
          }
          
          // React Router - منفصل عن React
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router'
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
          
          // Utility libraries - تجميعها معاً
          if (id.includes('node_modules/fuse.js') || id.includes('node_modules/date-fns') || id.includes('node_modules/hijri-converter')) {
            return 'utils'
          }
          
          // Supabase
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          
          // Form libraries
          if (id.includes('node_modules/react-hook-form') || id.includes('node_modules/@hookform')) {
            return 'forms'
          }
          
          // UI libraries
          if (id.includes('node_modules/lucide-react') || id.includes('node_modules/sonner') || id.includes('node_modules/cmdk')) {
            return 'ui-libs'
          }
          
          // Zod validation
          if (id.includes('node_modules/zod')) {
            return 'zod'
          }
          
          // Class variance and styling
          if (id.includes('node_modules/class-variance-authority') || id.includes('node_modules/clsx') || id.includes('node_modules/tailwind-merge')) {
            return 'styling'
          }
          
          // Other node_modules - تقسيم أفضل لتجنب circular dependencies
          if (id.includes('node_modules')) {
            // تجنب تقسيم vendor-other بشكل كبير جداً لتجنب مشاكل التهيئة
            // تجميع معظم الحزم الصغيرة في vendor-other
            return 'vendor-other'
          }
        },
        // تحسين تنسيق الأسماء لتجنب التضارب
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
    // إضافة إعدادات إضافية لتحسين البناء
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    // زيادة الحد الأقصى لحجم التحذيرات
    chunkSizeWarningLimit: 1000,
  },
})
