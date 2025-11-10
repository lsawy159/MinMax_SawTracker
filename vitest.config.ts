// تم إزالة الـ Polyfill اليدوي من هنا لأنه يُحمّل الآن عبر setupFiles

import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
// 'vite-plugin-source-identifier' غير مستخدم هنا، يمكن إزالته
// import { sourceIdentifierPlugin } from 'vite-plugin-source-identifier' 

export default defineConfig({
  plugins: [react()],
  test: { // هذه هي الكتلة الوحيدة والصحيحة للإعدادات
    globals: true,
    environment: 'jsdom',
    setupFiles: [
      './vitest.setup.ts',    // المسار الصحيح لملف إعداد Symbol
      './src/test/setup.ts',    // ملف الإعداد الإضافي
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
  // تم حذف كتلة test: { ... } المكررة من هنا
})