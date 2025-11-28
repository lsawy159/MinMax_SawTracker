import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function fixCompaniesTable() {
  try {
    console.log('بدء إصلاح جدول companies...')
    
    // أولاً: فحص البنية الحالية
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
    
    if (fetchError) {
      console.error('خطأ في فحص جدول companies:', fetchError)
      return
    }
    
    // ثانياً: جلب جميع البيانات
    const { data: allCompanies, error: allError } = await supabase
      .from('companies')
      .select('*')
    
    if (allError) {
      console.error('خطأ في جلب جميع الشركات:', allError)
      return
    }
    
    console.log(`تم جلب ${allCompanies?.length || 0} مؤسسة`)
    
    if (!allCompanies || allCompanies.length === 0) {
      console.log('لا توجد مؤسسات في قاعدة البيانات')
      return
    }
    
    // ثالثاً: حساب الحالات وتحديث البيانات
    const today = new Date()
    let updatedCount = 0
    
    for (const company of allCompanies) {
      try {
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
        
        // محاولة تحديث المؤسسة
        const { data, error: updateError } = await supabase
          .from('companies')
          .update({
            commercial_registration_status: commercialRegStatus,
            insurance_subscription_status: insuranceStatus
          })
          .eq('id', company.id)
          .select()
        
        if (updateError) {
          // إذا فشل التحديث، نعرض رسالة خطأ
          console.error(`فشل في تحديث المؤسسة ${company.name}:`, updateError.message)
          
          // إذا كان الخطأ "العمود غير موجود"، سنقوم بإنشاء الأعمدة
          if (updateError.message.includes('commercial_registration_status')) {
            console.log('يبدو أن الأعمدة المفقودة، جاري إنشائها...')
            // هنا نحتاج لإضافة الأعمدة عبر SQL مباشر
            break // نخرج من الحلقة ونعالج المشكلة
          }
        } else {
          updatedCount++
          console.log(`تم تحديث: ${company.name} -> ${commercialRegStatus}, ${insuranceStatus}`)
        }
      } catch (updateErr) {
        console.error(`خطأ في معالجة الشركة ${company.name}:`, updateErr)
      }
    }
    
    console.log(`تم تحديث ${updatedCount} مؤسسة من أصل ${allCompanies.length}`)
    
    // رابعاً: فحص النتائج
    const { data: finalCompanies } = await supabase
      .from('companies')
      .select('name, commercial_registration_status, insurance_subscription_status, commercial_registration_expiry, insurance_subscription_expiry')
    
    if (finalCompanies) {
      console.log('النتائج النهائية:')
      console.log(`إجمالي المؤسسات: ${finalCompanies.length}`)
      
      // حساب الإحصائيات
      const expiredCommercial = finalCompanies.filter(c => c.commercial_registration_status === 'منتهي').length
      const expiredInsurance = finalCompanies.filter(c => c.insurance_subscription_status === 'منتهي').length
      const criticalCommercial = finalCompanies.filter(c => c.commercial_registration_status?.includes('حرج')).length
      const criticalInsurance = finalCompanies.filter(c => c.insurance_subscription_status?.includes('حرج')).length
      const total = finalCompanies.length
      
      console.log(`منتهي السجل التجاري: ${expiredCommercial}`)
      console.log(`منتهي اشتراك التأمينات: ${expiredInsurance}`)
      console.log(`حرج السجل التجاري: ${criticalCommercial}`)
      console.log(`حرج اشتراك التأمينات: ${criticalInsurance}`)
      console.log(`المجموع الإجمالي: ${total}`)
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

fixCompaniesTable()