export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // ميزة جديدة
        'fix',      // إصلاح bug
        'docs',     // توثيق
        'style',    // تنسيق (لا يؤثر على الكود)
        'refactor', // إعادة هيكلة
        'perf',     // تحسين أداء
        'test',     // إضافة tests
        'chore',    // مهام صيانة
        'ci',       // تغييرات في CI
        'build',    // تغييرات في build system
        'revert',   // revert commit سابق
      ],
    ],
    // Scope اختياري - إذا كان موجوداً يجب أن يكون من القائمة
    'scope-enum': [
      2,
      'always',
      [
        'auth',
        'companies',
        'employees',
        'dashboard',
        'alerts',
        'notifications',
        'reports',
        'ui',
        'api',
        'deps',
        'config',
        'test',
      ],
    ],
    // السماح بـ commit بدون scope
    'scope-empty': [0, 'always'],
    'subject-case': [0],
  },
}
