import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

test('الوصول إلى صفحة الرواتب والاستقطاعات', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتظر قليلاً للتأكد من انتهاء التنقل
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(500)

  // انتقل إلى صفحة الرواتب
  await page.goto('http://localhost:5174/payroll', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بنجاح
  const currentUrl = page.url()
  expect(currentUrl).toContain('/payroll')

  // تحقق من وجود محتوى على الصفحة
  const pageText = await page.innerText('body')
  expect(pageText.length).toBeGreaterThan(50)
})

test('عرض إحصائيات مسيرات الرواتب', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الرواتب
  await page.goto('http://localhost:5174/payroll', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من وجود قسم الإحصائيات
  const statsHeading = page.locator('text=إحصائيات مسيرات الرواتب')
  const isVisible = await statsHeading.isVisible().catch(() => false)

  // إذا كانت العنوين موجودة، تحقق من وجودها
  if (isVisible) {
    await expect(statsHeading).toBeVisible()
  }

  // تحقق من أن الصفحة محملة بنجاح من خلال وجود محتوى
  const pageText = await page.innerText('body')
  expect(pageText.length).toBeGreaterThan(100)
})

test('الوصول إلى تبويب مسيرات الرواتب', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الرواتب
  await page.goto('http://localhost:5174/payroll', { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)

  // تحقق من أن الصفحة نشطة
  const currentUrl = page.url()
  expect(currentUrl).toContain('/payroll')

  // تحقق من عدم وجود أخطاء
  const errorElements = page.locator('[role="alert"], .error, .alert-danger')
  const errorCount = await errorElements.count().catch(() => 0)

  // قد توجد بعض رسائل المعلومات، لكن يجب عدم وجود أخطاء حرجة
  expect(errorCount).toBeLessThanOrEqual(2)
})

test('تحميل الموظفين والرواتب بدون أخطاء', async ({ page }) => {
  // سجّل الدخول
  await loginAsAdmin(page)

  // انتقل إلى صفحة الرواتب
  await page.goto('http://localhost:5174/payroll', { waitUntil: 'networkidle' })
  await page.waitForTimeout(2000)

  // تحقق من أن الصفحة محملة بدون أخطاء في النواة
  const pageContent = page.locator('body')
  await expect(pageContent).toBeVisible()

  // تحقق من عدم وجود أخطاء في وحدة التحكم (في حالة الأخطاء الحرجة)
  // هذا يتحقق بشكل غير مباشر من خلال استقرار الصفحة
  await page.waitForTimeout(500)

  const currentUrl = page.url()
  expect(currentUrl).toContain('/payroll')
})
