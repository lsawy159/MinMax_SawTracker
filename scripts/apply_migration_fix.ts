// Script to apply migration fix to Supabase
// This script applies 20251205_fix_migration_conflicts.sql

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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ خطأ: يجب تعيين VITE_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في ملف .env')
  console.error('   (يُنصح باستخدام SERVICE_ROLE_KEY للوصول الكامل)')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function applyMigrationFix() {
  console.log('🔧 تطبيق migration fix للتعارضات...\n')
  console.log('='.repeat(60))

  try {
    // Read the migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '20251205_fix_migration_conflicts.sql')
    
    if (!existsSync(migrationPath)) {
      console.error(`❌ ملف migration غير موجود: ${migrationPath}`)
      process.exit(1)
    }

    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    console.log('📄 قراءة ملف migration...')
    console.log(`📁 الملف: ${migrationPath}\n`)

    // Split SQL into statements (simple approach - split by semicolon)
    // Note: This is a simplified approach. For production, use a proper SQL parser
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'))

    console.log(`📊 تم العثور على ${statements.length} أمر SQL\n`)

    // Try to execute via RPC if available
    console.log('⚠️  ملاحظة: Supabase Client لا يدعم تنفيذ DDL مباشرة')
    console.log('💡 يجب تطبيق migration يدوياً في Supabase Dashboard\n')
    
    console.log('='.repeat(60))
    console.log('📋 الخطوات المطلوبة:')
    console.log('='.repeat(60))
    console.log('1. افتح Supabase Dashboard → SQL Editor')
    console.log('2. انسخ محتوى الملف: supabase/migrations/20251205_fix_migration_conflicts.sql')
    console.log('3. الصقه في SQL Editor')
    console.log('4. اضغط Run (أو Ctrl+Enter)')
    console.log('5. راجع الرسائل (NOTICE) للتأكد من النجاح')
    console.log('='.repeat(60))
    
    // Show what will be fixed
    console.log('\n📝 ما سيتم إصلاحه:')
    console.log('  ✓ إضافة employee_count إذا كان مفقوداً')
    console.log('  ✓ التأكد من وجود company_type')
    console.log('  ✓ التأكد من حذف tax_number و government_documents_renewal')
    console.log('  ✓ نقل البيانات من الأعمدة القديمة إلى الجديدة')
    console.log('')

    // Check current status
    console.log('🔍 التحقق من الحالة الحالية...\n')
    
    const criticalColumns = ['company_type', 'employee_count', 'tax_number', 'government_documents_renewal']
    const columnStatus: Record<string, boolean> = {}
    
    for (const col of criticalColumns) {
      const { error } = await supabase
        .from('companies')
        .select(col)
        .limit(1)
      
      columnStatus[col] = !error || error.code !== '42703'
    }

    console.log('📋 الحالة الحالية:')
    console.log('-'.repeat(60))
    for (const [col, exists] of Object.entries(columnStatus)) {
      const status = exists ? '✅ موجود' : '❌ غير موجود'
      if (col === 'employee_count' && !exists) {
        console.log(`  ${col}: ${status} ⚠️  (سيتم إضافته)`)
      } else if ((col === 'tax_number' || col === 'government_documents_renewal') && exists) {
        console.log(`  ${col}: ${status} ⚠️  (سيتم حذفه)`)
      } else {
        console.log(`  ${col}: ${status}`)
      }
    }
    console.log('')

  } catch (error: unknown) {
    console.error('❌ خطأ غير متوقع:', error instanceof Error ? error.message : String(error))
    console.error(error)
    process.exit(1)
  }
}

// Run the migration
applyMigrationFix()
  .then(() => {
    console.log('✅ اكتمل التحضير')
    console.log('\n💡 بعد تطبيق migration، شغّل: npx tsx scripts/check_supabase_status.ts للتحقق')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ فشل:', error)
    process.exit(1)
  })

