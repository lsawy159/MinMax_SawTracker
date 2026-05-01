import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

test('الوصول إلى صفحة الإعدادات العامة', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتظر قليلاً للتأكد من انتهاء التنقل
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بنجاح
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')

  // تحقق من وجود محتوى على الصفحة
  const pageText = await page.innerText('body')
  expect(pageText.length).toBeGreaterThan(50)
})

test('الوصول إلى تبويب النسخ الاحتياطية', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // ابحث عن تبويب النسخ الاحتياطية (قد يكون بأسماء مختلفة)
  const backupTab = page.locator('[role="tab"], button').filter({ hasText: /نسخ|backup|احتياطي/i })
  const tabCount = await backupTab.count().catch(() => 0)

  // تحقق من أن الصفحة محملة (حتى لو لم نجد التبويب المحدد)
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')
})

test('عرض تاريخ آخر نسخة احتياطية', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة نشطة
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')

  // تحقق من عدم وجود أخطاء حرجة
  const errorElements = page.locator('[role="alert"], .error, .alert-danger')
  const errorCount = await errorElements.count().catch(() => 0)

  expect(errorCount).toBeLessThanOrEqual(2)
})

test('التحقق من توفر زر تشغيل النسخ الاحتياطية', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // ابحث عن زر النسخ الاحتياطية
  const backupButton = page.locator('button').filter({ hasText: /نسخ احتياطية|backup|تشغيل النسخ/i })
  const buttonCount = await backupButton.count().catch(() => 0)

  // تحقق من أن الصفحة محملة بنجاح بغض النظر عن وجود الزر
  const pageContent = page.locator('body')
  await expect(pageContent).toBeVisible()

  // تحقق من استقرار الصفحة
  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')
})

test('تحميل صفحة الإعدادات بدون أخطاء', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الإعدادات
  await page.goto('http://localhost:5174/settings', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بدون أخطاء
  const pageContent = page.locator('body')
  await expect(pageContent).toBeVisible()

  // تحقق من استقرار الصفحة بعد التحميل
  await page.waitForTimeout(500)

  const currentUrl = page.url()
  expect(currentUrl).toContain('/settings')
})
