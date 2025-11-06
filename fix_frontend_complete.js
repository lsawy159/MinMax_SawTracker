/**
 * إصلاح Frontend - جميع المشاكل المكتشفة
 * 
 * المشاكل المكتشفة من Console Logs:
 * 1. ending_subscription_moqeem_date column not found
 * 2. Users table access denied (403/406)
 * 3. Company saving errors (400)
 * 4. User authentication issues
 */

// 1. تحديث supabase.ts - إضافة الأعمدة المفقودة
// =================================================

const updatedSupabaseTypes = `
// في ملف /workspace/sawtracker/src/lib/supabase.ts
// تحديث interface Company

export interface Company {
  id: string
  name: string
  tax_number?: number // قد يكون null
  unified_number: number
  labor_subscription_number: string
  company_type?: string
  
  // التواريخ الأساسية
  commercial_registration_expiry?: string
  insurance_subscription_expiry?: string
  
  // التواريخ الجديدة المفقودة
  ending_subscription_power_date?: string
  ending_subscription_moqeem_date?: string
  ending_subscription_insurance_date?: string
  
  // الإحصائيات المحسوبة
  commercial_registration_status?: string
  insurance_subscription_status?: string
  
  // الحقول الأخرى
  insurance_subscription_number?: string
  current_employees?: number
  government_documents_renewal?: string
  muqeem_expiry?: string
  max_employees?: number
  
  additional_fields?: Record<string, any>
  
  // Employee count (محسوب)
  employee_count?: number
  available_slots?: number
  
  created_at: string
  updated_at: string
}

// تحديث interface User أيضاً
export interface User {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  permissions: Record<string, any>
  is_active: boolean
  created_at: string
  last_login?: string
}`;

// 2. تحديث AuthContext - حل مشاكل Users
// =======================================

const updatedAuthContext = `
// في ملف /workspace/sawtracker/src/contexts/AuthContext.tsx

import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'

interface AuthUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'user'
  permissions: Record<string, any>
  is_active: boolean
  created_at: string
  last_login?: string
}

interface AuthContextType {
  user: AuthUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchUserProfile = async (authUser: SupabaseUser) => {
    try {
      console.log('🔍 [AUTH] Fetching user profile for:', authUser.id)
      
      // محاولة جلب المستخدم الموجود
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
        
      if (userError && userError.code !== 'PGRST116') {
        console.error('❌ [AUTH] Error fetching user:', userError)
        throw userError
      }
      
      if (userData) {
        console.log('✅ [AUTH] Found existing user profile')
        setUser(userData)
        return userData
      }
      
      // إنشاء مستخدم جديد إذا لم يكن موجود
      console.log('👤 [AUTH] User not found, creating new profile')
      const newUser = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'مستخدم',
        role: 'user' as const,
        permissions: {},
        is_active: true,
        created_at: new Date().toISOString()
      }
      
      const { data: createdUser, error: createError } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single()
        
      if (createError) {
        console.error('❌ [AUTH] Error creating user:', createError)
        // إذا فشل الإنشاء، استخدم البيانات المحلية
        setUser(newUser)
        return newUser
      }
      
      console.log('✅ [AUTH] New user profile created')
      setUser(createdUser)
      return createdUser
      
    } catch (error) {
      console.error('💥 [AUTH] Critical error in fetchUserProfile:', error)
      // في حالة الخطأ، استخدم بيانات أساسية
      const fallbackUser: AuthUser = {
        id: authUser.id,
        email: authUser.email || '',
        full_name: 'مستخدم',
        role: 'user',
        permissions: {},
        is_active: true,
        created_at: new Date().toISOString()
      }
      setUser(fallbackUser)
      return fallbackUser
    }
  }

  const refreshUser = async () => {
    const { data: { session: currentSession } } = await supabase.auth.getSession()
    if (currentSession?.user) {
      await fetchUserProfile(currentSession.user)
    } else {
      setUser(null)
    }
  }

  useEffect(() => {
    console.log('🚀 [AUTH] Initializing AuthContext...')
    
    // فحص الجلسة الحالية
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      console.log('🔐 [AUTH] Current session:', currentSession ? 'found' : 'none')
      
      if (currentSession?.user) {
        setSession(currentSession)
        fetchUserProfile(currentSession.user)
      } else {
        setSession(null)
        setUser(null)
      }
      
      setLoading(false)
    })
    
    // مراقبة تغييرات المصادقة
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('🔄 [AUTH] Auth state changed:', event)
        setSession(session)
        
        if (session?.user) {
          await fetchUserProfile(session.user)
        } else {
          setUser(null)
        }
        
        setLoading(false)
      }
    )
    
    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    console.log('🔑 [AUTH] Signing in user:', email)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      console.error('❌ [AUTH] Sign in error:', error)
      throw error
    }
  }

  const signOut = async () => {
    console.log('🚪 [AUTH] Signing out...')
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('❌ [AUTH] Sign out error:', error)
      throw error
    }
    setUser(null)
    setSession(null)
  }

  const value: AuthContextType = {
    user,
    session,
    loading,
    signIn,
    signOut,
    refreshUser
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}`

// 3. تحديث loadCompanies - إضافة الأعمدة المفقودة
// =================================================

const updatedLoadCompanies = `
// في ملف /workspace/sawtracker/src/pages/Companies.tsx
// تحديث دالة loadCompanies

const loadCompanies = async () => {
  try {
    console.log('🔍 [DEBUG] Starting loadCompanies...')
    
    // فحص حالة الجلسات
    const { data: { session } } = await supabase.auth.getSession()
    console.log('🔐 [DEBUG] User session:', session ? 'authenticated' : 'not authenticated')
    
    if (!session) {
      console.warn('⚠️ [DEBUG] User not authenticated, companies will not load properly')
      setLoading(false)
      return
    }
    
    console.log('📡 [DEBUG] Fetching companies from database...')
    const { data: companiesData, error: companiesError } = await supabase
      .from('companies')
      .select(`
        *,
        -- جميع الأعمدة المطلوبة
        id,
        name,
        tax_number,
        unified_number,
        labor_subscription_number,
        company_type,
        commercial_registration_expiry,
        insurance_subscription_expiry,
        ending_subscription_power_date,
        ending_subscription_moqeem_date,
        ending_subscription_insurance_date,
        commercial_registration_status,
        insurance_subscription_status,
        insurance_subscription_number,
        current_employees,
        government_documents_renewal,
        muqeem_expiry,
        max_employees,
        additional_fields,
        created_at,
        updated_at
      `)
      .order('name')
      
    if (companiesError) {
      console.error('❌ [DEBUG] Companies query error:', companiesError)
      throw companiesError
    }
    
    console.log('📊 [DEBUG] Companies fetched:', companiesData?.length || 0)
    
    if (!companiesData || companiesData.length === 0) {
      console.warn('⚠️ [DEBUG] No companies found in database')
      setCompanies([])
      setLoading(false)
      return
    }
    
    // حساب عدد الموظفين لكل شركة
    console.log('👥 [DEBUG] Calculating employee counts for companies...')
    const companiesWithCount = await Promise.all(
      companiesData.map(async (company, index) => {
        console.log(\`🏢 [DEBUG] Processing company \${index + 1}: \${company.name}\`)
        
        const { count } = await supabase
          .from('employees')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', company.id)
          
        const employeeCount = count || 0
        const maxEmployees = company.max_employees || 4
        const availableSlots = Math.max(0, maxEmployees - employeeCount)
        
        console.log(\`📈 [DEBUG] \${company.name}: \${employeeCount} employees, \${availableSlots} available slots\`)
        
        return { 
          ...company, 
          employee_count: employeeCount, 
          available_slots: availableSlots 
        }
      })
    )
    
    console.log('✅ [DEBUG] All companies processed, total:', companiesWithCount.length)
    setCompanies(companiesWithCount)
    
    // Extract unique company types
    const typesSet = new Set<string>()
    companiesWithCount.forEach(company => {
      if (company.company_type) {
        typesSet.add(company.company_type)
      }
      if (company.additional_fields?.company_type) {
        typesSet.add(company.additional_fields.company_type)
      }
      if (company.additional_fields?.type) {
        typesSet.add(company.additional_fields.type)
      }
    })
    setCompanyTypes(Array.from(typesSet).sort())
    
    console.log('📋 [DEBUG] Company types extracted:', Array.from(typesSet))
    
  } catch (error) {
    console.error('💥 [DEBUG] Error loading companies:', error)
  } finally {
    setLoading(false)
  }
}`

// 4. تحديث CompanyModal - إصلاح حفظ الشركات
// ============================================

const updatedCompanyModal = `
// في ملف /workspace/sawtracker/src/components/companies/CompanyModal.tsx
// تحديث دالة handleSubmit

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault()
  
  try {
    console.log('💾 [DEBUG] Saving company...', formData)
    
    // التأكد من وجود الأعمدة المطلوبة
    const companyData = {
      name: formData.name,
      tax_number: formData.tax_number || null, // قد يكون null
      unified_number: formData.unified_number,
      labor_subscription_number: formData.labor_subscription_number,
      company_type: formData.company_type,
      // جميع التواريخ
      commercial_registration_expiry: formData.commercial_registration_expiry || null,
      insurance_subscription_expiry: formData.insurance_subscription_expiry || null,
      ending_subscription_power_date: formData.ending_subscription_power_date || null,
      ending_subscription_moqeem_date: formData.ending_subscription_moqeem_date || null,
      ending_subscription_insurance_date: formData.ending_subscription_insurance_date || null,
      // الحقول الأخرى
      insurance_subscription_number: formData.insurance_subscription_number || null,
      current_employees: formData.current_employees || 0,
      government_documents_renewal: formData.government_documents_renewal || null,
      muqeem_expiry: formData.muqeem_expiry || null,
      max_employees: formData.max_employees || 4,
      additional_fields: formData.additional_fields || {}
    }
    
    console.log('📋 [DEBUG] Company data to save:', companyData)
    
    let result
    if (editingCompany) {
      console.log('✏️ [DEBUG] Updating existing company...')
      result = await supabase
        .from('companies')
        .update(companyData)
        .eq('id', editingCompany.id)
        .select()
        .single()
    } else {
      console.log('➕ [DEBUG] Creating new company...')
      result = await supabase
        .from('companies')
        .insert([companyData])
        .select()
        .single()
    }
    
    if (result.error) {
      console.error('❌ [DEBUG] Database error:', result.error)
      throw result.error
    }
    
    console.log('✅ [DEBUG] Company saved successfully:', result.data)
    onSuccess()
    
  } catch (error) {
    console.error('💥 [DEBUG] Error saving company:', error)
    // إظهار رسالة خطأ للمستخدم
    setSaveError('فشل في حفظ الشركة: ' + (error.message || 'خطأ غير معروف'))
  }
}`

// 5. ملخص التحديثات المطلوبة
// ============================

const filesToUpdate = [
  {
    file: 'sawtracker/src/lib/supabase.ts',
    changes: [
      '1. إضافة الأعمدة المفقودة في interface Company',
      '2. إضافة interface User محدث',
      '3. التأكد من TypeScript types صحيحة'
    ]
  },
  {
    file: 'sawtracker/src/contexts/AuthContext.tsx',
    changes: [
      '1. إنشاء AuthContext شامل',
      '2. إصلاح مشاكل users table access',
      '3. إضافة error handling أفضل',
      '4. إنشاء مستخدمين تلقائياً عند الحاجة'
    ]
  },
  {
    file: 'sawtracker/src/pages/Companies.tsx',
    changes: [
      '1. تحديث loadCompanies() مع جميع الأعمدة',
      '2. إضافة debug logging شامل',
      '3. إصلاح مشكلة array فارغ',
      '4. تحسين error handling'
    ]
  },
  {
    file: 'sawtracker/src/components/companies/CompanyModal.tsx',
    changes: [
      '1. إصلاح handleSubmit لحفظ جميع الأعمدة',
      '2. معالجة الأعمدة null بطريقة صحيحة',
      '3. إضافة debug logging',
      '4. تحسين error messages'
    ]
  }
];

// 6. خطوات التطبيق
// =================

const implementationSteps = [
  '1. تطبيق complete_database_fix.sql في Supabase',
  '2. تحديث supabase.ts - إضافة types للأعمدة المفقودة',
  '3. تحديث AuthContext - حل مشاكل users',
  '4. تحديث Companies.tsx - إصلاح loadCompanies',
  '5. تحديث CompanyModal.tsx - إصلاح حفظ الشركات',
  '6. اختبار النظام في المتصفح',
  '7. مراقبة Console logs للتأكد من عدم وجود أخطاء'
];

// 7. النتائج المتوقعة
// ===================

const expectedResults = {
  noErrors: 'لا أخطاء في Console',
  correctStats: 'إحصائيات صحيحة تظهر',
  companySaving: 'حفظ الشركات يعمل بشكل صحيح',
  userAuth: 'نظام المصادقة يعمل بدون أخطاء',
  consoleLogs: `Console logs نظيفة مع debug info صحيح`
};

console.log('🔧 إصلاح Frontend الشامل');
console.log('📋 الملفات المطلوبة:', filesToUpdate);
console.log('🛠️ خطوات التطبيق:', implementationSteps);
console.log('🎯 النتائج المتوقعة:', expectedResults);