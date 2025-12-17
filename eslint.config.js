import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  // ✨ هذا هو التعديل: أضفنا 'coverage/' هنا ✨
  { ignores: ['dist', 'coverage/', '.dev-files/**', 'create_sample_companies.ts'] },
  
  // القواعد الافتراضية لجميع الملفات
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['warn', { 
        allow: ['warn', 'error'] // السماح فقط بـ console.warn و console.error
      }],
    },
  },
  
  // قواعد خاصة لـ Edge Functions و Scripts - تعطيل no-console
  {
    files: ['supabase/functions/**/*.ts', 'scripts/**/*.ts', 'src/scripts/**/*.ts'],
    rules: {
      'no-console': 'off', // Edge Functions و Scripts تحتاج console للتنقيح والمراقبة
    },
  },
  // قواعد خاصة بملفات الاختبارات - السماح بـ console و متغيرات غير مستخدمة
  {
    files: ['playwright-tests/**/*.ts', '**/*.spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off', // ملفات الاختبارات تستخدم console للمراقبة والتنقيح
      '@typescript-eslint/no-unused-vars': 'off', // متغيرات الاختبارات قد تكون غير مستخدمة أحياناً
      '@typescript-eslint/no-explicit-any': 'off', // الاختبارات قد تحتاج any
    },
  },)