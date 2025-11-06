import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase, User } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        fetchUserData(session.user.id)
      } else {
        setUser(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const fetchUserData = async (userId: string) => {
    try {
      // محاولة جلب بيانات المستخدم من جدول users
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (!error && data) {
        setUser(data)
        return
      }

      // إذا لم يتم العثور على المستخدم في جدول users، احصل على بيانات المصادقة
      console.log('User not found in database, creating from auth data')
      const { data: authUser, error: authError } = await supabase.auth.getUser()
      
      if (authError || !authUser?.user) {
        console.error('Failed to get auth user:', authError)
        await supabase.auth.signOut() // تسجيل خروج تلقائي للجلسات الفاسدة
        return
      }

      // إنشاء بيانات المستخدم من معلومات المصادقة
      const userData = {
        id: authUser.user.id,
        email: authUser.user.email || '',
        full_name: authUser.user.user_metadata?.full_name || authUser.user.email?.split('@')[0] || 'مستخدم',
        role: 'admin' as const, // افتراضي للمديرين الجدد
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
        console.warn('Could not insert user into database:', insertError)
        // استخدام البيانات المؤقتة حتى لو فشل الإدراج
      }

      setUser(userData)
    } catch (error) {
      console.error('Critical error fetching user data:', error)
      // في حالة فشل شامل، تسجيل خروج لحماية النظام
      await supabase.auth.signOut()
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
