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

    console.log('بدء إضافة الأعمدة المفقودة...')
    
    // إضافة الأعمدة المفقودة باستخدام RPC
    const { error: addColumnsError } = await supabase.rpc('exec_raw_sql', {
      sql: `
        -- إضافة الأعمدة المفقودة إذا لم تكن موجودة
        DO $$ 
        BEGIN
          -- إضافة عمود حالة السجل التجاري
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'companies' 
                        AND column_name = 'commercial_registration_status') THEN
            ALTER TABLE companies ADD COLUMN commercial_registration_status TEXT DEFAULT 'غير محدد';
            RAISE NOTICE 'تم إضافة عمود commercial_registration_status';
          ELSE
            RAISE NOTICE 'عمود commercial_registration_status موجود بالفعل';
          END IF;
          
          -- إضافة عمود حالة اشتراك التأمينات
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                        WHERE table_name = 'companies' 
                        AND column_name = 'insurance_subscription_status') THEN
            ALTER TABLE companies ADD COLUMN insurance_subscription_status TEXT DEFAULT 'غير محدد';
            RAISE NOTICE 'تم إضافة عمود insurance_subscription_status';
          ELSE
            RAISE NOTICE 'عمود insurance_subscription_status موجود بالفعل';
          END IF;
        END $$;
      `
    })

    if (addColumnsError) {
      console.log('خطأ في إضافة الأعمدة:', addColumnsError)
      // جرب طريقة أخرى
      const { error: altError } = await supabase.rpc('exec_raw_sql', {
        sql: `
          ALTER TABLE companies 
          ADD COLUMN IF NOT EXISTS commercial_registration_status TEXT DEFAULT 'غير محدد',
          ADD COLUMN IF NOT EXISTS insurance_subscription_status TEXT DEFAULT 'غير محدد';
        `
      })
      
      if (altError) {
        console.log('خطأ في الطريقة البديلة:', altError)
        return new Response(JSON.stringify({
          error: { code: 'COLUMN_ADD_ERROR', message: altError.message }
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        })
      }
      console.log('تمت إضافة الأعمدة بالطريقة البديلة')
    } else {
      console.log('تمت إضافة الأعمدة بنجاح')
    }

    // الآن جلب الشركات وتحديث حالاتها
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
    let updatedCount = 0
    const results = []
    
    if (companies && companies.length > 0) {
      for (const company of companies) {
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
          
          // تحديث الشركة
          const { data: updateResult, error: updateError } = await supabase
            .from('companies')
            .update({
              commercial_registration_status: commercialRegStatus,
              insurance_subscription_status: insuranceStatus
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
            updatedCount++
            console.log(`تم تحديث ${company.name}: ${commercialRegStatus}, ${insuranceStatus}`)
            results.push({
              name: company.name,
              status: 'success',
              commercialRegStatus,
              insuranceStatus,
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
      .select('commercial_registration_status, insurance_subscription_status')
    
    const stats = {
      total: finalCompanies?.length || 0,
      expiredCommercial: 0,
      expiredInsurance: 0,
      criticalCommercial: 0,
      criticalInsurance: 0,
      mediumCommercial: 0,
      mediumInsurance: 0,
      activeCommercial: 0,
      activeInsurance: 0
    }
    
    if (finalCompanies) {
      for (const company of finalCompanies) {
        if (company.commercial_registration_status) {
          if (company.commercial_registration_status === 'منتهي') stats.expiredCommercial++
          else if (company.commercial_registration_status.includes('حرج')) stats.criticalCommercial++
          else if (company.commercial_registration_status.includes('متوسط')) stats.mediumCommercial++
          else if (company.commercial_registration_status === 'ساري') stats.activeCommercial++
        }
        
        if (company.insurance_subscription_status) {
          if (company.insurance_subscription_status === 'منتهي') stats.expiredInsurance++
          else if (company.insurance_subscription_status.includes('حرج')) stats.criticalInsurance++
          else if (company.insurance_subscription_status.includes('متوسط')) stats.mediumInsurance++
          else if (company.insurance_subscription_status === 'ساري') stats.activeInsurance++
        }
      }
    }
    
    const expiredPercent = stats.total > 0 ? Math.round((stats.expiredCommercial / stats.total) * 100) : 0
    
    console.log('الإحصائيات النهائية:', stats)
    
    const result = {
      success: true,
      message: 'تم إصلاح قاعدة البيانات وإضافة الأعمدة المفقودة',
      data: {
        totalCompanies: stats.total,
        updatedCompanies: updatedCount,
        statistics: {
          ...stats,
          expiredPercent
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
        code: 'DATABASE_FIX_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})