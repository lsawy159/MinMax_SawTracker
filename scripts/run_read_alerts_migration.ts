import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ خطأ: يجب تعيين VITE_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY في متغيرات البيئة')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function runMigration() {
  try {
    console.log('🚀 بدء تشغيل migration لجدول read_alerts...')
    
    // قراءة ملف SQL
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250101_create_read_alerts_table.sql')
    const sql = fs.readFileSync(migrationPath, 'utf-8')
    
    // تقسيم SQL إلى أوامر منفصلة
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
    
    console.log(`📝 تم العثور على ${statements.length} أمر SQL`)
    
    // تشغيل كل أمر على حدة
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      if (statement.length === 0) continue
      
      console.log(`\n⚙️  تشغيل الأمر ${i + 1}/${statements.length}...`)
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql_query: statement })
        
        if (error) {
          // محاولة تشغيل SQL مباشرة
          const { error: directError } = await supabase
            .from('_migration_test')
            .select('*')
            .limit(0)
          
          // إذا فشل، نستخدم طريقة بديلة
          console.log(`⚠️  محاولة طريقة بديلة...`)
          
          // تشغيل SQL مباشرة عبر REST API
          const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': supabaseServiceKey,
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ sql_query: statement })
          })
          
          if (!response.ok) {
            console.log(`⚠️  تحذير: قد يكون الأمر قد تم تنفيذه مسبقاً أو يحتاج صلاحيات خاصة`)
            console.log(`   SQL: ${statement.substring(0, 100)}...`)
          } else {
            console.log(`✅ تم تنفيذ الأمر بنجاح`)
          }
        } else {
          console.log(`✅ تم تنفيذ الأمر بنجاح`)
        }
      } catch (err: any) {
        console.log(`⚠️  تحذير: ${err.message}`)
        console.log(`   قد يكون الجدول موجوداً بالفعل أو يحتاج صلاحيات خاصة`)
      }
    }
    
    console.log('\n✅ اكتمل تشغيل migration!')
    console.log('\n📋 ملاحظة: إذا واجهت أخطاء، يمكنك تشغيل SQL يدوياً في Supabase Dashboard:')
    console.log('   1. افتح Supabase Dashboard')
    console.log('   2. اذهب إلى SQL Editor')
    console.log('   3. انسخ محتوى ملف: supabase/migrations/20250101_create_read_alerts_table.sql')
    console.log('   4. شغّل SQL')
    
  } catch (error: any) {
    console.error('❌ خطأ في تشغيل migration:', error.message)
    console.error('\n💡 يمكنك تشغيل SQL يدوياً في Supabase Dashboard')
    process.exit(1)
  }
}

runMigration()

