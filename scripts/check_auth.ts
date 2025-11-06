import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xaqmuiowidnjlchexxdg.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhcW11aW93aWRuamxjaGV4eGRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE4MDI1MjQsImV4cCI6MjA3NzM3ODUyNH0.lvdUFqrMhxiJ12xoZse97rXcyPPYOKLWEW-z61LT2to'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function checkRLSPolicies() {
  try {
    console.log('فحص RLS policies...')
    
    // محاولة جلب الشركات مع anon key
    const { data: companies, error: fetchError } = await supabase
      .from('companies')
      .select('*')
      .limit(3)
    
    if (fetchError) {
      console.log('خطأ في جلب الشركات مع anon key:', fetchError.message)
      
      // محاولة جلب companies من auth.users
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.log('لا يوجد مستخدم مسجل دخول:', authError.message)
      } else {
        console.log('المستخدم الحالي:', authData.user?.email)
      }
      
      // محاولة إنشاء مستخدم افتراضي
      console.log('محاولة تسجيل دخول افتراضي...')
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'admin@sawtracker.com',
        password: 'admin123'
      })
      
      if (signInError) {
        console.log('فشل في تسجيل الدخول:', signInError.message)
        
        // محاولة إنشاء مستخدم جديد
        console.log('محاولة إنشاء مستخدم جديد...')
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: 'admin@sawtracker.com',
          password: 'admin123'
        })
        
        if (signUpError) {
          console.log('فشل في إنشاء المستخدم:', signUpError.message)
        } else {
          console.log('تم إنشاء المستخدم:', signUpData.user?.email)
        }
      } else {
        console.log('تم تسجيل الدخول بنجاح:', signInData.user?.email)
      }
    } else {
      console.log(`نجح في جلب ${companies?.length || 0} شركة مع anon key`)
      if (companies && companies.length > 0) {
        console.log('أول شركة:', companies[0])
      }
    }
    
    // فحص auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
    if (usersError) {
      console.log('خطأ في جلب المستخدمين:', usersError.message)
    } else {
      console.log(`عدد المستخدمين: ${users.users?.length || 0}`)
      users.users?.forEach(user => {
        console.log(`- ${user.email} (${user.id})`)
      })
    }
    
  } catch (error) {
    console.error('خطأ عام:', error)
  }
}

checkRLSPolicies()