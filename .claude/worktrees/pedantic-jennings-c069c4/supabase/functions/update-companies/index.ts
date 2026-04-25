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

    console.log('بدء حساب الحالات للشركات الموجودة...')
    
    // جلب جميع الشركات الموجودة
    const { data: allCompanies, error: fetchError } = await supabase
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
    
    console.log(`تم جلب ${allCompanies?.length || 0} شركة`)
    
    const today = new Date()
    const results = []
    
    // قراءة إعدادات الحالات مرة واحدة قبل الحلقة
    const { data: statusSettings } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'status_thresholds')
      .maybeSingle()
    
    const thresholds = statusSettings?.setting_value || {
      commercial_reg_urgent_days: 7,   // طارئ
      commercial_reg_high_days: 30,    // عاجل
      commercial_reg_medium_days: 45   // متوسط
    }
    
    if (allCompanies && allCompanies.length > 0) {
      for (const company of allCompanies) {
        try {
          // حساب الحالات
          let commercialRegStatus = 'غير محدد'
          let taxNumber = company.tax_number || null
          
          // حساب حالة السجل التجاري
          
          if (company.commercial_registration_expiry) {
            const expiryDate = new Date(company.commercial_registration_expiry)
            const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysDiff <= 0) {
              commercialRegStatus = 'منتهي'
            } else if (daysDiff <= thresholds.commercial_reg_urgent_days) {
              commercialRegStatus = 'طارئ'
            } else if (daysDiff <= thresholds.commercial_reg_high_days) {
              commercialRegStatus = 'عاجل'
            } else if (daysDiff <= thresholds.commercial_reg_medium_days) {
              commercialRegStatus = 'متوسط'
            } else {
              commercialRegStatus = 'ساري'
            }
          }
          
          // إضافة tax_number إذا كان مفقوداً
          if (!taxNumber) {
            // إنشاء tax_number بناءً على unified_number
            taxNumber = company.unified_number ? `T${company.unified_number}` : `T${company.id}`
          }
          
          // تحديث الشركة
          const { data: updateResult, error: updateError } = await supabase
            .from('companies')
            .update({
              commercial_registration_status: commercialRegStatus,
              insurance_subscription_status: insuranceStatus,
              tax_number: taxNumber
            })
            .eq('id', company.id)
            .select()
          
          if (updateError) {
            console.log(`فشل في تحديث ${company.name}:`, updateError.message)
            results.push({
              name: company.name,
              status: 'failed',
              error: updateError.message,
              commercialRegStatus,
              insuranceStatus
            })
          } else {
            console.log(`تم تحديث ${company.name}: ${commercialRegStatus}, ${insuranceStatus}`)
            results.push({
              name: company.name,
              status: 'success',
              commercialRegStatus,
              insuranceStatus,
              taxNumber,
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
    const { data: finalCompanies, error: finalFetchError } = await supabase
      .from('companies')
      .select('*')
    
    if (!finalFetchError && finalCompanies) {
      const total = finalCompanies.length
      const stats = {
        total,
        expiredCommercial: 0,
        expiredInsurance: 0,
        urgentCommercial: 0,
        highCommercial: 0,
        mediumCommercial: 0,
        urgentInsurance: 0,
        highInsurance: 0,
        mediumInsurance: 0,
        activeCommercial: 0,
        activeInsurance: 0
      }
      
      for (const company of finalCompanies) {
        if (company.commercial_registration_status) {
          if (company.commercial_registration_status === 'منتهي') stats.expiredCommercial++
          else if (company.commercial_registration_status === 'طارئ' || company.commercial_registration_status.includes('طارئ')) stats.urgentCommercial++
          else if (company.commercial_registration_status === 'عاجل' || company.commercial_registration_status.includes('عاجل')) stats.highCommercial++
          else if (company.commercial_registration_status === 'متوسط' || company.commercial_registration_status.includes('متوسط')) stats.mediumCommercial++
          else if (company.commercial_registration_status === 'ساري') stats.activeCommercial++
        }
      }
      
      const expiredPercent = total > 0 ? Math.round((stats.expiredCommercial / total) * 100) : 0
      
      const result = {
        success: true,
        message: 'تم إصلاح الإحصائيات وحساب الحالات',
        data: {
          totalCompanies: total,
          updatedCompanies: results.filter(r => r.status === 'success').length,
          results,
          statistics: {
            ...stats,
            expiredPercent
          }
        }
      }
      
      console.log('الإحصائيات النهائية:', stats)
      
      return new Response(JSON.stringify({ data: result }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify({ 
      data: { 
        success: true, 
        message: 'تم تحديث الشركات',
        results
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('خطأ في Edge Function:', error)
    return new Response(JSON.stringify({ 
      error: { 
        code: 'UPDATE_COMPANIES_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})