import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, User } from '../lib/supabase'
import { Session, AuthError } from '@supabase/supabase-js'

// واجهة موسعة للمصادقة
interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUserData: () => Promise<void>
  clearError: () => void
  retryLogin: () => Promise<void>
}

// AuthProvider متقدم
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // حساب الصلاحيات بشكل آمن
  const isAdmin = user?.role === 'admin' && user?.is_active === true

  useEffect(() => {
    let mounted = true

    // جلب الجلسة الحالية
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('خطأ في جلب الجلسة:', sessionError)
          setError('خطأ في تحميل بيانات الجلسة')
          if (mounted) setLoading(false)
          return
        }

        if (mounted) {
          setSession(currentSession)
          if (currentSession?.user) {
            await fetchUserData(currentSession.user.id, true)
          } else {
            if (mounted) setLoading(false)
          }
        }
      } catch (err) {
        console.error('خطأ في تهيئة المصادقة:', err)
        if (mounted) {
          setError('فشل في تهيئة نظام المصادقة')
          setLoading(false)
        }
      }
    }

    initializeAuth()

    // مراقبة تغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return

      console.log('تغيير حالة المصادقة:', event)
      setSession(session)
      setError(null)

      if (event === 'SIGNED_IN' && session?.user) {
        await fetchUserData(session.user.id, false)
      } else if (event === 'SIGNED_OUT') {
        setUser(null)
        setLoading(false)
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        // تحديث بيانات المستخدم عند تجديد الرمز المميز
        await fetchUserData(session.user.id, false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // دالة جلب بيانات المستخدم المحسنة
  const fetchUserData = async (userId: string, isInitialLoad: boolean) => {
    try {
      if (isInitialLoad) setLoading(true)
      setError(null)

      // جلب بيانات المستخدم من Supabase Auth
      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser) {
        console.error('خطأ في جلب بيانات المستخدم:', authError)
        throw new Error('فشل في جلب بيانات المستخدم')
      }

      if (authUser.id !== userId) {
        console.warn('عدم تطابق معرف المستخدم')
      }

      // محاولة جلب بيانات المستخدم من جدول users
      let userData = await fetchUserFromDatabase(userId)
      
      if (!userData) {
        console.log('لم يتم العثور على المستخدم في قاعدة البيانات، إنشاء حساب جديد...')
        userData = await createUserFromAuthData(authUser)
      }

      if (mounted) {
        setUser(userData)
        setLoading(false)
      }
    } catch (error: any) {
      console.error('خطأ في جلب بيانات المستخدم:', error)
      
      if (mounted) {
        setError(error.message || 'خطأ في جلب بيانات المستخدم')
        setLoading(false)
        
        // في حالة خطأ 403/406، محاولة تسجيل خروج تلقائي
        if (error.message?.includes('403') || error.message?.includes('406')) {
          console.log('خطأ وصول، تسجيل خروج تلقائي...')
          await supabase.auth.signOut()
        }
      }
    }
  }

  // جلب المستخدم من قاعدة البيانات مع معالجة الأخطاء
  const fetchUserFromDatabase = async (userId: string): Promise<User | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // تصنيف الأخطاء
        if (error.code === 'PGRST116') {
          // لا توجد نتائج
          return null
        } else if (error.code === '42501' || error.message?.includes('403')) {
          // خطأ في الصلاحيات
          console.warn('خطأ في الوصول إلى جدول users - قد تحتاج إلى إنشاء المستخدم')
          return null
        } else if (error.code === '406' || error.message?.includes('406')) {
          // خطأ في تنسيق الطلب
          console.warn('خطأ في تنسيق طلب قاعدة البيانات')
          return null
        } else {
          console.error('خطأ غير متوقع في جلب المستخدم:', error)
          throw error
        }
      }

      return data
    } catch (error) {
      console.error('خطأ في جلب المستخدم من قاعدة البيانات:', error)
      return null
    }
  }

  // إنشاء مستخدم من بيانات Auth
  const createUserFromAuthData = async (authUser: any): Promise<User> => {
    try {
      const userData = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || 
                  authUser.user_metadata?.name || 
                  authUser.email?.split('@')[0] || 
                  'مستخدم جديد',
        role: 'admin' as const, // الافتراضي للمديرين
        permissions: {},
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }

      // محاولة إدراج المستخدم في قاعدة البيانات
      const { error: insertError } = await supabase
        .from('users')
        .insert([userData])

      if (insertError) {
        console.warn('فشل في إدراج المستخدم في قاعدة البيانات:', insertError)
        // الاستمرار بالبيانات المؤقتة
      } else {
        console.log('تم إنشاء المستخدم بنجاح في قاعدة البيانات')
      }

      return userData
    } catch (error) {
      console.error('خطأ في إنشاء المستخدم:', error)
      
      // إرجاع بيانات مؤقتة في حالة الفشل
      return {
        id: authUser.id,
        email: authUser.email || '',
        full_name: 'مستخدم',
        role: 'admin',
        permissions: {},
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }
    }
  }

  // تسجيل الدخول
  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true)
      setError(null)

      const { error } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('بيانات الدخول غير صحيحة')
        } else if (error.message.includes('Email not confirmed')) {
          throw new Error('يرجى تأكيد البريد الإلكتروني أولاً')
        } else {
          throw new Error(error.message || 'فشل في تسجيل الدخول')
        }
      }

      // لا نحتاج لشيء هنا، onAuthStateChange سيتولى باقي العمل
    } catch (error: any) {
      console.error('خطأ في تسجيل الدخول:', error)
      setError(error.message)
      throw error
    } finally {
      setLoading(false)
    }
  }

  // تسجيل الخروج
  const signOut = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const { error } = await supabase.auth.signOut()
      if (error) throw error

      setUser(null)
      setSession(null)
    } catch (error: any) {
      console.error('خطأ في تسجيل الخروج:', error)
      setError('فشل في تسجيل الخروج')
    } finally {
      setLoading(false)
    }
  }

  // تحديث بيانات المستخدم
  const refreshUserData = async () => {
    if (session?.user) {
      await fetchUserData(session.user.id, false)
    }
  }

  // مسح الأخطاء
  const clearError = () => {
    setError(null)
  }

  // إعادة محاولة تسجيل الدخول
  const retryLogin = async () => {
    if (session?.user) {
      await fetchUserData(session.user.id, false)
    } else {
      setError('لا توجد جلسة نشطة لإعادة المحاولة')
    }
  }

  return (
    <AuthContext.Provider value={{ 
        user, 
        session, 
        loading, 
        isAdmin, 
        error, 
        signIn, 
        signOut, 
        refreshUserData, 
        clearError, 
        retryLogin 
      }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook مخصص لاستخدام AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider')
  }
  return context
}

// Hook للتحقق من الصلاحيات
export const useRequireAuth = () => {
  const { user, session, loading } = useAuth()
  
  if (loading) {
    return { 
      user: null, 
      session: null, 
      loading: true, 
      isAuthenticated: false,
      isAdmin: false 
    }
  }
  
  return {
    user,
    session,
    loading: false,
    isAuthenticated: !!session && !!user,
    isAdmin: user?.role === 'admin' && user?.is_active === true
  }
}

// Hook لحماية الصفحات
export const usePageProtection = (requiredRole?: 'admin' | 'user') => {
  const { user, session, loading, isAdmin } = useAuth()
  
  if (loading) {
    return { 
      hasAccess: false, 
      loading: true, 
      reason: 'loading' 
    }
  }
  
  if (!session || !user) {
    return { 
      hasAccess: false, 
      loading: false, 
      reason: 'unauthenticated' 
    }
  }
  
  if (!user.is_active) {
    return { 
      hasAccess: false, 
      loading: false, 
      reason: 'inactive' 
    }
  }
  
  if (requiredRole && user.role !== requiredRole) {
    return { 
      hasAccess: false, 
      loading: false, 
      reason: 'insufficient_role' 
    }
  }
  
  return { 
    hasAccess: true, 
    loading: false, 
    reason: null 
  }
}