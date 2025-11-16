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
  const fetchingRef = useRef(false) // منع الاستدعاءات المتعددة
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null) // debounce
  const currentFetchingUserIdRef = useRef<string | null>(null) // تتبع معرف المستخدم الذي يتم جلب بياناته حالياً
  const userRef = useRef<User | null>(null) // تخزين user الحالي لتجنب إعادة تسجيل listeners

  // حساب الصلاحيات بشكل آمن
  const isAdmin = user?.role === 'admin' && user?.is_active === true

  // تحديث userRef عند تغيير user
  useEffect(() => {
    userRef.current = user
  }, [user])

  useEffect(() => {
    mountedRef.current = true
    let loadingTimeout: NodeJS.Timeout | null = null

    // إضافة debounce بسيط عند بدء التشغيل
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current)
    }

    fetchTimeoutRef.current = setTimeout(() => {
      // التحقق من الجلسة عند تحميل المكون لأول مرة
      supabase.auth.getSession().then(({ data: { session: initialSession }, error: sessionError }) => {
        if (!mountedRef.current) return
        
        if (sessionError) {
          console.error('[Auth] Error getting initial session:', sessionError)
          setError(sessionError.message)
          setLoading(false)
          loadingRef.current = false
          return
        }
        
        if (initialSession) {
          setSession(initialSession)
          // لا نقم بجلب بيانات المستخدم هنا، authStateChange سيتولى الأمر
        } else {
          // لا يوجد مستخدم، توقف عن التحميل
          setLoading(false)
          loadingRef.current = false
        }
      }).catch(err => {
        if (mountedRef.current) {
          console.error('[Auth] Critical error during getSession:', err)
          setError(err.message || 'Error loading session')
          setLoading(false)
          loadingRef.current = false
        }
      })
    }, 100) // تأخير بسيط لـ 100ms

    // تعيين مؤقت للتحميل الأقصى
    loadingTimeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.warn('[Auth] Auth loading timed out after 5s.')
        setLoading(false)
        loadingRef.current = false
      }
    }, 5000)

    // الاستماع لتغيرات حالة المصادقة
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return
        
        console.log(`[Auth] Auth state changed: ${event}`, { 
          hasSession: !!newSession, 
          userId: newSession?.user?.id 
        })
        
        // إعادة تعيين fetchingRef عند الأحداث التي تحتاج إلى جلب بيانات المستخدم
        // فقط إذا كان المستخدم مختلف أو لم يكن هناك مستخدم محمل
        // استخدام userRef.current بدلاً من user لتجنب إعادة تسجيل listener
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED' || event === 'INITIAL_SESSION') {
          if (newSession) {
            const newUserId = newSession.user.id
            // التحقق من أن fetchUserData لا يزال قيد التنفيذ لنفس المستخدم
            const isFetchingSameUser = fetchingRef.current && currentFetchingUserIdRef.current === newUserId
            
            // إعادة تعيين fetchingRef فقط إذا:
            // 1. لم يكن هناك user محمل، أو
            // 2. المستخدم مختلف عن المستخدم المحمل، أو
            // 3. fetchUserData ليس قيد التنفيذ لنفس المستخدم
            if (!isFetchingSameUser && (!userRef.current || newUserId !== userRef.current.id)) {
              fetchingRef.current = false
            }
          }
        }
        
        setSession(newSession)
        
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (newSession) {
            // بيانات المستخدم يتم جلبها الآن عبر useEffect [session]
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setError(null)
          fetchingRef.current = false
        }
        
        // توقف عن التحميل فقط إذا لم يكن هناك جلسة
        if (!newSession) {
          setLoading(false)
          loadingRef.current = false
        }
      }
    )

    // دالة Clean-up
    return () => {
      console.log('[Auth] Unmounting AuthProvider')
      mountedRef.current = false
      authListener?.subscription?.unsubscribe()
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current)
      }
    }
  }, []) // لا نضيف user هنا لأننا نستخدم userRef.current لتجنب إعادة تسجيل listener


  // --- جلب بيانات المستخدم المخصصة ---
  // يتم تشغيل هذا الـ Hook عند تغير الجلسة
  
  const fetchUserData = useCallback(async (session: Session) => {
    const currentUserId = session.user.id
    
    // التحقق من أن fetchUserData لا يزال قيد التنفيذ لنفس المستخدم
    if (fetchingRef.current && currentFetchingUserIdRef.current === currentUserId) {
      console.log('[Auth] Skipping fetchUserData, already in progress for this user')
      return
    }
    
    // التحقق من أن المستخدم لم يتغير (إذا كان هناك user محمل بالفعل)
    // هذا يمنع جلب بيانات المستخدم إذا كان المستخدم مختلف
    if (user && user.id === currentUserId) {
      console.log('[Auth] User data already loaded, skipping fetchUserData')
      setLoading(false)
      loadingRef.current = false
      return
    }
    
    console.log(`[Auth] Fetching user data for user ID: ${currentUserId}`)
    fetchingRef.current = true
    currentFetchingUserIdRef.current = currentUserId // حفظ معرف المستخدم الحالي

    try {
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', currentUserId)
        .single()
      
      if (!mountedRef.current) return
      
      // التحقق من أن المستخدم لم يتغير أثناء التنفيذ
      if (currentFetchingUserIdRef.current !== currentUserId) {
        console.log('[Auth] User changed during fetch, aborting')
        return
      }
      
      if (userError) {
        console.error('[Auth] Error fetching user data:', userError)
        setError(userError.message)
        // إذا فشل جلب بيانات المستخدم، قم بتسجيل الخروج
        // هذا يمنع بقاء المستخدم مسجلاً بجلسة auth ولكن بدون بيانات user
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
      } else if (userData) {
        console.log('[Auth] User data fetched successfully:', userData.email, 'Role:', userData.role)
        setUser(userData)
        setError(null) // مسح أي أخطاء سابقة
      } else {
        console.warn('[Auth] User session exists but no user data found in "users" table.')
        setError('User profile not found. Contacting support.')
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
      }
    } catch (err: any) {
      if (mountedRef.current) {
        console.error('[Auth] Critical error in fetchUserData:', err)
        setError(err.message || 'Failed to fetch user data')
        setUser(null)
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false) // توقف عن التحميل بعد اكتمال جلب البيانات
        loadingRef.current = false
        fetchingRef.current = false
        currentFetchingUserIdRef.current = null
      }
    }
  }, [user]) // إضافة user للتحقق من التغييرات

  // [FIX] تم إصلاح مصفوفة الاعتماديات هنا
  useEffect(() => {
    // التحقق من أن fetchUserData لا يزال قيد التنفيذ قبل الاستدعاء
    if (fetchingRef.current) {
      console.log('[Auth] useEffect: fetchUserData already in progress, skipping')
      return
    }
    
    if (session) {
      // لدينا جلسة - تحقق من الحاجة إلى جلب بيانات المستخدم
      if (!user || session.user.id !== user.id) {
        // بيانات المستخدم غير متطابقة أو غير موجودة - جلب البيانات
        console.log('[Auth] useEffect: Session exists but user data missing or different, fetching...')
        fetchUserData(session)
      } else {
        // بيانات المستخدم موجودة ومتطابقة - لا حاجة للجلب
        console.log('[Auth] useEffect: User data already loaded and matches session')
        setLoading(false)
        loadingRef.current = false
      }
    } else {
      // لا توجد جلسة
      console.log('[Auth] useEffect: No session, clearing user')
      setUser(null)
      setLoading(false)
      loadingRef.current = false
    }
  }, [session, user, fetchUserData]) // fetchUserData يعتمد على user، لذلك يجب إضافته


  // --- دوال المصادقة ---

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    // لا نعين fetchingRef هنا لأن onAuthStateChange سيتولى استدعاء fetchUserData
    
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('[Auth] Sign in error:', signInError)
        throw signInError
      }
      
      // onAuthStateChange سيتولى الباقي (تحديث الجلسة وجلب بيانات المستخدم)
      // سيتم إعادة تعيين fetchingRef.current = false في onAuthStateChange عند SIGNED_IN
      console.log('[Auth] Sign in successful, waiting for auth state change...')
      
    } catch (err: any) {
      if (mountedRef.current) {
        let errorMessage = 'An error occurred during sign in.'
        if (err instanceof AuthError) {
          if (err.message.includes('Email not confirmed')) {
            errorMessage = 'البريد الإلكتروني غير مؤكد. يرجى مراجعة بريدك الإلكتروني.'
          } else if (err.message.includes('Invalid login credentials')) {
            errorMessage = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'
          } else {
            errorMessage = err.message
          }
        }
        console.error('[Auth] Sign in catch block:', errorMessage)
        setError(errorMessage)
        setLoading(false) // توقف التحميل عند الخطأ
        fetchingRef.current = false
      }
    }
    // ملاحظة: لا نقم بتعيين setLoading(false) عند النجاح، لأننا ننتظر fetchUserData
  }, [])

  const signOut = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      
      // onAuthStateChange سيتولى الباقي
      setUser(null)
      setSession(null)
      console.log('[Auth] Sign out successful.')
    } catch (err: any) {
      console.error('[Auth] Sign out error:', err)
      setError(err.message || 'Failed to sign out')
    } finally {
      if (mountedRef.current) {
        setLoading(false) // دائماً أوقف التحميل بعد تسجيل الخروج
      }
    }
  }, [])

  const refreshUserData = useCallback(async () => {
    if (!session) {
      console.log('[Auth] No session, skipping user refresh.')
      return
    }
    
    // وضع التحميل لجلب البيانات
    setLoading(true)
    await fetchUserData(session)
    // fetchUserData سيتولى إيقاف التحميل
    
  }, [session, fetchUserData])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const retryLogin = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    const { data: { session: newSession }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError && mountedRef.current) {
      setError(sessionError.message)
      setLoading(false)
      return
    }
    
    if (newSession && mountedRef.current) {
      setSession(newSession)
      // fetchUserData سيتم تشغيله بواسطة الـ useEffect
    } else if (mountedRef.current) {
      setLoading(false)
    }
  }, [])


  // --- توفير الـ Context ---
  
  // حماية إضافية: إذا كان التحميل لا يزال صحيحاً بعد 10 ثوانٍ، أوقفه
  useEffect(() => {
    const criticalTimeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        console.error('[Auth] CRITICAL: Auth loading forced to false after 10s.')
        setLoading(false)
        loadingRef.current = false
        if (!session) {
          setError('فشل الاتصال بالخادم. حاول مرة أخرى.')
        }
      }
    }, 10000)
    
    return () => clearTimeout(criticalTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -----------------------------------------------------------------
  // (هذا هو الكود المعلق الأصلي الموجود في ملفك - تم الإبقاء عليه)
  // -----------------------------------------------------------------
  // useEffect(() => {
  //   mountedRef.current = true
  //   let loadingTimeout: NodeJS.Timeout | null = null

  //   const fetchInitialSession = async () => {
  //     console.log('[Auth] 1. Starting fetchInitialSession')
  //     try {
  //       // Set loading timeout
  //       loadingTimeout = setTimeout(() => {
  //         if (mountedRef.current && loadingRef.current) {
  //           console.warn('[Auth] Auth loading timed out after 5s.')
  //           setError('Authentication timeout. Please refresh.')
  //           setLoading(false)
  //           loadingRef.current = false
  //         }
  //       }, 5000)

  //       // 1. Get session from Supabase
  //       const { data: { session: initialSession }, error: sessionError } = await supabase.auth.getSession()
  //       if (!mountedRef.current) return
  //       console.log('[Auth] 2. Got initial session:', !!initialSession)

  //       if (sessionError) {
  //         throw new AuthError(sessionError.message, sessionError.status)
  //       }
        
  //       if (initialSession) {
  //         // 3. Set session and fetch user data
  //         setSession(initialSession)
  //         await fetchUserData(initialSession)
  //       } else {
  //         // 3b. No session, stop loading
  //         setLoading(false)
  //         loadingRef.current = false
  //       }
  //     } catch (err: any) {
  //       if (mountedRef.current) {
  //         console.error('[Auth] Error in fetchInitialSession:', err)
  //         setError(err.message || 'Error loading session')
  //         setUser(null)
  //         setSession(null)
  //         setLoading(false)
  //         loadingRef.current = false
  //       }
  //     } finally {
  //       if (loadingTimeout) {
  //         clearTimeout(loadingTimeout)
  //       }
  //     }
  //   }
    
  //   fetchInitialSession()

  //   // 2. Listen for auth state changes
  //   const { data: authListener } = supabase.auth.onAuthStateChange(
  //     async (event, newSession) => {
  //       if (!mountedRef.current) return
        
  //       console.log(`[Auth] Auth state changed: ${event}`, { 
  //         hasSession: !!newSession, 
  //         userId: newSession?.user?.id 
  //       })

  //       if (event === 'INITIAL_SESSION') {
  //         // Already handled by getSession()
  //         return
  //       }

  //       if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
  //         if (newSession) {
  //           setSession(newSession)
  //           // Fetch user data only if user is different or not set
  //           if (!user || user.id !== newSession.user.id) {
  //             await fetchUserData(newSession)
  //           } else {
  //             // Stop loading if user is already correct
  //             setLoading(false)
  //             loadingRef.current = false
  //           }
  //         }
  //       } else if (event === 'SIGNED_OUT') {
  //         setUser(null)
  //         setSession(null)
  //         setError(null)
  //         setLoading(false)
  //         loadingRef.current = false
  //       }
  //     }
  //   )

  //   // Clean-up
  //   return () => {
  //     console.log('[Auth] Unmounting AuthProvider')
  //     mountedRef.current = false
  //     authListener?.subscription?.unsubscribe()
  //     if (loadingTimeout) {
  //       clearTimeout(loadingTimeout)
  //     }
  //   }
  // }, [fetchUserData, user]) // [FIX] Added fetchUserData and user
  // -----------------------------------------------------------------
  // (نهاية الكود المعلق الأصلي)
  // -----------------------------------------------------------------


  return (
    <AuthContext.Provider value={{
      user,
      session,
      loading: loading, // استخدام loading من الـ state
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

// --- [BEGIN FIX] ---

// Hook مخصص لاستخدام AuthContext
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth يجب أن يُستخدم داخل AuthProvider')
  }
  return context
}

// Hook للتحقق من الصلاحيات
// eslint-disable-next-line react-refresh/only-export-components
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
// eslint-disable-next-line react-refresh/only-export-components
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
  
  if (requiredRole === 'admin' && !isAdmin) {
    return { 
      hasAccess: false, 
      loading: false, 
      reason: 'unauthorized' 
    }
  }
  
  // إذا كان المطلوب 'user'، يكفي أن يكون مسجلاً ونشطاً
  
  return { 
    hasAccess: true, 
    loading: false, 
    reason: 'authorized' 
  }
}

// --- [END FIX] ---