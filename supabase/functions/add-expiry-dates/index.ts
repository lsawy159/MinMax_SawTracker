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

    console.log('بدء إضافة تواريخ انتهاء تجريبية...')
    
    // جلب جميع الشركات
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (fetchError) {
      console.error('خطأ في جلب الشركات:', fetchError)
      return new Response(JSON.stringify({
        error: { code: 'FETCH_ERROR', message: fetchError.message }
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    console.log(`تم جلب ${companies?.length || 0} شركة`)
    
    const today = new Date()
    const results = []
    let updatedCount = 0
    
    if (companies && companies.length > 0) {
      for (let i = 0; i < companies.length; i++) {
        const company = companies[i]
        
        try {
          // إنشاء تواريخ انتهاء متنوعة
          let commercialRegExpiry = company.commercial_registration_expiry
          let insuranceExpiry = company.insurance_subscription_expiry
          let qiwaExpiry = company.qiwa_expiry
          let muqeemExpiry = company.muqeem_expiry
          let govRenewalDate = company.government_documents_renewal
          
          // إضافة تواريخ إذا لم تكن موجودة
          if (!commercialRegExpiry) {
            // توزيع الشركات على حالات مختلفة
            const daysToAdd = i % 10 < 3 ? 5 :  // 30% حرج (5 أيام)
                             i % 10 < 6 ? 20 :   // 30% متوسط (20 يوم)
                             Math.floor(Math.random() * 180) + 90 // 40% ساري (90-270 يوم)
            
            const expiryDate = new Date(today)
            expiryDate.setDate(today.getDate() + daysToAdd)
            commercialRegExpiry = expiryDate.toISOString().split('T')[0]
          }
          
          if (!insuranceExpiry) {
            const daysToAdd = i % 8 < 2 ? 3 :   // 25% حرج جداً (3 أيام)
                             i % 8 < 4 ? 15 :   // 25% متوسط (15 يوم)
                             Math.floor(Math.random() * 200) + 60 // 50% ساري (60-260 يوم)
            
            const expiryDate = new Date(today)
            expiryDate.setDate(today.getDate() + daysToAdd)
            insuranceExpiry = expiryDate.toISOString().split('T')[0]
          }
          
          if (!qiwaExpiry) {
            const daysToAdd = Math.floor(Math.random() * 365) + 365 // سنة إلى سنتين
            const expiryDate = new Date(today)
            expiryDate.setDate(today.getDate() + daysToAdd)
            qiwaExpiry = expiryDate.toISOString().split('T')[0]
          }
          
          if (!muqeemExpiry) {
            const daysToAdd = Math.floor(Math.random() * 200) + 90 // 3-7 شهور
            const expiryDate = new Date(today)
            expiryDate.setDate(today.getDate() + daysToAdd)
            muqeemExpiry = expiryDate.toISOString().split('T')[0]
          }
          
          if (!govRenewalDate) {
            // تاريخ التجديد قبل انتهاء السجل التجاري بشهر تقريباً
            const renewalDate = new Date(commercialRegExpiry)
            renewalDate.setMonth(renewalDate.getMonth() - 1)
            govRenewalDate = renewalDate.toISOString().split('T')[0]
          }
          
          // تحديث الشركة
          const { data: updateResult, error: updateError } = await supabase
            .from('companies')
            .update({
              commercial_registration_expiry: commercialRegExpiry,
              insurance_subscription_expiry: insuranceExpiry,
              qiwa_expiry: qiwaExpiry,
              muqeem_expiry: muqeemExpiry,
              government_documents_renewal: govRenewalDate
            })
            .eq('id', company.id)
            .select()
          
          if (updateError) {
            console.log(`فشل في تحديث ${company.name}:`, updateError.message)
            results.push({
              name: company.name,
              status: 'failed',
              error: updateError.message
            })
          } else {
            updatedCount++
            console.log(`تم تحديث ${company.name} - انتهاء السجل: ${commercialRegExpiry}, انتهاء التأمين: ${insuranceExpiry}`)
            results.push({
              name: company.name,
              status: 'success',
              commercialRegExpiry,
              insuranceExpiry,
              data: updateResult[0]
            })
          }
          
        } catch (err) {
          console.log(`خطأ في معالجة ${company.name}:`, err)
          results.push({
            name: company.name,
            status: 'error',
            error: err.message
          })
        }
      }
    }
    
    // حساب الإحصائيات النهائية
    const { data: finalCompanies } = await supabase
      .from('companies')
      .select('*')
    
    const stats = {
      total: finalCompanies?.length || 0,
      expiredCommercial: 0,
      expiredInsurance: 0,
      criticalCommercial: 0,
      criticalInsurance: 0,
      mediumCommercial: 0,
      mediumInsurance: 0,
      validCommercial: 0,
      validInsurance: 0
    }
    
    if (finalCompanies) {
      for (const company of finalCompanies) {
        if (company.commercial_registration_expiry) {
          const daysDiff = Math.ceil((new Date(company.commercial_registration_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff < 0) stats.expiredCommercial++
          else if (daysDiff <= 7) stats.criticalCommercial++
          else if (daysDiff <= 30) stats.mediumCommercial++
          else stats.validCommercial++
        }
        
        if (company.insurance_subscription_expiry) {
          const daysDiff = Math.ceil((new Date(company.insurance_subscription_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          
          if (daysDiff < 0) stats.expiredInsurance++
          else if (daysDiff <= 7) stats.criticalInsurance++
          else if (daysDiff <= 30) stats.mediumInsurance++
          else stats.validInsurance++
        }
      }
    }
    
    const expiredPercent = stats.total > 0 ? Math.round((stats.expiredCommercial / stats.total) * 100) : 0
    
    console.log('الإحصائيات النهائية:', stats)
    
    const result = {
      success: true,
      message: 'تم إضافة تواريخ انتهاء تجريبية وحساب الإحصائيات',
      data: {
        totalCompanies: stats.total,
        updatedCompanies: updatedCount,
        statistics: {
          ...stats,
          expiredPercent
        },
        distribution: {
          commercialReg: {
            expired: stats.expiredCommercial,
            critical: stats.criticalCommercial,
            medium: stats.mediumCommercial,
            valid: stats.validCommercial
          },
          insurance: {
            expired: stats.expiredInsurance,
            critical: stats.criticalInsurance,
            medium: stats.mediumInsurance,
            valid: stats.validInsurance
          }
        }
      }
    }
    
    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('خطأ في Edge Function:', error)
    return new Response(JSON.stringify({ 
      error: { 
        code: 'ADD_DATES_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})