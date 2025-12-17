import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './auth.helpers';

test('المستخدم يسجّل الدخول ويصل للوحة التحكم', async ({ page }) => {
  // افتح صفحة تسجيل الدخول
  await page.goto('http://localhost:5174/login');

  // سجّل الدخول كمسؤول
  await loginAsAdmin(page);

  // تحقق من التحويل إلى /dashboard
  const url = page.url();
  expect(url).toContain('/dashboard');
});
