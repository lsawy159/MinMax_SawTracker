import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createAdminAndData() {
  try {
    console.log('إنشاء حساب admin...')
    
    // تسجيل الدخول كـ admin
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: 'admin@sawtracker.com',
      password: 'admin123'
    })
    
    if (signInError) {
      console.log('المستخدم غير موجود، جاري الإنشاء...')
      
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: 'admin@sawtracker.com',
        password: 'admin123'
      })
      
      if (signUpError) {
        console.log('فشل في إنشاء المستخدم:', signUpError.message)
        return
      }
      
      console.log('تم إنشاء المستخدم:', signUpData.user?.email)
      console.log('قد تحتاج تأكيد البريد الإلكتروني')
    } else {
      console.log('تم تسجيل الدخول بنجاح:', signInData.user?.email)
    }
    
    // جلب الشركات
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (fetchError) {
      console.log('خطأ في جلب الشركات:', fetchError.message)
    } else {
      console.log(`تم جلب ${companies?.length || 0} شركة`)
    }
    
    // إضافة شركات تجريبية
    if (companies?.length === 0) {
      console.log('جاري إضافة شركات تجريبية...')
      
      const testCompanies = [
        {
          name: 'شركة محمد النفيعي للتشغيل والصيانة',
          unified_number: '7035540473',
          insurance_subscription_number: '647482801',
          commercial_registration_expiry: '2026-01-20',
          insurance_subscription_expiry: '2026-01-14'
        },
        {
          name: 'شركة سواعدنا',
          unified_number: '7035540462',
          insurance_subscription_number: '647482856',
          commercial_registration_expiry: '2025-12-25',
          insurance_subscription_expiry: '2025-12-18'
        },
        {
          name: 'شركة حرج - تحتاج متابعة',
          unified_number: '1001001',
          commercial_registration_expiry: '2025-12-10',
          insurance_subscription_expiry: '2025-12-08'
        },
        {
          name: 'شركة ساري - آمنة',
          unified_number: '1002002',
          commercial_registration_expiry: '2026-05-15',
          insurance_subscription_expiry: '2026-05-12'
        },
        {
          name: 'شركة منتهي - خطير',
          unified_number: '1003003',
          commercial_registration_expiry: '2025-11-01',
          insurance_subscription_expiry: '2025-10-15'
        }
      ]
      
      for (const company of testCompanies) {
        try {
          const { data, error } = await supabase
            .from('companies')
            .insert([company])
            .select()
          
          if (error) {
            console.log(`فشل في إضافة ${company.name}:`, error.message)
          } else {
            console.log(`تم إضافة: ${company.name}`)
          }
        } catch (err) {
          console.log(`خطأ في ${company.name}:`, err)
        }
      }
    }
    
    // فحص النتائج النهائية
    const { data: finalCompanies } = await supabase
      .from('companies')
      .select('*')
    
    console.log(`\nالنتيجة النهائية: ${finalCompanies?.length || 0} شركة`)
    
    if (finalCompanies && finalCompanies.length > 0) {
      console.log('الشركات الموجودة:')
      for (const company of finalCompanies) {
        console.log(`- ${company.name} (${company.unified_number})`)
        console.log(`  انتهاء السجل: ${company.commercial_registration_expiry || 'غير محدد'}`)
        console.log(`  انتهاء التأمين: ${company.insurance_subscription_expiry || 'غير محدد'}`)
        console.log('')
      }
      
      console.log('✅ تم إصلاح مشكلة الإحصائيات!')
      console.log('الآن يمكن تحديث الصفحة لرؤية الإحصائيات الصحيحة')
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

createAdminAndData()