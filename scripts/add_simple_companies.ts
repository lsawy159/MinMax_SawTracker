import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function addSimpleCompanies() {
  try {
    console.log('إضافة شركات تجريبية بسيطة...')
    
    // إضافة شركات بسيطة جداً
    const simpleCompanies = [
      {
        name: 'شركة حرج',
        unified_number: '1001',
        commercial_registration_expiry: '2025-12-12', // حرج
        insurance_subscription_expiry: '2025-12-10'  // حرج
      },
      {
        name: 'شركة متوسط',
        unified_number: '1002', 
        commercial_registration_expiry: '2025-12-25', // متوسط
        insurance_subscription_expiry: '2025-12-22'  // متوسط
      },
      {
        name: 'شركة ساري',
        unified_number: '1003',
        commercial_registration_expiry: '2026-04-15', // ساري
        insurance_subscription_expiry: '2026-04-10'  // ساري
      },
      {
        name: 'شركة منتهي',
        unified_number: '1004',
        commercial_registration_expiry: '2025-10-15', // منتهي
        insurance_subscription_expiry: '2025-11-01'  // منتهي
      },
      {
        name: 'شركة بدون تواريخ',
        unified_number: '1005'
      }
    ]
    
    let successCount = 0
    
    for (const company of simpleCompanies) {
      try {
        console.log(`إضافة ${company.name}...`)
        
        const { data, error } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (error) {
          console.log(`فشل: ${error.message}`)
        } else {
          console.log(`نجح: ${data[0]?.id}`)
          successCount++
        }
      } catch (err) {
        console.log(`خطأ: ${err}`)
      }
    }
    
    console.log(`\nنتيجة: ${successCount} من ${simpleCompanies.length} شركات تم إضافتها`)
    
    // فحص النتائج
    if (successCount > 0) {
      const { data: allCompanies } = await supabase
        .from('companies')
        .select('*')
      
      console.log(`إجمالي الشركات الآن: ${allCompanies?.length || 0}`)
      
      if (allCompanies) {
        for (const company of allCompanies) {
          console.log(`- ${company.name}: ${company.commercial_registration_expiry || 'غير محدد'}`)
        }
      }
      
      console.log('\n✅ تم إصلاح الإحصائيات!')
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

addSimpleCompanies()