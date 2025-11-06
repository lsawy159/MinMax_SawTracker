import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function runDatabaseFix() {
  try {
    console.log('بدء إصلاح قاعدة البيانات...')
    
    // تشغيل دالة إصلاح الجدول
    const { data, error } = await supabase.rpc('fix_companies_table')
    
    if (error) {
      console.error('خطأ في تشغيل دالة الإصلاح:', error)
      return
    }
    
    console.log('تم تشغيل دالة الإصلاح بنجاح')
    
    // فحص النتائج
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('name, commercial_registration_status, insurance_subscription_status, commercial_registration_expiry, insurance_subscription_expiry')
    
    if (fetchError) {
      console.error('خطأ في جلب البيانات المحدثة:', fetchError)
      return
    }
    
    console.log(`تم العثور على ${companies?.length || 0} مؤسسة`)
    
    if (companies && companies.length > 0) {
      console.log('عينة من النتائج:')
      companies.slice(0, 3).forEach((company, index) => {
        console.log(`${index + 1}. ${company.name}:`)
        console.log(`   - حالة السجل التجاري: ${company.commercial_registration_status || 'غير محدد'}`)
        console.log(`   - حالة اشتراك التأمينات: ${company.insurance_subscription_status || 'غير محدد'}`)
        console.log(`   - انتهاء السجل التجاري: ${company.commercial_registration_expiry || 'غير محدد'}`)
        console.log(`   - انتهاء اشتراك التأمينات: ${company.insurance_subscription_expiry || 'غير محدد'}`)
        console.log('')
      })
    }
    
    // حساب الإحصائيات
    const totalCompanies = companies?.length || 0
    const expiredCommercial = companies?.filter(c => c.commercial_registration_status === 'منتهي').length || 0
    const expiredInsurance = companies?.filter(c => c.insurance_subscription_status === 'منتهي').length || 0
    const criticalCommercial = companies?.filter(c => c.commercial_registration_status?.includes('حرج')).length || 0
    const criticalInsurance = companies?.filter(c => c.insurance_subscription_status?.includes('حرج')).length || 0
    
    console.log('الإحصائيات الجديدة:')
    console.log(`- إجمالي المؤسسات: ${totalCompanies}`)
    console.log(`- منتهي السجل التجاري: ${expiredCommercial}`)
    console.log(`- منتهي اشتراك التأمينات: ${expiredInsurance}`)
    console.log(`- حرج السجل التجاري: ${criticalCommercial}`)
    console.log(`- حرج اشتراك التأمينات: ${criticalInsurance}`)
    
    console.log('تم إصلاح قاعدة البيانات بنجاح!')
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

runDatabaseFix()