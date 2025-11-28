import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

// تواريخ مختلفة لاختبار الحالات
const today = new Date()

// تاريخ ينتهي خلال 5 أيام (حرج)
const criticalDate = new Date(today)
criticalDate.setDate(criticalDate.getDate() + 5)

// تاريخ ينتهي خلال 20 يوم (متوسط)
const mediumDate = new Date(today)
mediumDate.setDate(mediumDate.getDate() + 20)

// تاريخ ينتهي خلال 60 يوم (ساري)
const validDate = new Date(today)
validDate.setDate(validDate.getDate() + 60)

// تاريخ منتهي (منتهي الصلاحية)
const expiredDate = new Date(today)
expiredDate.setDate(expiredDate.getDate() - 10)

const sampleCompanies = [
  {
    name: 'شركة التطوير التقني المحدودة',
    tax_number: 1234567890,
    unified_number: 9876543210,
    labor_subscription_number: 'LAB-2024-001',
    commercial_registration_expiry: criticalDate.toISOString().split('T')[0], // ينتهي خلال 5 أيام
    insurance_subscription_expiry: mediumDate.toISOString().split('T')[0], // ينتهي خلال 20 يوم

  },
  {
    name: 'مؤسسة الخدمات التجارية',
    tax_number: 2345678901,
    unified_number: 8765432109,
    labor_subscription_number: 'LAB-2024-002',
    commercial_registration_expiry: mediumDate.toISOString().split('T')[0], // ينتهي خلال 20 يوم
    insurance_subscription_expiry: validDate.toISOString().split('T')[0], // ينتهي خلال 60 يوم

  },
  {
    name: 'شركة البناء والمقاولات',
    tax_number: 3456789012,
    unified_number: 7654321098,
    labor_subscription_number: 'LAB-2024-003',
    commercial_registration_expiry: validDate.toISOString().split('T')[0], // ينتهي خلال 60 يوم
    insurance_subscription_expiry: criticalDate.toISOString().split('T')[0], // ينتهي خلال 5 أيام

  },
  {
    name: 'مكتب الاستشارات الإدارية',
    tax_number: 4567890123,
    unified_number: 6543210987,
    labor_subscription_number: 'LAB-2024-004',
    commercial_registration_expiry: expiredDate.toISOString().split('T')[0], // منتهي الصلاحية
    insurance_subscription_expiry: expiredDate.toISOString().split('T')[0], // منتهي الصلاحية

  },
  {
    name: 'شركة التجارة الإلكترونية',
    tax_number: 5678901234,
    unified_number: 5432109876,
    labor_subscription_number: 'LAB-2024-005',
    commercial_registration_expiry: validDate.toISOString().split('T')[0], // ينتهي خلال 60 يوم
    insurance_subscription_expiry: validDate.toISOString().split('T')[0], // ينتهي خلال 60 يوم

  }
]

async function createSampleCompanies() {
  try {
    console.log('بدء إضافة المؤسسات التجريبية...')
    
    const { data, error } = await supabase
      .from('companies')
      .insert(sampleCompanies)
      .select()

    if (error) {
      console.error('خطأ في إضافة المؤسسات:', error)
      return
    }

    console.log(`تم إضافة ${data?.length || 0} مؤسسة بنجاح:`)
    data?.forEach((company, index) => {
      console.log(`${index + 1}. ${company.name}`)
    })

    // التحقق من النتائج
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('*')
    
    console.log(`\nإجمالي المؤسسات في النظام: ${allCompanies?.length || 0}`)
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

// تشغيل الوظيفة
createSampleCompanies()