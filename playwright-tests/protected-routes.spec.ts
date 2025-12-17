import { test, expect } from '@playwright/test';

test('محاولة فتح /dashboard بدون تسجيل دخول تعيد التوجيه إلى /login', async ({ page }) => {
  // حاول الوصول مباشرة إلى dashboard بدون تسجيل دخول
  await page.goto('http://localhost:5174/dashboard');

  // انتظ قليلاً للتحقق من الـ redirect
  await page.waitForTimeout(1000);

  // تحقق من أنك تم إعادة التوجيه إلى /login
  await expect(page).toHaveURL(/\/login$/);

  // تحقق من أن صفحة login مرئية
  await expect(page.locator('text=تسجيل الدخول')).toBeVisible();
});

test('محاولة فتح صفحات محمية أخرى بدون تسجيل دخول', async ({ page }) => {
  // اختبر عدة صفحات محمية
  const protectedRoutes = ['/companies', '/employees', '/alerts'];

  for (const route of protectedRoutes) {
    await page.goto(`http://localhost:5174${route}`);
    await page.waitForTimeout(500);
    
    // يجب أن يتم إعادة التوجيه إلى /login
    const url = page.url();
    expect(url).toContain('/login');
  }
});
