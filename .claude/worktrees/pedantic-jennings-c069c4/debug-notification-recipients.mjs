#!/usr/bin/env node
/**
 * Debug script: Check notification recipients in database
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function debug() {
  console.log('🔍 Fetching notification_recipients from database...\n')

  const { data, error } = await supabase
    .from('system_settings')
    .select('setting_key, setting_value')
    .eq('setting_key', 'notification_recipients')
    .single()

  if (error) {
    console.error('❌ Error:', error.message)
    return
  }

  console.log('📊 Raw Data from Database:')
  console.log('Key:', data.setting_key)
  console.log('Type:', typeof data.setting_value)
  console.log('Raw Value:')
  console.log(JSON.stringify(data.setting_value, null, 2))

  // Try parsing
  let parsed = data.setting_value
  if (typeof parsed === 'string') {
    console.log('\n🔄 First parse (string to object)...')
    parsed = JSON.parse(parsed)
    console.log(JSON.stringify(parsed, null, 2))

    if (typeof parsed === 'string') {
      console.log('\n🔄 Second parse (double-encoded)...')
      parsed = JSON.parse(parsed)
      console.log(JSON.stringify(parsed, null, 2))
    }
  }

  // Display recipients
  console.log('\n👥 Recipients by Type:')
  if (parsed.additional_recipients) {
    for (const recipient of parsed.additional_recipients) {
      console.log(`\nEmail: ${recipient.email}`)
      console.log(`  - Expiry Alerts: ${recipient.expiryAlerts}`)
      console.log(`  - Backup Notifications: ${recipient.backupNotifications}`)
      console.log(`  - Daily Digest: ${recipient.dailyDigest}`)
    }
  }

  // Check email_queue_mode
  console.log('\n\n📧 Email Queue Mode Setting:')
  const { data: modeData, error: modeError } = await supabase
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', 'email_queue_mode')
    .single()

  if (modeError) {
    console.error('❌ Error:', modeError.message)
  } else {
    console.log('Value:', JSON.stringify(modeData.setting_value))
  }
}

debug()
