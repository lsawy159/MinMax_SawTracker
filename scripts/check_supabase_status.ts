// Script to check Supabase database status
// This script connects to Supabase and checks the current state of the database

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from .env file manually
function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env')
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf-8')
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').replace(/^["']|["']$/g, '')
          process.env[key.trim()] = value
        }
      }
    })
  }
}

loadEnvFile()

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ خطأ: يجب تعيين VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في ملف .env')
  console.error('   أو SUPABASE_SERVICE_ROLE_KEY للوصول الكامل')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
}


async function checkDatabaseStatus() {
  console.log('🔍 التحقق من حالة قاعدة البيانات Supabase...\n')
  console.log('='.repeat(60))

  try {
    // 1. التحقق من الاتصال
    console.log('\n📡 1. التحقق من الاتصال...')
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { data: healthCheck, error: healthError } = await supabase
      .from('companies')
      .select('count')
      .limit(1)
    
    if (healthError && healthError.code !== 'PGRST116') {
      console.error('❌ خطأ في الاتصال:', healthError.message)
      return
    }
    console.log('✅ الاتصال بقاعدة البيانات ناجح\n')

    // 2. التحقق من الأعمدة في جدول companies
    console.log('📊 2. التحقق من الأعمدة في جدول companies...')
    
    let columnsError: { message: string; original?: unknown } | null = null
    let columns: ColumnInfo[] | null = null
    
    try {
      const result = await supabase.rpc('exec_sql', {
        sql_query: `
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'companies'
            AND column_name IN ('company_type', 'tax_number', 'government_documents_renewal', 
                                'social_insurance_expiry', 'social_insurance_number', 
                                'insurance_subscription_expiry', 'insurance_subscription_number',
                                'notes', 'exemptions', 'employee_count')
          ORDER BY column_name;
        `
      })
      columns = result.data
      columnsError = result.error
    } catch (err: unknown) {
      columnsError = { message: 'RPC function not available', original: err }
    }

    if (columnsError) {
      // Try alternative method using direct query
      console.log('⚠️  RPC function not available, trying alternative method...')
      
      // Check columns by trying to select them
      const criticalColumns = [
        'company_type',
        'tax_number',
        'government_documents_renewal',
        'social_insurance_expiry',
        'social_insurance_number',
        'notes',
        'exemptions',
        'employee_count'
      ]

      const columnStatus: Record<string, boolean> = {}
      
      for (const col of criticalColumns) {
        const { error } = await supabase
          .from('companies')
          .select(col)
          .limit(1)
        
        columnStatus[col] = !error || error.code !== '42703' // 42703 = column does not exist
      }

      console.log('\n📋 حالة الأعمدة:')
      console.log('-'.repeat(60))
      for (const [col, exists] of Object.entries(columnStatus)) {
        const status = exists ? '✅ موجود' : '❌ غير موجود'
        const required = ['company_type', 'social_insurance_expiry', 'social_insurance_number', 'notes', 'exemptions', 'employee_count'].includes(col)
        const shouldNotExist = ['tax_number', 'government_documents_renewal'].includes(col)
        
        if (required && !exists) {
          console.log(`  ${col}: ${status} ⚠️  (مطلوب للكود)`)
        } else if (shouldNotExist && exists) {
          console.log(`  ${col}: ${status} ⚠️  (يجب حذفه)`)
        } else {
          console.log(`  ${col}: ${status}`)
        }
      }
    } else if (columns) {
      console.log('\n📋 الأعمدة الموجودة:')
      console.log('-'.repeat(60))
      columns.forEach((col: ColumnInfo) => {
        console.log(`  ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'NOT NULL'})`)
      })
    }

    // 3. التحقق من الـ Indexes
    console.log('\n📑 3. التحقق من الـ Indexes...')

    // Note: We can't directly check indexes via Supabase client
    // This would require a custom RPC function or direct SQL access
    console.log('⚠️  للتحقق من الـ Indexes، استخدم Supabase SQL Editor مع check_database_status.sql')

    // 4. التحقق من الجداول الأساسية
    console.log('\n🗂️  4. التحقق من الجداول الأساسية...')
    const tables = ['companies', 'employees', 'users', 'projects', 'activity_log', 'notifications', 'user_sessions', 'read_alerts']
    
    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('*')
        .limit(1)
      
      if (error && error.code === '42P01') {
        console.log(`  ${table}: ❌ غير موجود`)
      } else if (error && error.code === 'PGRST116') {
        console.log(`  ${table}: ✅ موجود (فارغ)`)
      } else {
        console.log(`  ${table}: ✅ موجود`)
      }
    }

    // 5. ملخص
    console.log('\n' + '='.repeat(60))
    console.log('📝 ملخص:')
    console.log('='.repeat(60))
    console.log('✅ تم التحقق من الاتصال بقاعدة البيانات')
    console.log('📋 راجع حالة الأعمدة أعلاه')
    console.log('⚠️  للتحقق الكامل من الـ Indexes، استخدم:')
    console.log('   1. افتح Supabase Dashboard → SQL Editor')
    console.log('   2. شغّل ملف: supabase/migrations/check_database_status.sql')
    console.log('\n💡 الخطوات التالية:')
    console.log('   1. إذا كانت هناك أعمدة مفقودة أو يجب حذفها:')
    console.log('      → طبق: supabase/migrations/20251205_fix_migration_conflicts.sql')
    console.log('   2. لتطبيق الـ Indexes:')
    console.log('      → طبق: supabase/migrations/20250121_add_database_indexes.sql')
    console.log('='.repeat(60))

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف'
    console.error('❌ خطأ غير متوقع:', errorMessage)
    console.error(error)
  }
}

// Run the check
checkDatabaseStatus()
  .then(() => {
    console.log('\n✅ اكتمل التحقق')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ فشل التحقق:', error)
    process.exit(1)
  })

