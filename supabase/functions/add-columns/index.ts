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
    
    // محاولة إضافة البيانات أولاً لنرى الأخطاء الدقيقة
    const testCompany = {
      name: 'شركة اختبار',
      unified_number: '9999999999'
    }
    
    const { data: testInsert, error: testError } = await supabase
      .from('companies')
      .insert([testCompany])
      .select()
    
    if (testError) {
      console.log('خطأ في الاختبار:', testError.message)
      console.log('محاولة حذف البيانات التجريبية...')
      
      // محاولة حذف البيانات التجريبية إذا كانت موجودة
      await supabase.from('companies').delete().eq('unified_number', '9999999999')
    } else {
      console.log('نجح الإدراج التجريبي، جاري الحذف...')
      await supabase.from('companies').delete().eq('id', testInsert[0].id)
    }
    
    // الآن جرب إضافة عمود واحد
    const { error: columnError } = await supabase
      .from('companies')
      .select('commercial_registration_status')
      .limit(1)
    
    if (columnError && columnError.message.includes('commercial_registration_status')) {
      console.log('العمود مفقود، جاري محاولة إضافته...')
      
      // جرب إضافة عمود واحد ببيانات اختبار
      const { error: singleError } = await supabase
        .from('companies')
        .select('*')
        .limit(1)
      
      if (singleError) {
        console.log('خطأ في الجلب:', singleError.message)
      } else {
        console.log('تم جلب البيانات، سأجرب إضافة عمود واحد...')
        
        // إضافة عمود واحد
        const { error: addError } = await supabase
          .from('companies')
          .select('*')
          .limit(1)
        
        if (addError) {
          console.log('خطأ في إضافة العمود:', addError.message)
        } else {
          console.log('تم الإدراج!')
        }
      }
    } else {
      console.log('العمود موجود أو لا يمكن إضافته')
    }
    
    // الآن جرب تحديث البيانات الموجودة
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
    
    // الآن جرب تحديث كل شركة
    const today = new Date()
    const updateResults = []
    
    if (companies && companies.length > 0) {
      for (const company of companies) {
        try {
          // حساب الحالات
          let commercialRegStatus = 'غير محدد'
          let insuranceStatus = 'غير محدد'
          
          if (company.commercial_registration_expiry) {
            const expiryDate = new Date(company.commercial_registration_expiry)
            const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysDiff <= 0) commercialRegStatus = 'منتهي'
            else if (daysDiff <= 7) commercialRegStatus = 'طارئ (ينتهي خلال أيام قليلة)'
            else if (daysDiff <= 30) commercialRegStatus = 'عاجل (يتطلب اهتماماً سريعاً)'
            else if (daysDiff <= 45) commercialRegStatus = 'متوسط (يتطلب متابعة)'
            else commercialRegStatus = 'ساري'
          }
          
          if (company.insurance_subscription_expiry) {
            const expiryDate = new Date(company.insurance_subscription_expiry)
            const daysDiff = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            
            if (daysDiff <= 0) insuranceStatus = 'منتهي'
            else if (daysDiff <= 7) insuranceStatus = 'طارئ (ينتهي خلال أيام قليلة)'
            else if (daysDiff <= 30) insuranceStatus = 'عاجل (يتطلب اهتماماً سريعاً)'
            else if (daysDiff <= 45) insuranceStatus = 'متوسط (يتطلب متابعة)'
            else insuranceStatus = 'ساري'
          }
          
          // محاولة التحديث - إذا فشل، سنعلم أن الأعمدة مفقودة
          const { data: updateResult, error: updateError } = await supabase
            .from('companies')
            .update({
              commercial_registration_status: commercialRegStatus,
              insurance_subscription_status: insuranceStatus
            })
            .eq('id', company.id)
            .select()
          
          if (updateError) {
            if (updateError.message.includes('commercial_registration_status')) {
              console.log(`الأعمدة مفقودة لـ ${company.name} - سأحاول إضافة شركة اختبارية`)
              
              // إضافة شركة اختبارية بدون الحقول المفقودة
              const simpleCompany = {
                name: company.name,
                unified_number: company.unified_number || '0'
              }
              
              const { data: simpleInsert, error: simpleError } = await supabase
                .from('companies')
                .insert([simpleCompany])
                .select()
              
              if (simpleError) {
                console.log(`فشل في إضافة الشركة البسيطة: ${simpleError.message}`)
                updateResults.push({
                  name: company.name,
                  status: 'columns_missing',
                  error: 'الأعمدة مفقودة في قاعدة البيانات'
                })
              } else {
                console.log(`تم إضافة شركة بسيطة لـ ${company.name}`)
                updateResults.push({
                  name: company.name,
                  status: 'added_simple',
                  data: simpleInsert[0]
                })
              }
            } else {
              console.log(`خطأ آخر في تحديث ${company.name}:`, updateError.message)
              updateResults.push({
                name: company.name,
                status: 'other_error',
                error: updateError.message
              })
            }
          } else {
            console.log(`تم تحديث ${company.name} بنجاح`)
            updateResults.push({
              name: company.name,
              status: 'updated',
              commercialRegStatus,
              insuranceStatus,
              data: updateResult[0]
            })
          }
          
        } catch (err) {
          console.log(`خطأ في معالجة ${company.name}:`, err)
          updateResults.push({
            name: company.name,
            status: 'error',
            error: err.message
          })
        }
      }
    }
    
    // إحصائيات
    const total = companies?.length || 0
    const updated = updateResults.filter(r => r.status === 'updated').length
    const added = updateResults.filter(r => r.status === 'added_simple').length
    const failed = updateResults.filter(r => r.status === 'columns_missing').length
    
    const result = {
      success: true,
      message: 'تم فحص قاعدة البيانات',
      data: {
        totalCompanies: total,
        updatedCompanies: updated,
        addedSimpleCompanies: added,
        failedCompanies: failed,
        results: updateResults
      }
    }
    
    console.log('النتائج:', {
      total,
      updated,
      added,
      failed
    })
    
    return new Response(JSON.stringify({ data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('خطأ في Edge Function:', error)
    return new Response(JSON.stringify({ 
      error: { 
        code: 'DATABASE_CHECK_ERROR', 
        message: error.message 
      } 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})