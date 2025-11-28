// Script to run read_alerts migration
// This script will execute the SQL migration to create the read_alerts table

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Get environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ خطأ: يجب تعيين VITE_SUPABASE_URL و VITE_SUPABASE_ANON_KEY في متغيرات البيئة')
  console.error('   أو يمكنك تشغيل SQL يدوياً في Supabase Dashboard')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function runMigration() {
  try {
    console.log('🚀 بدء تشغيل migration لجدول read_alerts...\n')
    
    // Read SQL file
    const migrationPath = join(__dirname, '../supabase/migrations/20250101_create_read_alerts_table.sql')
    const sql = readFileSync(migrationPath, 'utf-8')
    
    console.log('📝 قراءة ملف SQL...')
    console.log('📋 محتوى SQL:')
    console.log('─'.repeat(50))
    console.log(sql)
    console.log('─'.repeat(50))
    console.log('\n')
    
    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📊 تم العثور على ${statements.length} أمر SQL\n`)
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length === 0) continue
      
      console.log(`⚙️  تشغيل الأمر ${i + 1}/${statements.length}...`)
      console.log(`   SQL: ${statement.substring(0, 80)}...`)
      
      try {
        // Try to execute via RPC (if available)
        const { error: rpcError } = await supabase.rpc('exec_sql', { 
          sql_query: statement 
        })
        
        if (rpcError) {
          // If RPC doesn't work, try direct query
          // Note: This might not work for DDL statements, so we'll show instructions
          console.log(`   ⚠️  لا يمكن تشغيل DDL مباشرة عبر Supabase Client`)
          console.log(`   💡 يجب تشغيل SQL يدوياً في Supabase Dashboard`)
        } else {
          console.log(`   ✅ تم تنفيذ الأمر بنجاح`)
        }
      } catch (err) {
        console.log(`   ⚠️  خطأ: ${err.message}`)
        console.log(`   💡 يجب تشغيل SQL يدوياً في Supabase Dashboard`)
      }
    }
    
    console.log('\n' + '='.repeat(50))
    console.log('📋 تعليمات تشغيل SQL يدوياً:')
    console.log('='.repeat(50))
    console.log('1. افتح Supabase Dashboard: https://supabase.com/dashboard')
    console.log('2. اختر مشروعك')
    console.log('3. اذهب إلى SQL Editor (في القائمة الجانبية)')
    console.log('4. انسخ محتوى ملف: supabase/migrations/20250101_create_read_alerts_table.sql')
    console.log('5. الصق SQL في المحرر')
    console.log('6. اضغط على "Run" أو "Execute"')
    console.log('='.repeat(50))
    console.log('\n✅ اكتمل التحضير!')
    
  } catch (error) {
    console.error('\n❌ خطأ في تشغيل migration:', error.message)
    console.error('\n💡 يمكنك تشغيل SQL يدوياً في Supabase Dashboard')
    process.exit(1)
  }
}

runMigration()

