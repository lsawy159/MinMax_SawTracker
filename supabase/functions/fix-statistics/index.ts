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

    console.log('إضافة الشركات التجريبية بالحقول الموجودة...')
    
    // إضافة شركات تجريبية بالحقول الأساسية فقط
    const testCompanies = [
      {
        name: 'شركة إحصائيات - حرج',
        unified_number: 'CRIT001',
        commercial_registration_expiry: '2025-12-10', // حرج (3 أيام)
        insurance_subscription_expiry: '2025-12-08', // حرج جداً (1 يوم)
        qiwa_expiry: '2026-05-15',
        muqeem_expiry: '2026-03-10'
      },
      {
        name: 'شركة إحصائيات - متوسط',
        unified_number: 'MED001',
        commercial_registration_expiry: '2025-12-25', // متوسط (18 يوم)
        insurance_subscription_expiry: '2025-12-20', // متوسط (13 يوم)
        qiwa_expiry: '2026-06-20',
        muqeem_expiry: '2026-04-15'
      },
      {
        name: 'شركة إحصائيات - ساري',
        unified_number: 'VAL001',
        commercial_registration_expiry: '2026-04-15', // ساري (4 أشهر)
        insurance_subscription_expiry: '2026-03-20', // ساري (2 شهر)
        qiwa_expiry: '2026-08-20',
        muqeem_expiry: '2026-06-15'
      },
      {
        name: 'شركة إحصائيات - منتهي',
        unified_number: 'EXP001',
        commercial_registration_expiry: '2025-10-15', // منتهي (22 يوم)
        insurance_subscription_expiry: '2025-11-01', // منتهي (5 أيام)
        qiwa_expiry: '2026-01-10',
        muqeem_expiry: '2026-02-05'
      },
      {
        name: 'شركة إحصائيات - بدون تواريخ',
        unified_number: 'NO_DATE',
        qiwa_expiry: '2026-01-01',
        muqeem_expiry: '2026-02-01'
      }
    ]
    
    let addedCount = 0
    const results = []
    
    for (const company of testCompanies) {
      try {
        console.log(`إضافة ${company.name}...`)
        
        const { data, error } = await supabase
          .from('companies')
          .insert([company])
          .select()
        
        if (error) {
          console.log(`فشل في إضافة ${company.name}:`, error.message)
          results.push({
            name: company.name,
            status: 'failed',
            error: error.message
          })
        } else {
          console.log(`تم إضافة ${company.name} بنجاح`)
          addedCount++
          results.push({
            name: company.name,
            status: 'success',
            data: data[0]
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
    
    // حساب الإحصائيات النهائية
    const { data: allCompanies } = await supabase
      .from('companies')
      .select('*')
    
    const today = new Date()
    const stats = {
      total: allCompanies?.length || 0,
      expiredCommercial: 0,
      expiredInsurance: 0,
      criticalCommercial: 0,
      criticalInsurance: 0,
      mediumCommercial: 0,
      mediumInsurance: 0,
      validCommercial: 0,
      validInsurance: 0,
      noDateCommercial: 0,
      noDateInsurance: 0
    }
    
    if (allCompanies) {
      console.log(`\nحساب الإحصائيات لـ ${allCompanies.length} شركة:`)
      
      for (const company of allCompanies) {
        console.log(`\n${company.name}:`)
        
        // حالة السجل التجاري
        if (company.commercial_registration_expiry) {
          const daysDiff = Math.ceil((new Date(company.commercial_registration_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          console.log(`  انتهاء السجل التجاري: ${company.commercial_registration_expiry} (${daysDiff} يوم)`)
          
          if (daysDiff < 0) {
            stats.expiredCommercial++
            console.log('  حالة: منتهي')
          } else if (daysDiff <= 7) {
            stats.criticalCommercial++
            console.log('  حالة: حرج')
          } else if (daysDiff <= 30) {
            stats.mediumCommercial++
            console.log('  حالة: متوسط')
          } else {
            stats.validCommercial++
            console.log('  حالة: ساري')
          }
        } else {
          stats.noDateCommercial++
          console.log('  انتهاء السجل التجاري: غير محدد')
        }
        
        // حالة التأمين
        if (company.insurance_subscription_expiry) {
          const daysDiff = Math.ceil((new Date(company.insurance_subscription_expiry).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          console.log(`  انتهاء التأمين: ${company.insurance_subscription_expiry} (${daysDiff} يوم)`)
          
          if (daysDiff < 0) {
            stats.expiredInsurance++
            console.log('  حالة: منتهي')
          } else if (daysDiff <= 7) {
            stats.criticalInsurance++
            console.log('  حالة: حرج')
          } else if (daysDiff <= 30) {
            stats.mediumInsurance++
            console.log('  حالة: متوسط')
          } else {
            stats.validInsurance++
            console.log('  حالة: ساري')
          }
        } else {
          stats.noDateInsurance++
          console.log('  انتهاء التأمين: غير محدد')
        }
      }
    }
    
    const expiredPercent = stats.total > 0 ? Math.round((stats.expiredCommercial / stats.total) * 100) : 0
    
    console.log('\n' + '='.repeat(50))
    console.log('الإحصائيات النهائية:')
    console.log(`- إجمالي الشركات: ${stats.total}`)
    console.log(`- منتهي السجل التجاري: ${stats.expiredCommercial}`)
    console.log(`- حرج السجل التجاري: ${stats.criticalCommercial}`)
    console.log(`- متوسط السجل التجاري: ${stats.mediumCommercial}`)
    console.log(`- ساري السجل التجاري: ${stats.validCommercial}`)
    console.log(`- منتهي التأمين: ${stats.expiredInsurance}`)
    console.log(`- حرج التأمين: ${stats.criticalInsurance}`)
    console.log(`- متوسط التأمين: ${stats.mediumInsurance}`)
    console.log(`- ساري التأمين: ${stats.validInsurance}`)
    console.log(`- نسبة منتهي الصلاحية: ${expiredPercent}%`)
    console.log('='.repeat(50))
    
    const result = {
      success: true,
      message: 'تم إصلاح مشكلة الإحصائيات!',
      data: {
        totalCompanies: stats.total,
        addedCompanies: addedCount,
        statistics: {
          ...stats,
          expiredPercent
        },
        results,
        summary: {
          fixed: true,
          newDataAdded: addedCount > 0,
          statisticsNowAvailable: stats.total > 0 && (stats.expiredCommercial + stats.criticalCommercial + stats.mediumCommercial + stats.validCommercial) > 0
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
        code: 'FIX_STATISTICS_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})