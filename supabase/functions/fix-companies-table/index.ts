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

    // إضافة الأعمدة المفقودة
    const { error: schemaError } = await supabase.rpc('exec_sql', {
      sql: `
        -- إضافة الأعمدة المفقودة إذا لم تكن موجودة
        DO $$ 
        BEGIN
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'commercial_registration_status') THEN
            ALTER TABLE companies ADD COLUMN commercial_registration_status TEXT DEFAULT 'غير محدد';
          END IF;
          
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'companies' AND column_name = 'insurance_subscription_status') THEN
            ALTER TABLE companies ADD COLUMN insurance_subscription_status TEXT DEFAULT 'غير محدد';
          END IF;
        END $$;
      `
    })

    if (schemaError) {
      console.error('خطأ في إضافة الأعمدة:', schemaError)
    } else {
      console.log('تم إضافة الأعمدة بنجاح')
    }

    // إضافة البيانات التجريبية
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
        ending_subscription_moqeem_date: '2026-02-12',
        government_documents_renewal: '2026-01-15',
        commercial_registration_status: 'ساري',
        insurance_subscription_status: 'ساري'
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
        ending_subscription_moqeem_date: '2026-02-12',
        government_documents_renewal: '2026-01-15',
        commercial_registration_status: 'ساري',
        insurance_subscription_status: 'ساري'
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
        ending_subscription_moqeem_date: '2026-04-15',
        government_documents_renewal: '2025-12-20',
        commercial_registration_status: 'متوسط (ينتهي خلال شهر)',
        insurance_subscription_status: 'حرج (ينتهي خلال 7 أيام)'
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
        ending_subscription_moqeem_date: '2026-02-05',
        government_documents_renewal: '2025-11-30',
        commercial_registration_status: 'منتهي',
        insurance_subscription_status: 'منتهي'
      }
    ]

    let addedCount = 0
    for (const company of sampleCompanies) {
      const { error } = await supabase
        .from('companies')
        .insert([company])
        .select()
      
      if (error) {
        console.error(`خطأ في إضافة ${company.name}:`, error)
      } else {
        addedCount++
        console.log(`تم إضافة: ${company.name}`)
      }
    }

    // حساب الإحصائيات
    const { data: allCompanies, error: countError } = await supabase
      .from('companies')
      .select('commercial_registration_status, insurance_subscription_status')

    if (!countError && allCompanies) {
      const total = allCompanies.length
      const expiredCommercial = allCompanies.filter(c => c.commercial_registration_status === 'منتهي').length
      const expiredInsurance = allCompanies.filter(c => c.insurance_subscription_status === 'منتهي').length
      const criticalCommercial = allCompanies.filter(c => c.commercial_registration_status?.includes('حرج')).length
      const criticalInsurance = allCompanies.filter(c => c.insurance_subscription_status?.includes('حرج')).length
      const mediumCommercial = allCompanies.filter(c => c.commercial_registration_status?.includes('متوسط')).length
      const mediumInsurance = allCompanies.filter(c => c.insurance_subscription_status?.includes('متوسط')).length

      const result = {
        success: true,
        message: 'تم إصلاح جدول companies بنجاح',
        data: {
          addedCompanies: addedCount,
          totalCompanies: total,
          statistics: {
            total,
            expiredCommercial,
            expiredInsurance,
            criticalCommercial,
            criticalInsurance,
            mediumCommercial,
            mediumInsurance,
            activeCommercial: total - expiredCommercial,
            activeInsurance: total - expiredInsurance
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
        message: 'تم إضافة الأعمدة، لكن فشل في حساب الإحصائيات',
        addedCompanies: addedCount
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('خطأ في Edge Function:', error)
    return new Response(JSON.stringify({ 
      error: { 
        code: 'EDGE_FUNCTION_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})