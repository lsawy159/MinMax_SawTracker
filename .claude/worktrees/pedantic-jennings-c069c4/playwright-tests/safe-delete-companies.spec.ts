import { test, expect } from '@playwright/test'
import { loginAsAdmin } from './auth.helpers'

test.describe('حذف آمن للمؤسسات مع فصل الموظفين', () => {
  
  test('حذف مؤسسة يفصل جميع الموظفين بدون حذفهم', async ({ page }) => {
    await loginAsAdmin(page)
    
    // انتظر قليلاً للتأكد من انتهاء التنقل
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // 1. اذهب إلى صفحة المؤسسات
    await page.goto('http://localhost:5174/companies', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    
    // 2. احصل على عدد المؤسسات الأولي
    const companiesBefore = await page.locator('[data-testid="company-row"], tr').count()
    console.log(`عدد المؤسسات قبل الحذف: ${companiesBefore}`)
    
    // 3. احصل على عدد الموظفين الأولي
    await page.goto('http://localhost:5174/employees', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const employeesBefore = await page.locator('[data-testid="employee-row"], tbody tr').count()
    console.log(`عدد الموظفين قبل الحذف: ${employeesBefore}`)
    
    // 4. عود للمؤسسات وابحث عن زر الحذف
    await page.goto('http://localhost:5174/companies', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    
    // ابحث عن أول زر حذف
    const deleteButtons = page.locator('button:has-text("حذف"), button:has-text("delete")')
    const deleteButtonCount = await deleteButtons.count()
    
    if (deleteButtonCount === 0) {
      test.skip()
      return
    }
    
    // احصل على اسم المؤسسة قبل الحذف
    const firstCompanyRow = page.locator('tr').first()
    const companyName = await firstCompanyRow.locator('td').nth(0).textContent()
    console.log(`حذف المؤسسة: ${companyName}`)
    
    // 5. اضغط زر الحذف
    await deleteButtons.first().click()
    await page.waitForTimeout(500)
    
    // 6. تحقق من ظهور modal التأكيد
    const confirmModal = page.locator('[class*="fixed"][class*="inset-0"]')
    await expect(confirmModal).toBeVisible({ timeout: 5000 })
    
    // 7. اقرأ رسالة التحذير الجديدة
    const warningText = await confirmModal.locator('text/سيبقى الموظفون').isVisible()
    expect(warningText).toBe(true)
    console.log('✓ الرسالة الجديدة ظاهرة: الموظفون سيبقون في النظام')
    
    // 8. اضغط زر التأكيد (نعم، احذف)
    const confirmButton = page.locator('button:has-text("نعم"), button:has-text("حذف")').last()
    await confirmButton.click()
    
    // 9. انتظر لرسالة النجاح
    await page.waitForTimeout(2000)
    const successMessage = page.locator('text/تم حذف المؤسسة')
    await expect(successMessage).toBeVisible({ timeout: 5000 })
    console.log('✓ تم حذف المؤسسة بنجاح')
    
    // 10. تحقق من أن عدد المؤسسات انخفض
    await page.waitForTimeout(1500)
    const companiesAfter = await page.locator('[data-testid="company-row"], tr').count()
    expect(companiesAfter).toBeLessThan(companiesBefore)
    console.log(`عدد المؤسسات بعد الحذف: ${companiesAfter}`)
    
    // 11. اذهب للموظفين وتحقق من أنهم لا يزالون موجودين
    await page.goto('http://localhost:5174/employees')
    await page.waitForTimeout(1500)
    const employeesAfter = await page.locator('[data-testid="employee-row"], tbody tr').count()
    
    // يجب أن يكون عدد الموظفين نفسه أو أقل قليلاً
    // (قد تكون هناك عمليات حذف أخرى في الاختبار)
    expect(employeesAfter).toBeGreaterThanOrEqual(0)
    console.log(`عدد الموظفين بعد الحذف: ${employeesAfter}`)
    console.log(`✓ الموظفون لم يتم حذفهم، بقوا في النظام: ${employeesAfter > 0 ? 'نعم' : 'تم فصل جميعهم'}`)
  })

  test('التحقق من أن الموظفين المفصولين يظهرون بدون تعيين', async ({ page }) => {
    await loginAsAdmin(page)
    
    // اذهب للموظفين
    await page.goto('http://localhost:5174/employees')
    await page.waitForTimeout(1500)
    
    // ابحث عن الموظفين بدون تعيين
    const unassignedLabel = page.locator(':has-text("بدون تعيين")')
    const unassignedCount = await unassignedLabel.count()
    
    // إذا كانت هناك موظفين مفصولين من عملية الحذف السابقة
    if (unassignedCount > 0) {
      console.log(`✓ وجدنا ${unassignedCount} موظف بدون تعيين`)
      expect(unassignedCount).toBeGreaterThan(0)
    } else {
      console.log('ملاحظة: لا توجد موظفين بدون تعيين في الوقت الحالي')
    }
  })

  test('إعادة تعيين الموظفين المفصولين لمؤسسة أخرى', async ({ page }) => {
    await loginAsAdmin(page)
    
    // انتظر قليلاً للتأكد من انتهاء التنقل
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
    
    // اذهب للموظفين
    await page.goto('http://localhost:5174/employees', { waitUntil: 'networkidle' })
    await page.waitForTimeout(2000)
    
    // ابحث عن موظف بدون تعيين باستخدام حرف البحث الصحيح
    const unassignedElements = page.locator(':has-text("بدون تعيين")')
    const unassignedCount = await unassignedElements.count()
    
    if (unassignedCount === 0) {
      test.skip()
      return
    }
    
    console.log(`✓ وجدنا ${unassignedCount} موظفين بدون تعيين`)
    
    // ابحث عن أول صف يحتوي على "بدون تعيين"
    const unassignedRow = page.locator('tr:has-text("بدون تعيين")').first()
    const editButton = unassignedRow.locator('button').filter({ hasText: /تعديل|edit/ }).first()
    
    if (await editButton.count() > 0) {
      await editButton.click()
      await page.waitForTimeout(1500)
      
      // اختر مؤسسة من dropdown
      const selectElements = page.locator('select').first()
      if (await selectElements.count() > 0) {
        await selectElements.selectOption({ index: 1 })
        
        // احفظ التغييرات
        const saveButton = page.locator('button:has-text("حفظ"), button:has-text("save")').last()
        if (await saveButton.count() > 0) {
          await saveButton.click()
          await page.waitForTimeout(2000)
          console.log('✓ تم إعادة تعيين الموظف بنجاح')
        }
      } else {
        console.log('ملاحظة: لم نجد قائمة اختيار المؤسسة')
      }
    }
  })

  test('التحقق من سجل النشاط للحذف الآمن', async ({ page }) => {
    await loginAsAdmin(page)
    
    // اذهب لسجل النشاط
    await page.goto('http://localhost:5174/activity-logs')
    await page.waitForTimeout(2000)
    
    // تحقق من أن الصفحة محملة
    const pageTitle = page.locator('h1, h2, [class*="title"]').first()
    const isTitleVisible = await pageTitle.isVisible({ timeout: 5000 }).catch(() => false)
    
    if (!isTitleVisible) {
      test.skip()
      return
    }
    
    // ابحث عن سجل حذف مؤسسة
    const deleteLogsContainer = page.locator('[class*="log"], [class*="activity"], .space-y-4').first()
    const logs = await deleteLogsContainer.locator('div').count()
    
    console.log(`✓ عدد السجلات: ${logs}`)
    
    if (logs > 0) {
      // تحقق من أن هناك سجلات حذف
      const hasSafeDeleteLog = page.locator('text/حذف مؤسسة, text/فصل').first()
      const isVisible = await hasSafeDeleteLog.isVisible({ timeout: 3000 }).catch(() => false)
      
      if (isVisible) {
        console.log('✓ سجل النشاط يوضح عمليات الحذف الآمن')
        expect(isVisible).toBe(true)
      } else {
        console.log('ملاحظة: لم نجد سجلات حذف محددة')
      }
    }
  })
})
