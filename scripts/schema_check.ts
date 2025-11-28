import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkTableSchema() {
  try {
    console.log('فحص بنية جدول companies...')
    
    // محاولة استعلام بسيط لمعرفة الأعمدة المتاحة
    const { data: sample, error: sampleError } = await supabase
      .from('companies')
      .select('*')
      .limit(1)
    
    if (sampleError) {
      console.error('خطأ في جلب عينة من البيانات:', sampleError)
      return
    }
    
    console.log('عينة من البيانات الموجودة:')
    console.log(sample?.[0] || 'لا توجد بيانات')
    
    // محاولة إضافة البيانات بدون الحقول المشكلة
    console.log('إضافة البيانات التجريبية بدون الحقول المشكوك بها...')
    
    const basicCompanies = [
      {
        name: 'شركة محمد النفيعي للتشغيل والصيانة',
        unified_number: '7035540473',
        insurance_subscription_number: '647482801',
        qiwa_subscription_number: '13-4016465',
        max_employees: 4,
        current_employees: 4,
        commercial_registration_expiry: '2026-01-20',
        insurance_subscription_expiry: '2026-01-14',
        qiwa_expiry: '2026-01-19',
        ending_subscription_moqeem_date: '2026-02-12',
        government_documents_renewal: '2026-01-15'
      },
      {
        name: 'شركة سواعدنا',
        unified_number: '7035540462',
        insurance_subscription_number: '647482856',
        qiwa_subscription_number: '13-4016490',
        max_employees: 4,
        current_employees: 3,
        commercial_registration_expiry: '2026-01-20',
        insurance_subscription_expiry: '2026-01-14',
        qiwa_expiry: '2026-01-19',
        ending_subscription_moqeem_date: '2026-02-12',
        government_documents_renewal: '2026-01-15'
      },
      {
        name: 'شركة التجديد المحدودة',
        unified_number: '1010101010',
        insurance_subscription_number: '2020202020',
        qiwa_subscription_number: '30-9999999',
        max_employees: 5,
        current_employees: 2,
        commercial_registration_expiry: '2025-12-15',
        insurance_subscription_expiry: '2025-12-10',
        qiwa_expiry: '2026-03-20',
        ending_subscription_moqeem_date: '2026-04-15',
        government_documents_renewal: '2025-12-20'
      },
      {
        name: 'شركة منتهية الصلاحية',
        unified_number: '8080808080',
        insurance_subscription_number: '9090909090',
        qiwa_subscription_number: '40-8888888',
        max_employees: 3,
        current_employees: 1,
        commercial_registration_expiry: '2025-11-01',
        insurance_subscription_expiry: '2025-10-15',
        qiwa_expiry: '2026-01-10',
        ending_subscription_moqeem_date: '2026-02-05',
        government_documents_renewal: '2025-11-30'
      }
    ]
    
    let addedCount = 0
    for (const company of basicCompanies) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (error) {
          console.error(`خطأ في إضافة ${company.name}:`, error.message)
          console.log('البيانات المرسلة:', JSON.stringify(company, null, 2))
        } else {
          addedCount++
          console.log(`تم إضافة: ${company.name}`)
        }
      } catch (err) {
        console.error(`خطأ في معالجة ${company.name}:`, err)
      }
    }
    
    console.log(`تم إضافة ${addedCount} شركة من أصل ${basicCompanies.length}`)
    
    // فحص النتائج
    const { data: allCompanies, error: countError } = await supabase
      .from('companies')
      .select('*')
    
    if (!countError && allCompanies) {
      console.log(`تم العثور على ${allCompanies.length} شركة في قاعدة البيانات`)
      
      // طباعة أول شركة لفهم البنية
      if (allCompanies.length > 0) {
        console.log('أول شركة في قاعدة البيانات:')
        console.log(allCompanies[0])
        console.log('الأعمدة المتاحة:')
        console.log(Object.keys(allCompanies[0]))
      }
      
      // حساب الإحصائيات
      const today = new Date()
      const stats = {
        total: allCompanies.length,
        expiredCommercial: 0,
        expiredInsurance: 0,
        criticalCommercial: 0,
        criticalInsurance: 0,
        mediumCommercial: 0,
        mediumInsurance: 0,
        activeCommercial: 0,
        activeInsurance: 0
      }
      
      for (const company of allCompanies) {
        // حالة السجل التجاري
        if (company.commercial_registration_expiry) {
          const expiryDate = new Date(company.commercial_registration_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            stats.expiredCommercial++
          } else if (daysDiff <= 7) {
            stats.criticalCommercial++
          } else if (daysDiff <= 30) {
            stats.mediumCommercial++
          } else {
            stats.activeCommercial++
          }
        }
        
        // حالة اشتراك التأمينات
        if (company.insurance_subscription_expiry) {
          const expiryDate = new Date(company.insurance_subscription_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            stats.expiredInsurance++
          } else if (daysDiff <= 7) {
            stats.criticalInsurance++
          } else if (daysDiff <= 30) {
            stats.mediumInsurance++
          } else {
            stats.activeInsurance++
          }
        }
      }
      
      console.log('\nالإحصائيات المحسوبة:')
      console.log(`- إجمالي المؤسسات: ${stats.total}`)
      console.log(`- منتهي السجل التجاري: ${stats.expiredCommercial}`)
      console.log(`- منتهي اشتراك التأمينات: ${stats.expiredInsurance}`)
      console.log(`- حرج السجل التجاري: ${stats.criticalCommercial}`)
      console.log(`- حرج اشتراك التأمينات: ${stats.criticalInsurance}`)
      console.log(`- متوسط السجل التجاري: ${stats.mediumCommercial}`)
      console.log(`- متوسط اشتراك التأمينات: ${stats.mediumInsurance}`)
      console.log(`- ساري السجل التجاري: ${stats.activeCommercial}`)
      console.log(`- ساري اشتراك التأمينات: ${stats.activeInsurance}`)
      
      // نسبة المؤسسات المنتهية
      const expiredPercent = stats.total > 0 ? Math.round((stats.expiredCommercial / stats.total) * 100) : 0
      console.log(`- نسبة منتهي الصلاحية: ${expiredPercent}%`)
      
      return stats
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

checkTableSchema()