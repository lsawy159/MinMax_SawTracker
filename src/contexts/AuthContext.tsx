import { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react'
import { supabase, User } from '../lib/supabase'
import { Session, AuthError } from '@supabase/supabase-js'

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

  // حساب الصلاحيات بشكل آمن
  const isAdmin = user?.role === 'admin' && user?.is_active === true

  // تحديث userRef عند تغيير user
  useEffect(() => {
    userRef.current = user
  }, [user])

  // --- إدارة الجلسات في user_sessions ---
  
  /**
   * إنشاء جلسة في جدول user_sessions
   * يتم استدعاؤها تلقائياً بعد تسجيل الدخول الناجح
   */
  const createUserSession = useCallback(async (userId: string, session: Session) => {
    // منع الاستدعاءات المتزامنة
    if (creatingSessionRef.current) {
      console.log('[Auth] Session creation already in progress, skipping duplicate call')
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
        console.log('[Auth] Active session already exists for user, skipping creation')
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

      // الحصول على عنوان IP العام (من خدمة مجانية)
      let clientIP = null
      try {
        const ipResponse = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        })
        if (ipResponse.ok) {
          const ipData = await ipResponse.json()
          clientIP = ipData.ip || null
        }
      } catch (ipError) {
        // تجاهل الأخطاء - IP ليس حرجاً
        console.warn('[Auth] Failed to fetch IP address (non-critical):', ipError)
      }

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
          console.warn('[Auth] user_sessions table not found, skipping session creation')
          return
        }
        console.error('[Auth] Error creating user session:', sessionError)
        // لا نرمي الخطأ هنا لأن إنشاء الجلسة ليس حرجاً لعملية تسجيل الدخول
      } else {
        console.log('[Auth] User session created successfully')
      }
    } catch (error: any) {
      // تجاهل الأخطاء بهدوء - إنشاء الجلسة ليس حرجاً
      console.warn('[Auth] Failed to create user session (non-critical):', error?.message || error)
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
        console.error('[Auth] Error getting initial session:', sessionError)
        setError(sessionError.message)
        setLoading(false)
        loadingRef.current = false
        return
      }
      
      if (initialSession) {
        console.log('[Auth] Initial session found:', initialSession.user.id)
        setSession(initialSession)
        // لا نقم بجلب بيانات المستخدم هنا، authStateChange سيتولى الأمر
      } else {
        // لا يوجد مستخدم، توقف عن التحميل
        console.log('[Auth] No initial session found')
        setLoading(false)
        loadingRef.current = false
      }
    }).catch(err => {
      if (mountedRef.current) {
        initialSessionCheckedRef.current = true
        console.error('[Auth] Critical error during getSession:', err)
        setError(err.message || 'Error loading session')
        setLoading(false)
        loadingRef.current = false
      }
    })

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
            // لا نوقف loading هنا، بل ننتظر fetchUserData
            
            // تحديث last_login عند تسجيل الدخول (فقط عند SIGNED_IN)
            if (event === 'SIGNED_IN') {
              // تحديث last_login في جدول users
              void               void Promise.resolve(supabase
                .from('users')
                .update({ last_login: new Date().toISOString() })
                .eq('id', newSession.user.id))
                .then(({ error }) => {
                  if (error) {
                    console.warn('[Auth] Failed to update last_login:', error)
                  } else {
                    console.log('[Auth] last_login updated successfully')
                  }
                })
                .catch(err => {
                  console.warn('[Auth] Error updating last_login:', err)
                })
              
              // إنشاء جلسة في user_sessions
              createUserSession(newSession.user.id, newSession).catch(err => {
                console.warn('[Auth] Failed to create session (non-critical):', err)
              })

              // تسجيل تسجيل الدخول في activity_log
              void Promise.resolve(supabase
                .from('activity_log')
                .insert({
                  user_id: newSession.user.id,
                  action: 'login',
                  entity_type: 'user',
                  entity_id: newSession.user.id,
                  operation: 'login',
                  details: {
                    email: newSession.user.email,
                    timestamp: new Date().toISOString()
                  },
                  ip_address: null, // سيتم ملؤه من Edge Function إذا كان متاحاً
                  user_agent: navigator.userAgent,
                  operation_status: 'success',
                  affected_rows: 1,
                  created_at: new Date().toISOString()
                }))
                .then(({ error }) => {
                  if (error) {
                    console.warn('[Auth] Failed to log login activity:', error)
                  } else {
                    console.log('[Auth] Login activity logged successfully')
                  }
                })
                .catch(err => {
                  console.warn('[Auth] Error logging login activity:', err)
                })
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
          
          // تحديث last_login للجلسة الأولية (فقط إذا لم يتم التحقق من قبل)
          // إنشاء جلسة في user_sessions للجلسة الأولية (فقط إذا لم تكن موجودة)
          // لا حاجة للتحقق هنا لأن createUserSession تتحقق من ذلك داخلياً
          if (newSession && !initialSessionCheckedRef.current) {
            initialSessionCheckedRef.current = true
            
            // تحديث last_login للجلسة الأولية (إذا لم يتم تحديثه مؤخراً)
            // نتحقق من أن last_login ليس حديثاً (أقل من دقيقة) لتجنب التحديث المتكرر
            void Promise.resolve(supabase
              .from('users')
              .select('last_login')
              .eq('id', newSession.user.id)
              .single())
              .then(({ data: userData }) => {
                if (userData) {
                  const lastLogin = userData.last_login ? new Date(userData.last_login) : null
                  const now = new Date()
                  const minutesSinceLastLogin = lastLogin ? (now.getTime() - lastLogin.getTime()) / (1000 * 60) : Infinity
                  
                  // تحديث فقط إذا كان last_login قديم (أكثر من 5 دقائق) أو غير موجود
                  if (!lastLogin || minutesSinceLastLogin > 5) {
                    void Promise.resolve(supabase
                      .from('users')
                      .update({ last_login: now.toISOString() })
                      .eq('id', newSession.user.id))
                      .then(({ error }) => {
                        if (error) {
                          console.warn('[Auth] Failed to update last_login for initial session:', error)
                        } else {
                          console.log('[Auth] last_login updated for initial session')
                        }
                      })
                      .catch(err => {
                        console.warn('[Auth] Error updating last_login for initial session:', err)
                      })
                  }
                }
              })
              .catch(err => {
                console.warn('[Auth] Error checking/updating last_login for initial session:', err)
              })
            
            createUserSession(newSession.user.id, newSession).catch(err => {
              console.warn('[Auth] Failed to create session (non-critical):', err)
            })
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
      console.log('[Auth] Unmounting AuthProvider')
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
  }, [createUserSession]) // إضافة createUserSession في dependencies


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
      // لا نوقف loading إلا إذا كان getSession() قد اكتمل
      // هذا يمنع redirect غير مرغوب عند refresh
      if (initialSessionCheckedRef.current) {
        setLoading(false)
        loadingRef.current = false
      }
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
      
      // onAuthStateChange سيتولى الباقي (تحديث الجلسة وجلب بيانات المستخدم وإنشاء الجلسة)
      // سيتم إعادة تعيين fetchingRef.current = false في onAuthStateChange عند SIGNED_IN
      console.log('[Auth] Sign in successful, waiting for auth state change...')
      
      // لا حاجة لاستدعاء createUserSession هنا لأن onAuthStateChange يتولى ذلك عند SIGNED_IN event
      
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
      
      console.log('[Auth] User sessions terminated')
    } catch (error: any) {
      // تجاهل الأخطاء بهدوء - إنهاء الجلسات ليس حرجاً
      if (!error?.message?.includes('not found') && !error?.message?.includes('schema cache')) {
        console.warn('[Auth] Failed to terminate user sessions (non-critical):', error?.message || error)
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
      console.log('[Auth] Sign out successful.')
    } catch (err: any) {
      console.error('[Auth] Sign out error:', err)
      setError(err.message || 'Failed to sign out')
    } finally {
      if (mountedRef.current) {
        setLoading(false) // دائماً أوقف التحميل بعد تسجيل الخروج
      }
    }
  }, [user, terminateUserSessions])

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