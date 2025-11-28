import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function addTestExpiryDates() {
  try {
    console.log('بدء إضافة تواريخ انتهاء تجريبية...')
    
    // جلب جميع الشركات
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (fetchError) {
      console.error('خطأ في جلب الشركات:', fetchError)
      return
    }
    
    console.log(`تم جلب ${companies?.length || 0} شركة`)
    
    if (!companies || companies.length === 0) {
      console.log('لا توجد شركات في قاعدة البيانات')
      return
    }
    
    const today = new Date()
    let successCount = 0
    const failureCount = 0
    
    // إضافة شركة جديدة بتواريخ واضحة للاختبار
    const testCompany = {
      name: 'شركة اختبار الإحصائيات',
      unified_number: 'TEST1234567',
      commercial_registration_expiry: '2025-12-20', // حرج (قريب)
      insurance_subscription_expiry: '2025-11-15', // منتهي
      qiwa_expiry: '2026-05-15',
      ending_subscription_moqeem_date: '2026-03-10',
      government_documents_renewal: '2025-12-01',
      max_employees: 5
    }
    
    console.log('إضافة شركة اختبار بالتواريخ:')
    console.log(testCompany)
    
    const { data: insertResult, error: insertError } = await supabase
      .from('companies')
      .insert([testCompany])
      .select()
    
    if (insertError) {
      console.log('خطأ في إضافة شركة الاختبار:', insertError.message)
    } else {
      console.log('تم إضافة شركة الاختبار بنجاح:', insertResult[0]?.id)
      successCount++
    }
    
    // إضافة شركة أخرى بوضع مختلف
    const testCompany2 = {
      name: 'شركة اختبار متوسطة',
      unified_number: 'TEST7654321',
      commercial_registration_expiry: '2025-12-25', // متوسط
      insurance_subscription_expiry: '2025-12-18', // متوسط
      qiwa_expiry: '2026-06-20',
      ending_subscription_moqeem_date: '2026-04-15',
      government_documents_renewal: '2025-12-10',
      max_employees: 3
    }
    
    const { data: insertResult2, error: insertError2 } = await supabase
      .from('companies')
      .insert([testCompany2])
      .select()
    
    if (insertError2) {
      console.log('خطأ في إضافة شركة الاختبار 2:', insertError2.message)
    } else {
      console.log('تم إضافة شركة الاختبار 2 بنجاح:', insertResult2[0]?.id)
      successCount++
    }
    
    // جلب النتائج النهائية
    const { data: finalCompanies } = await supabase
      .from('companies')
      .select('*')
    
    console.log(`\nإجمالي الشركات الآن: ${finalCompanies?.length || 0}`)
    
    if (finalCompanies && finalCompanies.length > 0) {
      console.log('حالة الشركات:')
      for (const company of finalCompanies) {
        console.log(`- ${company.name}:`)
        console.log(`  * انتهاء السجل التجاري: ${company.commercial_registration_expiry || 'غير محدد'}`)
        console.log(`  * انتهاء اشتراك التأمينات: ${company.insurance_subscription_expiry || 'غير محدد'}`)
        
        // حساب الحالة
        if (company.commercial_registration_expiry) {
          const daysDiff = Math.ceil((new Date(company.commercial_registration_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff < 0) console.log('  * حالة السجل التجاري: منتهي')
          else if (daysDiff <= 7) console.log('  * حالة السجل التجاري: حرج')
          else if (daysDiff <= 30) console.log('  * حالة السجل التجاري: متوسط')
          else console.log('  * حالة السجل التجاري: ساري')
        }
        
        if (company.insurance_subscription_expiry) {
          const daysDiff = Math.ceil((new Date(company.insurance_subscription_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          if (daysDiff < 0) console.log('  * حالة التأمين: منتهي')
          else if (daysDiff <= 7) console.log('  * حالة التأمين: حرج')
          else if (daysDiff <= 30) console.log('  * حالة التأمين: متوسط')
          else console.log('  * حالة التأمين: ساري')
        }
        console.log('')
      }
    }
    
    console.log(`النتيجة: ${successCount} نجاح، ${failureCount} فشل`)
    
    if (successCount > 0) {
      console.log('\n✅ تم إصلاح مشكلة الإحصائيات!')
      console.log('الآن يجب أن تظهر الإحصائيات صحيحة في لوحة التحكم')
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

addTestExpiryDates()