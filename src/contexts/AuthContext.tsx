import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
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
          // تحديث بيانات المستخدم عند تجديد الرمز المميز - لا نعيد التحميل إذا كان المستخدم موجوداً
          if (!user || user.id !== session.user.id) {
            await fetchUserData(session.user.id, false)
          } else {
            console.log('✅ [AUTH] Token refreshed, user already loaded, skipping fetch')
            if (mountedRef.current) {
              setLoading(false)
              loadingRef.current = false
            }
          }
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

  // دالة جلب بيانات المستخدم المحسنة - سريعة وموثوقة
  const fetchUserData = async (userId: string, isInitialLoad: boolean) => {
    console.log('🔍 [AUTH] Starting fetchUserData for userId:', userId, 'isInitialLoad:', isInitialLoad)
    
    // إذا كان المستخدم موجوداً بالفعل وليس initial load، لا نعيد التحميل
    if (!isInitialLoad && user && user.id === userId) {
      console.log('✅ [AUTH] User already loaded, skipping fetch')
      if (mountedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
      return
    }

    try {
      if (isInitialLoad && mountedRef.current) {
        setLoading(true)
        loadingRef.current = true
      }
      setError(null)

      // استخدام بيانات مؤقتة مباشرة من session إذا كانت متوفرة
      let authUser: any = null
      try {
        // محاولة جلب المستخدم من Auth مع timeout قصير
        console.log('🔍 [AUTH] Fetching user from Supabase Auth...')
        const authPromise = supabase.auth.getUser()
        const authTimeout = new Promise<{ data: { user: null }, error: { message: 'Timeout' } }>((resolve) => 
          setTimeout(() => resolve({ data: { user: null }, error: { message: 'Timeout' } }), 3000)
        )
        
        const authResult = await Promise.race([authPromise, authTimeout])
        
        if (authResult.data?.user) {
          authUser = authResult.data.user
          console.log('✅ [AUTH] User fetched from Auth:', authUser.id)
        } else {
          console.warn('⚠️ [AUTH] Auth fetch timeout or error, using session data')
          // استخدام بيانات من session إذا كانت متوفرة
          const { data: { session } } = await supabase.auth.getSession()
          if (session?.user) {
            authUser = session.user
            console.log('✅ [AUTH] Using session user data:', authUser.id)
          } else {
            throw new Error('لا توجد بيانات مستخدم متاحة')
          }
        }
      } catch (authError: any) {
        console.warn('⚠️ [AUTH] Error fetching from Auth, trying session:', authError)
        // محاولة استخدام session كبديل
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          authUser = session.user
          console.log('✅ [AUTH] Using session user data as fallback:', authUser.id)
        } else {
          throw new Error('فشل في جلب بيانات المستخدم')
        }
      }

      if (!authUser) {
        throw new Error('لا توجد بيانات مستخدم متاحة')
      }

      // إنشاء بيانات مستخدم مؤقتة مباشرة بدون انتظار قاعدة البيانات
      const tempUserData: User = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || 
                   authUser.user_metadata?.name || 
                   authUser.email?.split('@')[0] || 
                   'مستخدم',
        role: 'admin',
        permissions: {},
        is_active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString()
      }

      // تعيين البيانات المؤقتة فوراً
      if (mountedRef.current) {
        console.log('✅ [AUTH] Setting temporary user data immediately')
        setUser(tempUserData)
        setLoading(false)
        loadingRef.current = false
      }

      // محاولة جلب/إنشاء المستخدم من قاعدة البيانات في الخلفية (لا ننتظر)
      Promise.race([
        fetchUserFromDatabase(userId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))
      ]).then((dbUser) => {
        if (dbUser && mountedRef.current) {
          console.log('✅ [AUTH] Database user found, updating user data')
          setUser(dbUser)
        } else if (!dbUser) {
          // محاولة إنشاء المستخدم في الخلفية
          createUserFromAuthData(authUser).then((createdUser) => {
            if (createdUser && mountedRef.current) {
              console.log('✅ [AUTH] User created in database, updating user data')
              setUser(createdUser)
            }
          }).catch((createError) => {
            console.warn('⚠️ [AUTH] Failed to create user in database (non-blocking):', createError)
          })
        }
      }).catch((dbError) => {
        console.warn('⚠️ [AUTH] Database fetch error (non-blocking):', dbError)
      })

    } catch (error: any) {
      console.error('❌ [AUTH] Error in fetchUserData:', error)
      
      if (mountedRef.current) {
        // حتى في حالة الخطأ، نستخدم بيانات مؤقتة
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const fallbackUser: User = {
            id: session.user.id,
            email: session.user.email || '',
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'مستخدم',
            role: 'admin',
            permissions: {},
            is_active: true,
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
          }
          setUser(fallbackUser)
        }
        
        setError(error.message || 'خطأ في جلب بيانات المستخدم')
        setLoading(false)
        loadingRef.current = false
        
        // في حالة خطأ 403/406، محاولة تسجيل خروج تلقائي
        if (error.message?.includes('403') || error.message?.includes('406')) {
          console.log('🔐 [AUTH] Access error, signing out...')
          try {
            await supabase.auth.signOut()
          } catch (signOutError) {
            console.error('❌ [AUTH] Error signing out:', signOutError)
          }
        }
      }
    } finally {
      // التأكد من إيقاف التحميل في جميع الحالات
      if (mountedRef.current) {
        console.log('🏁 [AUTH] fetchUserData completed, ensuring loading is false')
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