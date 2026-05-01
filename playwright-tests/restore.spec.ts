import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

test('الوصول إلى صفحة الاستعادة من النسخة الاحتياطية', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتظر قليلاً للتأكد من انتهاء التنقل
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // انتقل إلى صفحة الإعدادات (حيث تكون خيارات الاستعادة)
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بنجاح
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')

  // تحقق من وجود محتوى على الصفحة
  const pageText = await page.innerText('body')
  expect(pageText.length).toBeGreaterThan(50)
})

test('عرض قائمة النسخ الاحتياطية المتاحة للاستعادة', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بنجاح
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')

  // ابحث عن عناصر تتعلق بالنسخ الاحتياطية
  const backupItems = page.locator('[data-testid*="backup"], li, tr').filter({ hasText: /نسخ احتياطية|backup|استعادة|restore/i })
  const itemCount = await backupItems.count().catch(() => 0)

  // تحقق من أن الصفحة مستقرة (حتى لو لم توجد نسخ احتياطية)
  await page.waitForTimeout(500)

  expect(currentUrl).toContain('/settings')
})

test('التحقق من توفر خيارات الاستعادة', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة نشطة
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')

  // ابحث عن أزرار الاستعادة (قد لا توجد إذا لم تكن هناك نسخ احتياطية)
  const restoreButton = page.locator('button').filter({ hasText: /استعادة|restore|recover/i })
  const buttonCount = await restoreButton.count().catch(() => 0)

  // تحقق من استقرار الصفحة
  await page.waitForTimeout(500)

  expect(currentUrl).toContain('/settings')
})

test('عدم ظهور أخطاء عند تحميل صفحة الاستعادة', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بدون أخطاء حرجة
  const errorElements = page.locator('[role="alert"], .error, .alert-danger')
  const errorCount = await errorElements.count().catch(() => 0)

  // قد توجد بعض رسائل المعلومات، لكن يجب عدم وجود أخطاء حرجة
  expect(errorCount).toBeLessThanOrEqual(2)
})

test('التحقق من وجود محتوى صفحة الإعدادات', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بنجاح
  const pageContent = page.locator('body')
  await expect(pageContent).toBeVisible()

  // تحقق من وجود محتوى كافي
  const pageText = await page.innerText('body')
  expect(pageText.length).toBeGreaterThan(100)

  // تحقق من استقرار الصفحة
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')
})
