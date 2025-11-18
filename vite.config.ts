import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, Plugin } from "vite"
import sourceIdentifierPlugin from 'vite-plugin-source-identifier'

const isProd = process.env.BUILD_MODE === 'prod'

// Plugin to add modulepreload links for react-vendor chunk
// This ensures react-vendor is loaded before main chunk to avoid TDZ errors
function modulePreloadPlugin(): Plugin {
  return {
    name: 'module-preload',
    apply: 'build',
    transformIndexHtml(html: string, ctx?: { bundle?: Record<string, { type?: string; name?: string; fileName?: string }> }) {
      if (!ctx?.bundle) return html
      
      // Find react-vendor chunk
      const reactVendorChunk = Object.values(ctx.bundle).find(
        (chunk): chunk is { type: string; name: string; fileName: string } => 
          chunk.type === 'chunk' && chunk.name === 'react-vendor'
      )
      
      if (!reactVendorChunk?.fileName) return html
      
      const reactVendorPath = reactVendorChunk.fileName
      const scriptTagIndex = html.indexOf('<script type="module"')
      
      if (scriptTagIndex === -1) return html
      
      // Check if react-vendor modulepreload already exists before script tag
      const beforeScript = html.slice(0, scriptTagIndex)
      if (beforeScript.includes(`href="/${reactVendorPath}"`)) {
        // Already exists before script, no need to add
        return html
      }
      
      // Remove any existing react-vendor modulepreload links (after script tag)
      const afterScript = html.slice(scriptTagIndex)
      const linkPattern = new RegExp(`<link[^>]*href="/${reactVendorPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>\\s*`, 'g')
      const cleanedAfterScript = afterScript.replace(linkPattern, '')
      
      // Add modulepreload link before script tag
      const preloadLink = `  <link rel="modulepreload" href="/${reactVendorPath}" />\n`
      return beforeScript + preloadLink + cleanedAfterScript
    },
  }
}

export default defineConfig({
  plugins: [
    react(), 
    sourceIdentifierPlugin({
      enabled: !isProd,
      attributePrefix: 'data-matrix',
      includeProps: true,
    }),
    modulePreloadPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    // Ensure single instance of React to avoid TDZ issues
    // Note: scheduler is NOT in dedupe as it's an internal React dependency
    // It will be handled automatically via manualChunks to ensure it's in the same chunk as React
    dedupe: ['react', 'react-dom'],
  },
  build: {
    target: 'es2020',
    // Use terser with optimized settings to avoid TDZ errors
    // Disabled reduce_vars and reduce_funcs to prevent variable reduction that causes TDZ
    minify: 'terser',
    terserOptions: {
      keep_classnames: true,
      keep_fnames: true,
      compress: {
        drop_console: false,
        drop_debugger: true,
        // Disable optimizations that cause TDZ errors
        reduce_vars: false,  // Important: prevents variable reduction that causes TDZ
        reduce_funcs: false, // Prevents function reduction
        collapse_vars: false, // Prevents variable collapsing
        inline: false, // Prevents code inlining
      },
      mangle: {
        // Disable aggressive mangling to avoid TDZ
        keep_classnames: true,
        keep_fnames: true,
        reserved: ['React', 'ReactDOM', 'a', 'b', 'c', 'd', 'e', 'f'], // Reserve common minified names
      },
      format: {
        comments: false,
      },
    },
    cssCodeSplit: true,
    sourcemap: !isProd,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      // Preserve entry signatures to ensure correct module ordering
      // This helps prevent TDZ issues by maintaining import order
      preserveEntrySignatures: 'allow-extension',
      output: {
        manualChunks: (id) => {
          // Don't separate React from main chunk to avoid TDZ errors
          // React, React-DOM, Scheduler, and React Router should stay in main chunk
          // This ensures React is loaded before any code tries to use it
          if (
            id.includes('node_modules/react') || 
            id.includes('node_modules/react-dom') || 
            id.includes('node_modules/react-router') ||
            id.includes('node_modules/scheduler')
          ) {
            return undefined  // Leave in main chunk
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
    // Ensure proper CommonJS handling to avoid TDZ issues
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
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
    // Ensure proper order of dependency resolution
    // Note: scheduler is NOT included here as it's an internal React dependency
    // It will be loaded automatically with React and handled via dedupe and manualChunks
    esbuildOptions: {
      target: 'es2020',
    },
  },
})

