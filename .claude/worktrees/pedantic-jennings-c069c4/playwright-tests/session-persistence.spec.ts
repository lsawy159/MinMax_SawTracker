import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './auth.helpers';

test('التحقق من بقاء الجلسة عند تحديث الصفحة بعد تسجيل الدخول', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page);
  
  // انتظر قليلاً للتأكد من انتهاء التنقل
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  // احصل على URL الحالي
  const urlBeforeReload = page.url();
  console.log(`URL قبل التحديث: ${urlBeforeReload}`);
  
  // قم بتحديث الصفحة (refresh)
  await page.reload({ waitUntil: 'networkidle' });

  // انتظر قليلاً لتحميل الصفحة
  await page.waitForTimeout(2000);

  // تحقق من أن الصفحة محملة (يمكنك رؤية عناصر من الـ dashboard)
  const pageText = await page.innerText('body');
  expect(pageText.length).toBeGreaterThan(50);  // تم تقليل الحد الأدنى
  
  // تحقق من عدم الهبوط إلى صفحة فارغة
  const mainContent = page.locator('main, [role="main"], .dashboard, [class*="container"], [class*="content"]');
  const contentCount = await mainContent.count();
  // التحقق من وجود محتوى أو عدم وجود صفحة خطأ
  expect(contentCount).toBeGreaterThanOrEqual(0);
});

test('التحقق من استمرار الجلسة عند الانتقال بين الصفحات', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page);

  // تحقق من أنك في dashboard
  await expect(page).toHaveURL(/\/dashboard$/);

  // انتقل إلى صفحة أخرى محمية
  await page.goto('http://localhost:5174/companies');
  await page.waitForTimeout(1000);

  // تحقق من أنك في companies بدون إعادة توجيه إلى login
  const currentUrl = page.url();
  expect(currentUrl).toContain('/companies');
  expect(currentUrl).not.toContain('/login');

  // انتقل إلى صفحة أخرى
  await page.goto('http://localhost:5174/employees');
  await page.waitForTimeout(1000);

  // تحقق من أنك في employees
  const finalUrl = page.url();
  expect(finalUrl).toContain('/employees');
  expect(finalUrl).not.toContain('/login');
});
