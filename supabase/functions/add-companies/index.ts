import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE, PATCH',
  'Access-Control-Max-Age': '86400',
  'Access-Control-Allow-Credentials': 'false'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // إضافة البيانات التجريبية
    const companies = [
      {
        name: 'شركة محمد النفيعي للتشغيل والصيانة',
        unified_number: '7035540473',
        insurance_subscription_number: '647482801',
        qiwa_subscription_number: '13-4016465',
        max_employees: 4,
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
        commercial_registration_expiry: '2025-11-01',
        insurance_subscription_expiry: '2025-10-15',
        qiwa_expiry: '2026-01-10',
        ending_subscription_moqeem_date: '2026-02-05',
        government_documents_renewal: '2025-11-30'
      }
    ]

    let addedCount = 0
    const results = []
    
    for (const company of companies) {
      try {
        const { data, error } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (error) {
          console.log(`فشل في إضافة ${company.name}:`, error.message)
          // جرب إضافة حقول أقل
          const minimalData = {
            name: company.name,
            unified_number: company.unified_number
          }
          
          const { data: minimalResult, error: minimalError } = await supabase
            .from('companies')
            .insert([minimalData])
            .select()
          
          if (minimalError) {
            console.log(`فشل حتى في البيانات الأساسية:`, minimalError.message)
            results.push({ name: company.name, status: 'failed', error: minimalError.message })
          } else {
            console.log(`تم إضافة الحد الأدنى للبيانات لـ ${company.name}`)
            addedCount++
            results.push({ name: company.name, status: 'partial', data: minimalResult[0] })
            
            // الآن جرب تحديث البيانات
            const updateFields = {}
            for (const [key, value] of Object.entries(company)) {
              if (key !== 'name' && key !== 'unified_number') {
                updateFields[key] = value
              }
            }
            
            const { data: updateResult, error: updateError } = await supabase
              .from('companies')
              .update(updateFields)
              .eq('id', minimalResult[0].id)
              .select()
            
            if (updateError) {
              console.log(`فشل في تحديث ${company.name}:`, updateError.message)
              results.push({ name: company.name, status: 'partial', data: minimalResult[0], updateError: updateError.message })
            } else {
              console.log(`تم تحديث ${company.name} بنجاح`)
              results.push({ name: company.name, status: 'full', data: updateResult[0] })
            }
          }
        } else {
          console.log(`تم إضافة ${company.name} بنجاح`)
          addedCount++
          results.push({ name: company.name, status: 'full', data: data[0] })
        }
      } catch (err) {
        console.log(`خطأ في معالجة ${company.name}:`, err)
        results.push({ name: company.name, status: 'error', error: err.message })
      }
    }
    
    // حساب الإحصائيات
    const { data: allCompanies, error: countError } = await supabase
      .from('companies')
      .select('*')
    
    if (!countError && allCompanies) {
      const total = allCompanies.length
      const today = new Date()
      
      const stats = {
        total,
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
        if (company.commercial_registration_expiry) {
          const expiryDate = new Date(company.commercial_registration_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) stats.expiredCommercial++
          else if (daysDiff <= 7) stats.criticalCommercial++
          else if (daysDiff <= 30) stats.mediumCommercial++
          else stats.activeCommercial++
        }
        
        if (company.insurance_subscription_expiry) {
          const expiryDate = new Date(company.insurance_subscription_expiry)
          const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff <= 0) stats.expiredInsurance++
          else if (daysDiff <= 7) stats.criticalInsurance++
          else if (daysDiff <= 30) stats.mediumInsurance++
          else stats.activeInsurance++
        }
      }
      
      const expiredPercent = total > 0 ? Math.round((stats.expiredCommercial / total) * 100) : 0
      
      const result = {
        success: true,
        message: 'تم إصلاح مشكلة الإحصائيات',
        data: {
          addedCompanies: addedCount,
          totalCompanies: total,
          results,
          statistics: {
            ...stats,
            expiredPercent
          }
        }
      }
      
      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ 
      data: { 
        success: true, 
        message: 'تم إضافة الشركات بنجاح',
        addedCompanies: addedCount,
        results
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('خطأ في Edge Function:', error)
    return new Response(JSON.stringify({ 
      error: { 
        code: 'ADD_COMPANIES_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})