// 💡✨ --- إصلاح شامل لـ CI - نسخة 4 --- 💡✨
// إصلاح مشكلة webidl-conversions: "Cannot read properties of undefined (reading 'get')"
// المشكلة: webidl-conversions يحاول الوصول إلى Map.prototype.get أو WeakMap.prototype.get
// قبل تهيئة هذه الكائنات بشكل صحيح
// الحل: ضمان توفر Symbol, Map, Set, WeakMap, WeakSet على جميع الكائنات العامة قبل تحميل أي وحدات

(function() {
  'use strict'
  
  // Ensure Symbol exists
  if (typeof Symbol === 'undefined') {
    throw new Error('Symbol is not available in this environment. Node.js version may be too old.')
  }
  
  // Ensure Map exists
  if (typeof Map === 'undefined') {
    throw new Error('Map is not available in this environment. Node.js version may be too old.')
  }
  
  // Ensure Set exists
  if (typeof Set === 'undefined') {
    throw new Error('Set is not available in this environment. Node.js version may be too old.')
  }
  
  // Ensure WeakMap exists
  if (typeof WeakMap === 'undefined') {
    throw new Error('WeakMap is not available in this environment. Node.js version may be too old.')
  }
  
  // Ensure WeakSet exists
  if (typeof WeakSet === 'undefined') {
    throw new Error('WeakSet is not available in this environment. Node.js version may be too old.')
  }
  
  // Fix for Node.js global object
  if (typeof global !== 'undefined') {
    try {
      if (!global.Symbol) (global as any).Symbol = Symbol
      if (!global.Map) (global as any).Map = Map
      if (!global.Set) (global as any).Set = Set
      if (!global.WeakMap) (global as any).WeakMap = WeakMap
      if (!global.WeakSet) (global as any).WeakSet = WeakSet
    } catch (e) {
      // Ignore
    }
  }
  
  // Fix for globalThis
  if (typeof globalThis !== 'undefined') {
    try {
      if (!globalThis.Symbol) (globalThis as any).Symbol = Symbol
      if (!globalThis.Map) (globalThis as any).Map = Map
      if (!globalThis.Set) (globalThis as any).Set = Set
      if (!globalThis.WeakMap) (globalThis as any).WeakMap = WeakMap
      if (!globalThis.WeakSet) (globalThis as any).WeakSet = WeakSet
    } catch (e) {
      // Ignore
    }
  }
  
  // Ensure global.globalThis exists (for older Node.js)
  if (typeof global !== 'undefined' && typeof (global as any).globalThis === 'undefined') {
    try {
      (global as any).globalThis = global
    } catch (e) {
      // Ignore
    }
  }
})()
// 💡✨ --- نهاية الإصلاح --- 💡✨

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    // Ensure the Symbol polyfill/setup runs first, then register jest-dom matchers
    // setup-symbol ensures Symbol/Map/WeakMap etc exist very early
    // setup-tests registers @testing-library/jest-dom so toBeInTheDocument works
    setupFiles: ['src/test/setup-symbol.ts', 'src/test/setup-tests.ts'],

    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts,jsx,tsx}'],

    // Recommended for CI stability: disable worker threads when globals are sensitive
    threads: false,
    restoreMocks: true,
  },
})