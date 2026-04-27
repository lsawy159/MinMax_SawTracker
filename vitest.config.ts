// 💡✨ --- حل جذري نهائي: استخدام happy-dom بدلاً من jsdom --- 💡✨
// happy-dom لا يعتمد على webidl-conversions، مما يحل مشكلة "Cannot read properties of undefined (reading 'get')"
// happy-dom أسرع وأقل مشاكل من jsdom

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Alias lucide-react to a stub in tests to avoid React instance mismatch
    // lucide-react@1.11+ uses useContext internally which crashes without a provider
    alias: {
      'lucide-react': path.resolve(__dirname, 'src/__mocks__/lucide-react.tsx'),
    },
    // Ensure the Symbol polyfill/setup runs first, then register jest-dom matchers,
    // then register the unhandled-errors catcher. Order matters.
    setupFiles: [
      'src/test/setup-tests.ts',
      'src/test/test-handled-errors.ts'
    ],
    environment: 'happy-dom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    // Recommended for CI stability: disable worker threads when globals are sensitive
    threads: false,
    // Restore mocks between tests to avoid leaking state
    restoreMocks: true,
  },
})