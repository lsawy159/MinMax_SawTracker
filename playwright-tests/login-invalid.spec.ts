import { test, expect } from '@playwright/test';

test('رفض تسجيل الدخول عند إدخال كلمة مرور خاطئة مع إظهار رسالة خطأ', async ({ page }) => {
  // افتح صفحة تسجيل الدخول
  await page.goto('http://localhost:5174/login');

  // اكتب الإيميل الصحيح
  await page.fill('input[type="email"]', 'admin@sawtracker.com');

  // اكتب كلمة مرور خاطئة
  await page.fill('input[type="password"]', 'wrongpassword123');

  // اضغط زر تسجيل الدخول
  await page.click('button:has-text("تسجيل الدخول")');

  // انتظر قليلاً لمعالجة الخطأ
  await page.waitForTimeout(1500);

  // تحقق من أن المستخدم بقي على صفحة /login (فشل تسجيل الدخول)
  await expect(page).toHaveURL(/\/login$/);

  // تحقق من ظهور رسالة الخطأ الصحيحة
  await expect(page.locator('text=البريد الإلكتروني أو كلمة المرور غير صحيحة')).toBeVisible();
});
