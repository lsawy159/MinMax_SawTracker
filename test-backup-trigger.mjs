#!/usr/bin/env node
/**
 * 🧪 Test script: Trigger a manual backup to test email recipients
 */

const backupUrl = 'https://vpxazxzekkkepfjchjly.supabase.co/functions/v1/automated-backup'
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

async function triggerBackup() {
  console.log('🔄 Triggering manual backup...\n')

  try {
    const response = await fetch(backupUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        backup_type: 'full',
        tables: []
      })
    })

    const data = await response.json()

    console.log('✅ Backup triggered successfully!')
    console.log('\nResponse:')
    console.log(JSON.stringify(data, null, 2))

    if (data.success) {
      console.log('\n📧 Email should be sent to:')
      console.log('  - ahmad.alsawy159@gmail.com (primary)')
      console.log('  - a.g16591@gmail.com (if configured with backupNotifications flag)')
      console.log('\n💡 Check Resend dashboard in a moment: https://resend.com/emails')
    }
  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}

triggerBackup()
