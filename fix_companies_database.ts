import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fixCompaniesTable() {
  try {
    console.log('بدء إصلاح جدول companies...')
    
    // تحديث المؤسسات بالقيم المحسوبة
    console.log('تحديث حالات المؤسسات...')
    
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (fetchError) {
      console.error('خطأ في جلب البيانات:', fetchError)
      return
    }
    
    console.log(`تم جلب ${companies?.length || 0} مؤسسة`)
    
    if (companies && companies.length > 0) {
      // حساب الحالات التلقائية
      const today = new Date()
      
      for (const company of companies) {
        let commercialRegStatus = 'غير محدد'
        let insuranceStatus = 'غير محدد'
        
        // حساب حالة السجل التجاري
        if (company.commercial_registration_expiry) {
          const expiryDate = new Date(company.commercial_registration_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            commercialRegStatus = 'منتهي'
          } else if (daysDiff <= 7) {
            commercialRegStatus = 'حرج (ينتهي خلال 7 أيام)'
          } else if (daysDiff <= 30) {
            commercialRegStatus = 'متوسط (ينتهي خلال شهر)'
          } else {
            commercialRegStatus = 'ساري'
          }
        }
        
        // حساب حالة اشتراك التأمينات
        if (company.insurance_subscription_expiry) {
          const expiryDate = new Date(company.insurance_subscription_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            insuranceStatus = 'منتهي'
          } else if (daysDiff <= 7) {
            insuranceStatus = 'حرج (ينتهي خلال 7 أيام)'
          } else if (daysDiff <= 30) {
            insuranceStatus = 'متوسط (ينتهي خلال شهر)'
          } else {
            insuranceStatus = 'ساري'
          }
        }
        
        // تحديث المؤسسة
        const { error: updateError } = await supabase
          .from('companies')
          .update({
            commercial_registration_status: commercialRegStatus,
            insurance_subscription_status: insuranceStatus
          })
          .eq('id', company.id)
        
        if (updateError) {
          console.error(`خطأ في تحديث المؤسسة ${company.id}:`, updateError)
        } else {
          console.log(`تم تحديث المؤسسة: ${company.name}`)
        }
      }
    }
    
    console.log('انتهى إصلاح جدول companies')
    
    // التحقق من النتيجة
    const { data: updatedCompanies } = await supabase
      .from('companies')
      .select('name, commercial_registration_status, insurance_subscription_status')
      .limit(5)
    
    console.log('عينة من النتائج المحدثة:')
    console.log(updatedCompanies)
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

// تشغيل الوظيفة
fixCompaniesTable()