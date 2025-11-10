// Fix Symbol issue before importing anything
if (typeof global !== 'undefined' && typeof global.Symbol === 'undefined' && typeof Symbol !== 'undefined') {
  (global as any).Symbol = Symbol
}
if (typeof globalThis !== 'undefined' && typeof globalThis.Symbol === 'undefined' && typeof Symbol !== 'undefined') {
  (globalThis as any).Symbol = Symbol
}

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './src/test/setup-symbol.ts', // Load Symbol fix first (before any modules)
      './src/test/setup.ts',        // Then load other setup
    ],
    css: true,
    // استخدام forks pool مع single fork لضمان تنفيذ setup في نفس العملية
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, // استخدام fork واحد فقط لضمان تنفيذ setup قبل تحميل الوحدات
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
