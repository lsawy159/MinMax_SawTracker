import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTableStructure() {
  try {
    console.log('فحص بنية جدول companies...')
    
    // محاولة جلب البيانات
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (fetchError) {
      console.error('خطأ في جلب البيانات:', fetchError)
    } else {
      console.log(`عدد المؤسسات: ${companies?.length || 0}`)
      
      if (companies && companies.length > 0) {
        console.log('عينة من البيانات:')
        console.log(companies[0])
      }
    }
    
    // إضافة البيانات التجريبية
    console.log('إضافة بيانات تجريبية...')
    
    const today = new Date()
    const sampleCompanies = [
      {
        name: 'شركة محمد النفيعي للتشغيل والصيانة',
        unified_number: '7035540473',
        insurance_subscription_number: '647482801',
        qiwa_subscription_number: '13-4016465',
        max_employees: 4,
        current_employees: 4,
        company_type: 'شركة محدودة',
        commercial_registration_expiry: new Date('2026-01-20'),
        insurance_subscription_expiry: new Date('2026-01-14'),
        qiwa_expiry: new Date('2026-01-19'),
        muqeem_expiry: new Date('2026-02-12'),
        government_documents_renewal: new Date('2026-01-15'),
        commercial_registration_status: 'ساري',
        insurance_subscription_status: 'ساري'
      },
      {
        name: 'شركة سواعدنا',
        unified_number: '7035540462',
        insurance_subscription_number: '647482856',
        qiwa_subscription_number: '13-4016490',
        max_employees: 4,
        current_employees: 3,
        company_type: 'شركة مساهمة',
        commercial_registration_expiry: new Date('2026-01-20'),
        insurance_subscription_expiry: new Date('2026-01-14'),
        qiwa_expiry: new Date('2026-01-19'),
        muqeem_expiry: new Date('2026-02-12'),
        government_documents_renewal: new Date('2026-01-15'),
        commercial_registration_status: 'ساري',
        insurance_subscription_status: 'ساري'
      },
      {
        name: 'شركة التجديد المحدودة',
        unified_number: '1010101010',
        insurance_subscription_number: '2020202020',
        qiwa_subscription_number: '30-9999999',
        max_employees: 5,
        current_employees: 2,
        company_type: 'شركة محدودة',
        commercial_registration_expiry: new Date('2025-12-15'), // قريب
        insurance_subscription_expiry: new Date('2025-12-10'), // قريب جداً
        qiwa_expiry: new Date('2026-03-20'),
        muqeem_expiry: new Date('2026-04-15'),
        government_documents_renewal: new Date('2025-12-20'),
        commercial_registration_status: 'متوسط (ينتهي خلال شهر)',
        insurance_subscription_status: 'حرج (ينتهي خلال 7 أيام)'
      },
      {
        name: 'شركة منتهية الصلاحية',
        unified_number: '8080808080',
        insurance_subscription_number: '9090909090',
        qiwa_subscription_number: '40-8888888',
        max_employees: 3,
        current_employees: 1,
        company_type: 'شركة مساهمة',
        commercial_registration_expiry: new Date('2025-11-01'), // منتهي
        insurance_subscription_expiry: new Date('2025-10-15'), // منتهي
        qiwa_expiry: new Date('2026-01-10'),
        muqeem_expiry: new Date('2026-02-05'),
        government_documents_renewal: new Date('2025-11-30'),
        commercial_registration_status: 'منتهي',
        insurance_subscription_status: 'منتهي'
      }
    ]
    
    for (const company of sampleCompanies) {
      const { data, error } = await supabase
        .from('companies')
        .insert([company])
        .select()
      
      if (error) {
        console.error(`خطأ في إضافة ${company.name}:`, error)
      } else {
        console.log(`تم إضافة: ${company.name}`)
      }
    }
    
    // فحص النتائج
    console.log('فحص النتائج...')
    const { data: finalCompanies } = await supabase
      .from('companies')
      .select('*')
    
    if (finalCompanies) {
      console.log(`تم إضافة ${finalCompanies.length} مؤسسة`)
      
      // حساب الإحصائيات
      const total = finalCompanies.length
      const expiredCommercial = finalCompanies.filter(c => c.commercial_registration_status === 'منتهي').length
      const expiredInsurance = finalCompanies.filter(c => c.insurance_subscription_status === 'منتهي').length
      const criticalCommercial = finalCompanies.filter(c => c.commercial_registration_status?.includes('حرج')).length
      const criticalInsurance = finalCompanies.filter(c => c.insurance_subscription_status?.includes('حرج')).length
      const mediumCommercial = finalCompanies.filter(c => c.commercial_registration_status?.includes('متوسط')).length
      const mediumInsurance = finalCompanies.filter(c => c.insurance_subscription_status?.includes('متوسط')).length
      
      console.log('الإحصائيات النهائية:')
      console.log(`- إجمالي المؤسسات: ${total}`)
      console.log(`- منتهي السجل التجاري: ${expiredCommercial}`)
      console.log(`- منتهي اشتراك التأمينات: ${expiredInsurance}`)
      console.log(`- حرج السجل التجاري: ${criticalCommercial}`)
      console.log(`- حرج اشتراك التأمينات: ${criticalInsurance}`)
      console.log(`- متوسط السجل التجاري: ${mediumCommercial}`)
      console.log(`- متوسط اشتراك التأمينات: ${mediumInsurance}`)
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

checkTableStructure()