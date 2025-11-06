import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function createCompaniesTable() {
  try {
    console.log('فحص وإنشاء جدول companies...')
    
    // إنشاء جدول companies إذا لم يكن موجوداً
    const { data: createResult, error: createError } = await supabase.rpc('create_companies_table')
    
    if (createError) {
      console.log('محاولة إنشاء الجدول بطريقة بديلة...')
      
      // محاولة إضافة عمود واحد للتحقق من وجود الجدول
      const { data: testData, error: testError } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
      
      if (testError) {
        console.error('خطأ في الوصول للجدول:', testError.message)
        console.log('سأحاول إنشاء جدول جديد...')
        return
      }
    }
    
    console.log('الجدول موجود، جاري إضافة الأعمدة...')
    
    // محاولة إضافة الأعمدة بشكل فردي
    try {
      const { data: addColumn1, error: error1 } = await supabase
        .rpc('add_column_if_not_exists', {
          table_name: 'companies',
          column_name: 'commercial_registration_status',
          column_type: 'TEXT',
          default_value: 'غير محدد'
        })
      
      if (error1) {
        console.log('محاولة إضافة عمود status آخر...')
      } else {
        console.log('تم إضافة عمود commercial_registration_status')
      }
    } catch (err) {
      console.log('خطأ في إضافة العمود الأول:', err)
    }
    
    try {
      const { data: addColumn2, error: error2 } = await supabase
        .rpc('add_column_if_not_exists', {
          table_name: 'companies',
          column_name: 'insurance_subscription_status',
          column_type: 'TEXT',
          default_value: 'غير محدد'
        })
      
      if (!error2) {
        console.log('تم إضافة عمود insurance_subscription_status')
      }
    } catch (err) {
      console.log('خطأ في إضافة العمود الثاني:', err)
    }
    
    // إضافة البيانات التجريبية بدون الحقول المفقودة
    console.log('إضافة البيانات التجريبية...')
    
    const sampleCompanies = [
      {
        name: 'شركة محمد النفيعي للتشغيل والصيانة',
        unified_number: '7035540473',
        insurance_subscription_number: '647482801',
        qiwa_subscription_number: '13-4016465',
        max_employees: 4,
        current_employees: 4,
        company_type: 'شركة محدودة',
        commercial_registration_expiry: '2026-01-20',
        insurance_subscription_expiry: '2026-01-14',
        qiwa_expiry: '2026-01-19',
        muqeem_expiry: '2026-02-12',
        government_documents_renewal: '2026-01-15'
      },
      {
        name: 'شركة سواعدنا',
        unified_number: '7035540462',
        insurance_subscription_number: '647482856',
        qiwa_subscription_number: '13-4016490',
        max_employees: 4,
        current_employees: 3,
        company_type: 'شركة مساهمة',
        commercial_registration_expiry: '2026-01-20',
        insurance_subscription_expiry: '2026-01-14',
        qiwa_expiry: '2026-01-19',
        muqeem_expiry: '2026-02-12',
        government_documents_renewal: '2026-01-15'
      },
      {
        name: 'شركة التجديد المحدودة',
        unified_number: '1010101010',
        insurance_subscription_number: '2020202020',
        qiwa_subscription_number: '30-9999999',
        max_employees: 5,
        current_employees: 2,
        company_type: 'شركة محدودة',
        commercial_registration_expiry: '2025-12-15',
        insurance_subscription_expiry: '2025-12-10',
        qiwa_expiry: '2026-03-20',
        muqeem_expiry: '2026-04-15',
        government_documents_renewal: '2025-12-20'
      },
      {
        name: 'شركة منتهية الصلاحية',
        unified_number: '8080808080',
        insurance_subscription_number: '9090909090',
        qiwa_subscription_number: '40-8888888',
        max_employees: 3,
        current_employees: 1,
        company_type: 'شركة مساهمة',
        commercial_registration_expiry: '2025-11-01',
        insurance_subscription_expiry: '2025-10-15',
        qiwa_expiry: '2026-01-10',
        muqeem_expiry: '2026-02-05',
        government_documents_renewal: '2025-11-30'
      }
    ]
    
    let addedCount = 0
    for (const company of sampleCompanies) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (error) {
          console.error(`خطأ في إضافة ${company.name}:`, error.message)
        } else {
          addedCount++
          console.log(`تم إضافة: ${company.name}`)
        }
      } catch (err) {
        console.error(`خطأ في معالجة ${company.name}:`, err)
      }
    }
    
    console.log(`تم إضافة ${addedCount} شركة من أصل ${sampleCompanies.length}`)
    
    // حساب الإحصائيات
    const { data: allCompanies, error: countError } = await supabase
      .from('companies')
      .select('*')
    
    if (!countError && allCompanies) {
      const total = allCompanies.length
      console.log(`تم العثور على ${total} شركة في قاعدة البيانات`)
      
      // حساب الحالات بناءً على التواريخ
      const today = new Date()
      let expiredCommercial = 0
      let expiredInsurance = 0
      let criticalCommercial = 0
      let criticalInsurance = 0
      let mediumCommercial = 0
      let mediumInsurance = 0
      
      for (const company of allCompanies) {
        // حالة السجل التجاري
        if (company.commercial_registration_expiry) {
          const expiryDate = new Date(company.commercial_registration_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            expiredCommercial++
          } else if (daysDiff <= 7) {
            criticalCommercial++
          } else if (daysDiff <= 30) {
            mediumCommercial++
          }
        }
        
        // حالة اشتراك التأمينات
        if (company.insurance_subscription_expiry) {
          const expiryDate = new Date(company.insurance_subscription_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) {
            expiredInsurance++
          } else if (daysDiff <= 7) {
            criticalInsurance++
          } else if (daysDiff <= 30) {
            mediumInsurance++
          }
        }
      }
      
      console.log('الإحصائيات المحسوبة:')
      console.log(`- إجمالي المؤسسات: ${total}`)
      console.log(`- منتهي السجل التجاري: ${expiredCommercial}`)
      console.log(`- منتهي اشتراك التأمينات: ${expiredInsurance}`)
      console.log(`- حرج السجل التجاري: ${criticalCommercial}`)
      console.log(`- حرج اشتراك التأمينات: ${criticalInsurance}`)
      console.log(`- متوسط السجل التجاري: ${mediumCommercial}`)
      console.log(`- متوسط اشتراك التأمينات: ${mediumInsurance}`)
      
      // إنشاء Edge Function لحفظ الحالات في قاعدة البيانات
      console.log('إنشاء Edge Function لحفظ الحالات...')
      
      const today_str = today.toISOString().split('T')[0]
      const updatePromises = allCompanies.map(async (company) => {
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
        
        return { ...company, commercial_registration_status: commercialRegStatus, insurance_subscription_status: insuranceStatus }
      })
      
      const updatedCompanies = await Promise.all(updatePromises)
      
      // محاولة حفظ الحالات (إذا كانت الأعمدة موجودة)
      for (const updatedCompany of updatedCompanies) {
        try {
          const { data: updateResult, error: updateError } = await supabase
            .from('companies')
            .update({
              commercial_registration_status: updatedCompany.commercial_registration_status,
              insurance_subscription_status: updatedCompany.insurance_subscription_status
            })
            .eq('id', updatedCompany.id)
            .select()
          
          if (updateError) {
            console.log(`لم يتم حفظ الحالة لـ ${updatedCompany.name} (الأعمدة مفقودة)`)
          } else {
            console.log(`تم حفظ الحالة لـ ${updatedCompany.name}`)
          }
        } catch (err) {
          console.log(`خطأ في حفظ الحالة لـ ${updatedCompany.name}:`, err)
        }
      }
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

createCompaniesTable()