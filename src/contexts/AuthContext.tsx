import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
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

// إنشاء Context
const AuthContext = createContext<AuthContextType | undefined>(undefined)

// AuthProvider متقدم
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const loadingRef = useRef(true)

  // حساب الصلاحيات بشكل آمن
  const isAdmin = user?.role === 'admin' && user?.is_active === true

  useEffect(() => {
    mountedRef.current = true
    let loadingTimeout: NodeJS.Timeout | null = null

    // إضافة timeout للتحميل لمنع التعليق
    loadingTimeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn('انتهت مهلة التحميل - إيقاف التحميل تلقائياً')
        setLoading(false)
        loadingRef.current = false
        setError('انتهت مهلة التحميل. يرجى إعادة تحميل الصفحة.')
      }
    }, 10000) // 10 ثواني

    // جلب الجلسة الحالية
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession()
        
        if (sessionError) {
          console.error('خطأ في جلب الجلسة:', sessionError)
          setError('خطأ في تحميل بيانات الجلسة')
          if (mountedRef.current) {
            setLoading(false)
            loadingRef.current = false
          }
          if (loadingTimeout) clearTimeout(loadingTimeout)
          return
        }

        if (mountedRef.current) {
          setSession(currentSession)
          if (currentSession?.user) {
            await fetchUserData(currentSession.user.id, true)
          } else {
            if (mountedRef.current) {
              setLoading(false)
              loadingRef.current = false
            }
          }
          if (loadingTimeout) clearTimeout(loadingTimeout)
        }
      } catch (err) {
        console.error('خطأ في تهيئة المصادقة:', err)
        if (mountedRef.current) {
          setError('فشل في تهيئة نظام المصادقة')
          setLoading(false)
          loadingRef.current = false
        }
        if (loadingTimeout) clearTimeout(loadingTimeout)
      }
    }

    initializeAuth()

    // مراقبة تغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return

      console.log('تغيير حالة المصادقة:', event)
      setSession(session)
      setError(null)

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          await fetchUserData(session.user.id, false)
        } else if (event === 'SIGNED_OUT') {
          if (mountedRef.current) {
            setUser(null)
            setLoading(false)
            loadingRef.current = false
          }
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // تحديث بيانات المستخدم عند تجديد الرمز المميز
          await fetchUserData(session.user.id, false)
        } else if (!session) {
          // لا توجد جلسة - إيقاف التحميل
          if (mountedRef.current) {
            setLoading(false)
            loadingRef.current = false
          }
        }
      } catch (error) {
        console.error('خطأ في معالجة تغيير حالة المصادقة:', error)
        if (mountedRef.current) {
          setLoading(false)
          loadingRef.current = false
        }
      }
    })

    return () => {
      mountedRef.current = false
      subscription.unsubscribe()
      if (loadingTimeout) clearTimeout(loadingTimeout)
    }
  }, [])

  // دالة جلب بيانات المستخدم المحسنة
  const fetchUserData = async (userId: string, isInitialLoad: boolean) => {
    try {
      if (isInitialLoad && mountedRef.current) {
        setLoading(true)
        loadingRef.current = true
      }
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
      let userData: User | null = null
      try {
        userData = await fetchUserFromDatabase(userId)
      } catch (dbError) {
        console.warn('خطأ في جلب المستخدم من قاعدة البيانات، سيتم إنشاء حساب جديد:', dbError)
      }
      
      if (!userData) {
        console.log('لم يتم العثور على المستخدم في قاعدة البيانات، إنشاء حساب جديد...')
        try {
          userData = await createUserFromAuthData(authUser)
        } catch (createError) {
          console.error('خطأ في إنشاء المستخدم:', createError)
          // استخدام بيانات مؤقتة في حالة الفشل
          userData = {
            id: authUser.id,
            email: authUser.email || '',
            full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'مستخدم',
            role: 'admin',
            permissions: {},
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
        }
      }

      if (mountedRef.current) {
        setUser(userData)
        setLoading(false)
        loadingRef.current = false
      }
    } catch (error: any) {
      console.error('خطأ في جلب بيانات المستخدم:', error)
      
      if (mountedRef.current) {
        setError(error.message || 'خطأ في جلب بيانات المستخدم')
        setLoading(false)
        loadingRef.current = false
        
        // في حالة خطأ 403/406، محاولة تسجيل خروج تلقائي
        if (error.message?.includes('403') || error.message?.includes('406')) {
          console.log('خطأ وصول، تسجيل خروج تلقائي...')
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.error('خطأ في تسجيل الخروج:', signOutError)
          }
        }
      }
    } finally {
      // التأكد من إيقاف التحميل في جميع الحالات
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
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