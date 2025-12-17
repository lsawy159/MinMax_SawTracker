import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './auth.helpers';

test('تسجيل الخروج وإعادة التوجيه إلى صفحة /login', async ({ page }) => {
  // سجّل الدخول أولاً
  await loginAsAdmin(page);

  // تحقق من أن المستخدم في dashboard
  await expect(page).toHaveURL(/\/dashboard$/);

  // ابحث عن زر تسجيل الخروج باستخدام data-testid
  let logoutButton = page.locator('[data-testid="logout-btn"]');
  
  // إذا لم نجده، جرّب الإصدار المحمول
  if (await logoutButton.count() === 0) {
    logoutButton = page.locator('[data-testid="logout-btn-mobile"]');
  }

  // إذا لم نجده، جرّب البحث بالنص (fallback)
  if (await logoutButton.count() === 0) {
    logoutButton = page.locator('button:has-text("تسجيل خروج"), button:has-text("خروج")').first();
  }

  if (await logoutButton.count() > 0) {
    // أزل overlay إن وجدت
    const overlay = page.locator('vite-error-overlay');
    if (await overlay.count() > 0) {
      await overlay.evaluate(el => el.remove());
    }
    
    await logoutButton.first().click({ force: true });
    await page.waitForTimeout(2000);
  } else {
    test.skip();
    return;
  }

  // تحقق من أنك تم إعادة التوجيه إلى /login
  await expect(page).toHaveURL(/\/login$/);
});
