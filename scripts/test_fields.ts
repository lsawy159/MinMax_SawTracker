import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testFieldsOneByOne() {
  console.log('اختبار الحقول واحد تلو الآخر...')
  
  const testFields = [
    { name: 'شركة أساسية', unified_number: '1234567890' },
    { name: 'شركة مع رقم تأمين', unified_number: '1234567890', insurance_subscription_number: '9876543210' },
    { name: 'شركة مع تواريخ', unified_number: '1234567890', insurance_subscription_number: '9876543210', commercial_registration_expiry: '2026-01-20' },
    { name: 'شركة مع موظفين', unified_number: '1234567890', insurance_subscription_number: '9876543210', commercial_registration_expiry: '2026-01-20', max_employees: 5 }
  ]
  
  for (let i = 0; i < testFields.length; i++) {
    const company = testFields[i]
    console.log(`\nاختبار ${i + 1}: ${company.name}`)
    console.log('الحقول:', Object.keys(company))
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
      
      if (error) {
        console.log(`❌ فشل: ${error.message}`)
        // إزالة الحقل الأخير وحاول مرة أخرى
        const keys = Object.keys(company)
        const lastKey = keys[keys.length - 1]
        delete company[lastKey]
        console.log('تم إزالة الحقل الأخير، جاري المحاولة مرة أخرى...')
        
        const { data: retryData, error: retryError } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (retryError) {
          console.log(`❌ فشل مرة أخرى: ${retryError.message}`)
        } else {
          console.log(`✅ نجح! تم إضافة الشركة`)
          break // توقف عند النجاح
        }
      } else {
        console.log(`✅ نجح! تم إضافة الشركة`)
        
        // حذف الشركة التي أضفناها للاختبار
        await supabase.from('companies').delete().eq('id', data[0].id)
        console.log('تم حذف البيانات التجريبية')
        break
      }
    } catch (err) {
      console.log(`❌ خطأ: ${err}`)
    }
  }
  
  // الآن جرب إضافة البيانات الكاملة
  console.log('\n' + '='.repeat(50))
  console.log('جاري إضافة البيانات الكاملة...')
  
  const fullCompany = {
    name: 'شركة محمد النفيعي للتشغيل والصيانة',
    unified_number: '7035540473'
  }
  
  try {
    const { data, error } = await supabase
      .from('companies')
      .insert([fullCompany])
      .select()
    
    if (error) {
      console.log(`خطأ في إضافة الشركة الكاملة: ${error.message}`)
      console.log('جاري المحاولة بحقل واحد...')
      
      const simpleCompany = { name: 'شركة بسيطة' }
      const { data: simpleData, error: simpleError } = await supabase
        .from('companies')
        .insert([simpleCompany])
        .select()
      
      if (simpleError) {
        console.log(`خطأ في الحقل البسيط: ${simpleError.message}`)
        return
      }
      
      console.log('تم إضافة الشركة البسيطة')
      
      // الآن جرب تحديث البيانات تدريجياً
      console.log('جاري تحديث البيانات...')
      
      const updateData = {
        unified_number: '7035540473',
        insurance_subscription_number: '647482801',
        commercial_registration_expiry: '2026-01-20',
        insurance_subscription_expiry: '2026-01-14'
      }
      
      const { data: updateResult, error: updateError } = await supabase
        .from('companies')
        .update(updateData)
        .eq('id', simpleData[0].id)
        .select()
      
      if (updateError) {
        console.log(`خطأ في التحديث: ${updateError.message}`)
      } else {
        console.log('تم التحديث بنجاح!')
        console.log(updateResult[0])
      }
      
    } else {
      console.log('تم إضافة الشركة الكاملة بنجاح!')
      console.log(data[0])
    }
  } catch (err) {
    console.log(`خطأ عام: ${err}`)
  }
}

testFieldsOneByOne()