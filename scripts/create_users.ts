import { createClient } from '@supabase/supabase-js'

// استبدل هذه القيم بقيم مشروعك من Supabase Dashboard
const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SERVICE_ROLE_KEY'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface UserToCreate {
  email: string
  password: string
  full_name: string
  role: 'user' | 'admin'
}

const usersToCreate: UserToCreate[] = [
  {
    email: 'saud@sawtracker.com',
    password: '@123456@',
    full_name: 'saud',
    role: 'user'
  },
  {
    email: 'islam@sawtracker.com',
    password: '@123456@',
    full_name: 'islam',
    role: 'user'
  },
  {
    email: 'hossam@sawtracker.com',
    password: '@123456@',
    full_name: 'hossam',
    role: 'user'
  }
]

async function createUsers() {
  console.log('🚀 بدء إنشاء المستخدمين...\n')

  for (const userData of usersToCreate) {
    try {
      console.log(`📝 جاري إنشاء المستخدم: ${userData.email}`)

      // التحقق من وجود المستخدم أولاً
      const { data: existingUsers } = await supabase
        .from('users')
        .select('id, email')
        .eq('email', userData.email)
        .single()

      if (existingUsers) {
        console.log(`⚠️  المستخدم ${userData.email} موجود بالفعل، تم تخطيه`)
        continue
      }

      // إنشاء المستخدم في auth.users
      const { data: authUser, error: createAuthError } = await supabase.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true, // تأكيد البريد تلقائياً
        user_metadata: {
          full_name: userData.full_name
        }
      })

      if (createAuthError || !authUser.user) {
        console.error(`❌ فشل في إنشاء المستخدم ${userData.email}:`, createAuthError?.message)
        continue
      }

      console.log(`✅ تم إنشاء المستخدم في auth.users: ${authUser.user.id}`)

      // إنشاء سجل في public.users
      const { data: createdUser, error: createUserError } = await supabase
        .from('users')
        .insert({
          id: authUser.user.id,
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          permissions: {},
          is_active: true
        })
        .select()
        .single()

      if (createUserError) {
        console.error(`❌ فشل في إنشاء سجل في public.users للمستخدم ${userData.email}:`, createUserError.message)
        
        // محاولة حذف المستخدم من auth.users إذا فشل إنشاء السجل
        try {
          await supabase.auth.admin.deleteUser(authUser.user.id)
          console.log(`🗑️  تم حذف المستخدم من auth.users بسبب فشل إنشاء السجل`)
        } catch (deleteError) {
          console.error(`⚠️  فشل في حذف المستخدم من auth.users:`, deleteError)
        }
        continue
      }

      console.log(`✅ تم إنشاء المستخدم بنجاح: ${userData.email} (${userData.full_name})`)
      console.log(`   - ID: ${createdUser.id}`)
      console.log(`   - Role: ${createdUser.role}`)
      console.log(`   - Active: ${createdUser.is_active}\n`)

    } catch (error: any) {
      console.error(`❌ خطأ في إنشاء المستخدم ${userData.email}:`, error.message)
      console.log('')
    }
  }

  console.log('✨ انتهى إنشاء المستخدمين')
}

// تشغيل الدالة
createUsers()
  .then(() => {
    console.log('\n✅ اكتمل تنفيذ السكريبت')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ خطأ في تنفيذ السكريبت:', error)
    process.exit(1)
  })

