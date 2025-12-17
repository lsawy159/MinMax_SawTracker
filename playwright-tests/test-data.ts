/**
 * اختبار البيانات - دوال لإنشاء وحذف البيانات الاختبارية
 */

import { Page } from '@playwright/test'
import { supabase } from '../src/lib/supabase'

// البيانات الاختبارية الأساسية
export const testData = {
  testCompany: {
    name: 'شركة اختبار E2E',
    commercial_registration_number: 'TEST-1234567890',
    commercial_registration_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    tax_number: 'TAX-TEST-001',
    social_insurance_number: 'SI-TEST-001',
    social_insurance_expiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    health_insurance_provider: 'اختبار التأمين الصحي',
    ending_subscription_power_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    ending_subscription_moqeem_date: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    phone: '0501234567',
    email: 'test-company@example.com',
    website: 'https://example.com',
    max_employees: 10,
  },
  testEmployee: {
    name: 'موظف اختبار E2E',
    email: 'test-employee@example.com',
    phone: '0509876543',
    position: 'مهندس اختبار',
    saudi_id: '1234567890',
    nationality: 'سعودي',
    iqama_number: null,
    start_date: new Date().toISOString().split('T')[0],
  },
}

/**
 * إنشاء مؤسسة اختبارية في قاعدة البيانات
 */
export async function createTestCompany(overrides?: Record<string, any>) {
  try {
    const companyData = {
      ...testData.testCompany,
      ...overrides,
    }

    const { data, error } = await supabase
      .from('companies')
      .insert([companyData])
      .select()
      .single()

    if (error) {
      console.error('خطأ في إنشاء مؤسسة اختبارية:', error)
      return null
    }

    console.log('✅ تم إنشاء مؤسسة اختبارية:', data.id)
    return data
  } catch (error) {
    console.error('خطأ غير متوقع عند إنشاء مؤسسة اختبارية:', error)
    return null
  }
}

/**
 * إنشاء موظف اختبار في قاعدة البيانات
 */
export async function createTestEmployee(companyId: string, overrides?: Record<string, any>) {
  try {
    const employeeData = {
      ...testData.testEmployee,
      company_id: companyId,
      ...overrides,
    }

    const { data, error } = await supabase
      .from('employees')
      .insert([employeeData])
      .select()
      .single()

    if (error) {
      console.error('خطأ في إنشاء موظف اختبار:', error)
      return null
    }

    console.log('✅ تم إنشاء موظف اختبار:', data.id)
    return data
  } catch (error) {
    console.error('خطأ غير متوقع عند إنشاء موظف اختبار:', error)
    return null
  }
}

/**
 * حذف مؤسسة اختبارية من قاعدة البيانات
 */
export async function deleteTestCompany(companyId: string) {
  try {
    // احذف الموظفين أولاً
    await supabase
      .from('employees')
      .delete()
      .eq('company_id', companyId)

    // ثم احذف المؤسسة
    const { error } = await supabase
      .from('companies')
      .delete()
      .eq('id', companyId)

    if (error) {
      console.error('خطأ في حذف مؤسسة اختبارية:', error)
      return false
    }

    console.log('✅ تم حذف مؤسسة اختبارية:', companyId)
    return true
  } catch (error) {
    console.error('خطأ غير متوقع عند حذف مؤسسة اختبارية:', error)
    return false
  }
}

/**
 * حذف موظف اختبار من قاعدة البيانات
 */
export async function deleteTestEmployee(employeeId: string) {
  try {
    const { error } = await supabase
      .from('employees')
      .delete()
      .eq('id', employeeId)

    if (error) {
      console.error('خطأ في حذف موظف اختبار:', error)
      return false
    }

    console.log('✅ تم حذف موظف اختبار:', employeeId)
    return true
  } catch (error) {
    console.error('خطأ غير متوقع عند حذف موظف اختبار:', error)
    return false
  }
}

/**
 * تنظيف جميع بيانات الاختبار
 */
export async function cleanupTestData() {
  try {
    // احذف جميع المؤسسات التي تبدأ بـ "شركة اختبار"
    const { data: companies, error: companiesError } = await supabase
      .from('companies')
      .select('id')
      .ilike('name', '%اختبار%')

    if (companiesError) throw companiesError

    if (companies && companies.length > 0) {
      for (const company of companies) {
        await deleteTestCompany(company.id)
      }
    }

    console.log('✅ تم تنظيف جميع بيانات الاختبار')
    return true
  } catch (error) {
    console.error('خطأ في تنظيف بيانات الاختبار:', error)
    return false
  }
}

/**
 * إعادة تعيين localStorage في Playwright
 */
export async function resetLocalStorage(page: Page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
  })
}

/**
 * حفظ البيانات إلى localStorage (محاكاة الجلسة)
 */
export async function setAuthToken(page: Page, token: string) {
  await page.evaluate((token) => {
    localStorage.setItem('supabase.auth.token', token)
  }, token)
}
