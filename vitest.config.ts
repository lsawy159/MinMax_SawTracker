// 💡✨ --- إصلاح جذري لـ CI - نسخة 5 --- 💡✨
// إصلاح مشكلة webidl-conversions: "Cannot read properties of undefined (reading 'get')"
// المشكلة: webidl-conversions يحاول الوصول إلى Map.prototype.get أو WeakMap.prototype.get
// قبل تهيئة هذه الكائنات بشكل صحيح
// الحل الجذري: تحميل fix-globals.cjs مباشرة قبل أي imports
// هذا يضمن أن الإصلاح يتم قبل تحميل jsdom أو أي وحدات أخرى

// تحميل fix-globals.cjs مباشرة قبل أي imports
// هذا يعمل حتى في CI حيث NODE_OPTIONS مقيد
import { createRequire } from 'module'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

try {
  const require = createRequire(import.meta.url)
  require(resolve(__dirname, './scripts/fix-globals.cjs'))
} catch (e) {
  // إذا فشل require، نطبق الإصلاح مباشرة هنا
  if (typeof global !== 'undefined') {
    if (!global.Symbol && typeof Symbol !== 'undefined') (global as any).Symbol = Symbol
    if (!global.Map && typeof Map !== 'undefined') (global as any).Map = Map
    if (!global.Set && typeof Set !== 'undefined') (global as any).Set = Set
    if (!global.WeakMap && typeof WeakMap !== 'undefined') (global as any).WeakMap = WeakMap
    if (!global.WeakSet && typeof WeakSet !== 'undefined') (global as any).WeakSet = WeakSet
  }
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.Symbol && typeof Symbol !== 'undefined') (globalThis as any).Symbol = Symbol
    if (!globalThis.Map && typeof Map !== 'undefined') (globalThis as any).Map = Map
    if (!globalThis.Set && typeof Set !== 'undefined') (globalThis as any).Set = Set
    if (!globalThis.WeakMap && typeof WeakMap !== 'undefined') (globalThis as any).WeakMap = WeakMap
    if (!globalThis.WeakSet && typeof WeakSet !== 'undefined') (globalThis as any).WeakSet = WeakSet
  }
}
// 💡✨ --- نهاية الإصلاح --- 💡✨

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './vitest.setup.ts',    // المسار الصحيح لملف إعداد Symbol
      './src/test/setup.ts',    // ملف الإعداد الإضافي (إذا كان موجوداً)
    ],
    css: true,
    // استخدام forks pool مع single fork لضمان تنفيذ setup في نفس العملية
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true, 
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