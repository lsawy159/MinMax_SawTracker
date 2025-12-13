import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import { supabase, User } from '../lib/supabase'
import { Session, AuthError } from '@supabase/supabase-js'
import { logger } from '../utils/logger'

// واجهة موسعة للمصادقة
export interface AuthContextType {
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

// إنشاء Context مع نوع صريح
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
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null) // debounce
  const currentFetchingUserIdRef = useRef<string | null>(null) // تتبع معرف المستخدم الذي يتم جلب بياناته حالياً
  const userRef = useRef<User | null>(null) // تخزين user الحالي لتجنب إعادة تسجيل listeners
  const initialSessionCheckedRef = useRef(false) // تتبع ما إذا كان getSession() قد اكتمل
  const creatingSessionRef = useRef(false) // منع إنشاء جلسات متعددة في نفس الوقت

  const clearStaleSession = useCallback(async (reason: string) => {
    logger.warn('[Auth] Clearing stale session due to:', reason)
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } catch (err) {
      logger.warn('[Auth] Failed to clear local session (non-critical):', err)
    } finally {
      if (mountedRef.current) {
        setSession(null)
        setUser(null)
      }
    }
  }, [])

  // حساب الصلاحيات بشكل آمن
  const isAdmin = user?.role === 'admin' && user?.is_active === true

  // تحديث userRef عند تغيير user
  useEffect(() => {
    userRef.current = user
  }, [user])

  // --- إدارة الجلسات في user_sessions ---
  
  /**
   * إنشاء جلسة في جدول user_sessions
   * يتم استدعاؤها فقط من دالة signIn عند تسجيل الدخول اليدوي
   * تسجل نشاط الدخول في activity_log عند إنشاء جلسة جديدة
   */
  const createUserSession = useCallback(async (userId: string, session: Session) => {
    // منع الاستدعاءات المتزامنة
    if (creatingSessionRef.current) {
      logger.debug('[Auth] Session creation already in progress, skipping duplicate call')
      return
    }

    creatingSessionRef.current = true

    try {
      // التحقق من وجود جلسة نشطة للمستخدم أولاً
      const now = new Date().toISOString()
      const { data: existingSessions } = await supabase
        .from('user_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('is_active', true)
        .gt('expires_at', now)
        .limit(1)

      // إذا كانت هناك جلسة نشطة، لا ننشئ جلسة جديدة (تجنب التكرار)
      if (existingSessions && existingSessions.length > 0) {
        logger.debug('[Auth] Active session already exists for user, skipping creation')
        creatingSessionRef.current = false
        return
      }

      // توليد token فريد للجلسة
      const sessionToken = `${crypto.randomUUID()}-${Date.now()}`
      
      // تاريخ انتهاء الصلاحية (8 ساعات من الآن)
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + 8)

      // معلومات الجهاز
      const userAgent = navigator.userAgent || 'Unknown'
      const platform = navigator.platform || 'Unknown'
      const deviceInfo = {
        browser: userAgent.includes('Chrome') ? 'Chrome' 
          : userAgent.includes('Firefox') ? 'Firefox'
          : userAgent.includes('Safari') ? 'Safari'
          : userAgent.includes('Edge') ? 'Edge'
          : 'Other',
        platform: platform,
        userAgent: userAgent,
        created_at: new Date().toISOString()
      }

      // الحصول على عنوان IP (اختياري - يمكن الحصول عليه من Edge Function headers)
      // لا نستخدم خدمات خارجية لأسباب الأمان والخصوصية
      const clientIP: string | null = null
      // في Edge Function، يمكن الحصول على IP من headers:
      // request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip')
      // هنا في Frontend، نتركه null - يمكن ملؤه من Edge Function إذا لزم الأمر

      // إنشاء الجلسة في قاعدة البيانات
      const { error: sessionError } = await supabase
        .from('user_sessions')
        .insert({
          user_id: userId,
          session_token: sessionToken,
          device_info: deviceInfo,
          ip_address: clientIP,
          user_agent: userAgent,
          location: 'غير محدد',
          is_active: true,
          last_activity: new Date().toISOString(),
          expires_at: expiresAt.toISOString()
        })

      if (sessionError) {
        // إذا كان الخطأ بسبب عدم وجود الجدول، نتجاهله بهدوء
        if (sessionError.message?.includes('not found') || sessionError.message?.includes('schema cache')) {
          logger.warn('[Auth] user_sessions table not found, skipping session creation')
          return
        }
        logger.error('[Auth] Error creating user session:', sessionError)
        // لا نرمي الخطأ هنا لأن إنشاء الجلسة ليس حرجاً لعملية تسجيل الدخول
      } else {
        logger.debug('[Auth] User session created successfully')
        
        // تسجيل نشاط الدخول في activity_log فقط عند إنشاء جلسة جديدة
        void Promise.resolve(supabase
          .from('activity_log')
          .insert({
            user_id: userId,
            action: 'login',
            entity_type: 'user',
            entity_id: userId,
            operation: 'login',
            details: {
              email: session.user.email,
              timestamp: new Date().toISOString(),
              session_created: true
            },
            ip_address: null, // سيتم ملؤه من Edge Function إذا كان متاحاً
            user_agent: userAgent,
            operation_status: 'success',
            affected_rows: 1,
            created_at: new Date().toISOString()
          }))
          .then(({ error }) => {
            if (error) {
              logger.warn('[Auth] Failed to log login activity:', error)
            } else {
              logger.debug('[Auth] Login activity logged successfully')
            }
          })
          .catch(err => {
            logger.warn('[Auth] Error logging login activity:', err)
          })
      }
    } catch (error: unknown) {
      // تجاهل الأخطاء بهدوء - إنشاء الجلسة ليس حرجاً
      logger.warn('[Auth] Failed to create user session (non-critical):', error instanceof Error ? error.message : String(error))
    } finally {
      // إعادة تعيين الـ ref بعد انتهاء العملية
      creatingSessionRef.current = false
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    let loadingTimeout: ReturnType<typeof setTimeout> | null = null
    
    // نسخ fetchTimeoutRef.current إلى متغير محلي لتجنب مشاكل linting
    const currentFetchTimeout = fetchTimeoutRef.current

    // إضافة debounce بسيط عند بدء التشغيل
    if (currentFetchTimeout) {
      clearTimeout(currentFetchTimeout)
    }

    // جلب الجلسة مباشرة بدون تأخير عند refresh
    initialSessionCheckedRef.current = false
    supabase.auth.getSession().then(({ data: { session: initialSession }, error: sessionError }) => {
      if (!mountedRef.current) return
      
      initialSessionCheckedRef.current = true
      
      if (sessionError) {
        logger.error('[Auth] Error getting initial session:', sessionError)
        setError(sessionError.message)
        void clearStaleSession(sessionError.message || 'initial getSession failed')
        setLoading(false)
        loadingRef.current = false
        return
      }
      
      if (initialSession) {
        logger.debug('[Auth] Initial session found:', initialSession.user.id)
        setSession(initialSession)
        // لا نقم بجلب بيانات المستخدم هنا، authStateChange سيتولى الأمر
      } else {
        // لا يوجد مستخدم، توقف عن التحميل
        logger.debug('[Auth] No initial session found')
        setLoading(false)
        loadingRef.current = false
      }
    }).catch(err => {
      if (mountedRef.current) {
        initialSessionCheckedRef.current = true
        logger.error('[Auth] Critical error during getSession:', err)
        setError(err.message || 'Error loading session')
        setLoading(false)
        loadingRef.current = false
      }
    })

    // تعيين مؤقت للتحميل الأقصى
    loadingTimeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        logger.warn('[Auth] Auth loading timed out after 5s.')
        setLoading(false)
        loadingRef.current = false
      }
    }, 5000)

    // الاستماع لتغيرات حالة المصادقة
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!mountedRef.current) return
        
        logger.debug(`[Auth] Auth state changed: ${event}`, { 
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
            // لا نوقف loading هنا، بل ننتظر fetchUserData
            
            // ملاحظة: تسجيل نشاط الدخول وإنشاء الجلسة يتم الآن فقط في دالة signIn
            // هذا يضمن عدم تسجيل نشاط دخول عند refresh أو استعادة الجلسة
            // عند حدث SIGNED_IN من refresh، لا نقوم بأي شيء لأن الجلسة تم إنشاؤها بالفعل في signIn
            if (event === 'SIGNED_IN') {
              logger.debug('[Auth] SIGNED_IN event detected (may be from refresh or manual login)')
              // لا نقوم بأي شيء هنا - الجلسة ونشاط الدخول تم إنشاؤهما في signIn عند تسجيل الدخول اليدوي
            }
          } else {
            setLoading(false)
            loadingRef.current = false
          }
        } else if (event === 'INITIAL_SESSION') {
          // عند INITIAL_SESSION، إذا كان هناك session، ننتظر fetchUserData
          // إذا لم يكن هناك session، نوقف loading فوراً
          if (!newSession) {
            setLoading(false)
            loadingRef.current = false
          }
          // إذا كان هناك session، نترك loading كما هو حتى يكتمل fetchUserData
          
          // ملاحظة: لا نقوم بإنشاء جلسة أو تسجيل نشاط دخول هنا
          // INITIAL_SESSION يحدث عند refresh أو استعادة الجلسة، وليس عند تسجيل دخول يدوي
          // تسجيل نشاط الدخول يتم فقط في دالة signIn عند تسجيل الدخول اليدوي
          if (newSession && !initialSessionCheckedRef.current) {
            initialSessionCheckedRef.current = true
            logger.debug('[Auth] INITIAL_SESSION detected (likely from refresh), skipping session creation and login activity logging')
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setError(null)
          fetchingRef.current = false
          setLoading(false)
          loadingRef.current = false
        } else if (!newSession) {
          // أي حدث آخر بدون جلسة
          setLoading(false)
          loadingRef.current = false
        }
      }
    )

    // دالة Clean-up
    return () => {
      logger.debug('[Auth] Unmounting AuthProvider')
      mountedRef.current = false
      authListener?.subscription?.unsubscribe()
      if (loadingTimeout) {
        clearTimeout(loadingTimeout)
      }
      // fetchTimeoutRef قد يتغير أثناء تنفيذ الـ effect، لذلك ننسخه في cleanup
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const timeoutId = fetchTimeoutRef.current
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [createUserSession, clearStaleSession]) // إضافة createUserSession في dependencies


  // --- جلب بيانات المستخدم المخصصة ---
  // يتم تشغيل هذا الـ Hook عند تغير الجلسة
  
  const fetchUserData = useCallback(async (session: Session) => {
    const currentUserId = session.user.id
    
    // التحقق من أن fetchUserData لا يزال قيد التنفيذ لنفس المستخدم
    if (fetchingRef.current && currentFetchingUserIdRef.current === currentUserId) {
      logger.debug('[Auth] Skipping fetchUserData, already in progress for this user')
      return
    }
    
    // استخدام userRef.current بدلاً من user لكسر حلقة الاعتماديات
    const loadedUser = userRef.current

    // التحقق من أن المستخدم لم يتغير (إذا كان هناك user محمل بالفعل)
    // هذا يمنع جلب بيانات المستخدم إذا كان المستخدم مختلف
    if (loadedUser && loadedUser.id === currentUserId) {
      logger.debug('[Auth] User data already loaded, skipping fetchUserData')
      setLoading(false)
      loadingRef.current = false
      return
    }
    
    logger.debug(`[Auth] Fetching user data for user ID: ${currentUserId}`)
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
        logger.debug('[Auth] User changed during fetch, aborting')
        return
      }
      
      if (userError) {
        logger.error('[Auth] Error fetching user data:', userError)
        setError(userError.message)
        // إذا فشل جلب بيانات المستخدم، قم بتسجيل الخروج
        // هذا يمنع بقاء المستخدم مسجلاً بجلسة auth ولكن بدون بيانات user
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
      } else if (userData) {
        logger.debug('[Auth] User data fetched successfully:', userData.email, 'Role:', userData.role)
        setUser(userData)
        setError(null) // مسح أي أخطاء سابقة
      } else {
        logger.warn('[Auth] User session exists but no user data found in "users" table.')
        setError('User profile not found. Contacting support.')
        await supabase.auth.signOut()
        setUser(null)
        setSession(null)
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        logger.error('[Auth] Critical error in fetchUserData:', err)
        setError((err instanceof Error ? err.message : String(err)) || 'Failed to fetch user data')
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
  }, []) // استخدام userRef.current بدلاً من user لكسر حلقة الاعتماديات

  // [FIX] تم إصلاح مصفوفة الاعتماديات هنا
  useEffect(() => {
    // التحقق من أن fetchUserData لا يزال قيد التنفيذ قبل الاستدعاء
    if (fetchingRef.current) {
      logger.debug('[Auth] useEffect: fetchUserData already in progress, skipping')
      return
    }
    
    if (session) {
      const loadedUser = userRef.current

      // لدينا جلسة - تحقق من الحاجة إلى جلب بيانات المستخدم
      if (!loadedUser || session.user.id !== loadedUser.id) {
        // بيانات المستخدم غير متطابقة أو غير موجودة - جلب البيانات
        logger.debug('[Auth] useEffect: Session exists but user data missing or different, fetching...')
        fetchUserData(session)
      } else {
        // بيانات المستخدم موجودة ومتطابقة - لا حاجة للجلب
        logger.debug('[Auth] useEffect: User data already loaded and matches session')
        setLoading(false)
        loadingRef.current = false
      }
    } else {
      // لا توجد جلسة
      logger.debug('[Auth] useEffect: No session, clearing user')
      setUser(null)
      // لا نوقف loading إلا إذا كان getSession() قد اكتمل
      // هذا يمنع redirect غير مرغوب عند refresh
      if (initialSessionCheckedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
    }
  }, [session, fetchUserData]) // استخدام userRef لتجنب إعادة التشغيل غير الضرورية

  // --- دوال المصادقة ---

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    // لا نعين fetchingRef هنا لأن onAuthStateChange سيتولى استدعاء fetchUserData
    
    try {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        logger.error('[Auth] Sign in error:', signInError)
        throw signInError
      }
      
      // بعد نجاح تسجيل الدخول، إنشاء الجلسة وتسجيل نشاط الدخول مباشرة
      // هذا يضمن تسجيل نشاط الدخول فقط عند تسجيل الدخول اليدوي وليس عند refresh
      if (signInData?.session) {
        logger.debug('[Auth] Sign in successful, creating session and logging login activity...')
        
        // تحديث last_login
        void Promise.resolve(supabase
          .from('users')
          .update({ last_login: new Date().toISOString() })
          .eq('id', signInData.session.user.id))
          .then(({ error }) => {
            if (error) {
              logger.warn('[Auth] Failed to update last_login:', error)
            } else {
              logger.debug('[Auth] last_login updated successfully')
            }
          })
          .catch(err => {
            logger.warn('[Auth] Error updating last_login:', err)
          })
        
        // إنشاء الجلسة وتسجيل نشاط الدخول
        // ملاحظة: createUserSession تسجل نشاط الدخول داخلياً عند إنشاء جلسة جديدة
        await createUserSession(signInData.session.user.id, signInData.session).catch(err => {
          logger.warn('[Auth] Failed to create session (non-critical):', err)
        })
      }
      
      // onAuthStateChange سيتولى تحديث الجلسة وجلب بيانات المستخدم
      logger.debug('[Auth] Sign in successful, waiting for auth state change...')
      
    } catch (err: unknown) {
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
        logger.error('[Auth] Sign in catch block:', errorMessage)
        setError(errorMessage)
        setLoading(false) // توقف التحميل عند الخطأ
        fetchingRef.current = false
      }
    }
    // ملاحظة: لا نقم بتعيين setLoading(false) عند النجاح، لأننا ننتظر fetchUserData
  }, [createUserSession])

  /**
   * إنهاء جميع الجلسات النشطة للمستخدم عند تسجيل الخروج
   */
  const terminateUserSessions = useCallback(async (userId: string) => {
    try {
      await supabase
        .from('user_sessions')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('is_active', true)
      
      logger.debug('[Auth] User sessions terminated')
    } catch (error: unknown) {
      // تجاهل الأخطاء بهدوء - إنهاء الجلسات ليس حرجاً
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('not found') && !errorMessage.includes('schema cache')) {
        logger.warn('[Auth] Failed to terminate user sessions (non-critical):', errorMessage)
      }
    }
  }, [])

  const signOut = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    // إنهاء جميع الجلسات النشطة قبل تسجيل الخروج
    if (user) {
      await terminateUserSessions(user.id)
    }
    
    try {
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) throw signOutError
      
      // onAuthStateChange سيتولى الباقي
      setUser(null)
      setSession(null)
      logger.debug('[Auth] Sign out successful.')
    } catch (err: unknown) {
      logger.error('[Auth] Sign out error:', err)
      setError((err instanceof Error ? err.message : String(err)) || 'Failed to sign out')
    } finally {
      if (mountedRef.current) {
        setLoading(false) // دائماً أوقف التحميل بعد تسجيل الخروج
      }
    }
  }, [user, terminateUserSessions])

  const refreshUserData = useCallback(async () => {
    if (!session) {
      logger.debug('[Auth] No session, skipping user refresh.')
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
      await clearStaleSession(sessionError.message || 'retryLogin getSession failed')
      setLoading(false)
      return
    }
    
    if (newSession && mountedRef.current) {
      setSession(newSession)
      // fetchUserData سيتم تشغيله بواسطة الـ useEffect
    } else if (mountedRef.current) {
      setLoading(false)
    }
  }, [clearStaleSession])


  // --- توفير الـ Context ---
  
  // حماية إضافية: إذا كان التحميل لا يزال صحيحاً بعد 10 ثوانٍ، أوقفه
  useEffect(() => {
    const criticalTimeout = setTimeout(() => {
      if (mountedRef.current && loadingRef.current) {
        logger.error('[Auth] CRITICAL: Auth loading forced to false after 10s.')
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
export const useAuth = (): AuthContextType => {
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