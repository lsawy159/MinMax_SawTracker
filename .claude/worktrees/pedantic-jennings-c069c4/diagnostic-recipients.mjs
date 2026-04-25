#!/usr/bin/env node
/**
 * 🔍 Diagnostic: Check what recipients are actually stored in database
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing env vars')
  process.exit(1)
}

async function diagnostic() {
  console.log('🔍 DIAGNOSTIC: Checking stored notification recipients...\n');

  try {
    // Fetch the notification_recipients setting
    const response = await fetch(
      `${supabaseUrl}/rest/v1/system_settings?select=setting_key,setting_value&setting_key=eq.notification_recipients`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`
        }
      }
    );

    if (!response.ok) {
      console.error('❌ Failed to fetch from Supabase:', response.status, response.statusText);
      const text = await response.text();
      console.error('Response:', text);
      return;
    }

    const data = await response.json();
    
    if (!data || data.length === 0) {
      console.log('❌ No notification_recipients found in database!');
      return;
    }

    const rawValue = data[0].setting_value;
    console.log('📦 Raw value from database:');
    console.log('Type:', typeof rawValue);
    console.log('Value:', rawValue);
    console.log('');

    // Parse
    let parsed = rawValue;
    if (typeof parsed === 'string') {
      console.log('🔄 Parsing string value...');
      parsed = JSON.parse(parsed);
      
      if (typeof parsed === 'string') {
        console.log('🔄 Double-encoded, parsing again...');
        parsed = JSON.parse(parsed);
      }
    }

    console.log('\n✅ Parsed config:');
    console.log(JSON.stringify(parsed, null, 2));

    console.log('\n📋 Recipients list:');
    console.log('Primary:', parsed.primary_admin);
    
    if (Array.isArray(parsed.additional_recipients)) {
      parsed.additional_recipients.forEach((r, idx) => {
        console.log(`\nAdditional #${idx + 1}:`);
        console.log(`  Email: "${r.email}"`);
        console.log(`  Email length: ${r.email?.length || 0} chars`);
        console.log(`  Email bytes:`, Buffer.from(r.email || '').toString('hex'));
        console.log(`  backupNotifications: ${r.backupNotifications}`);
        console.log(`  Has invisible chars: ${/[\u200B-\u200D\uFEFF]/.test(r.email || '') ? 'YES ⚠️' : 'NO'}`);
      });
    }

    // Test: Would these emails pass Resend validation?
    console.log('\n🧪 Email validation:');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    if (parsed.additional_recipients) {
      parsed.additional_recipients.forEach((r) => {
        const isValid = emailRegex.test(r.email || '');
        console.log(`${isValid ? '✅' : '❌'} "${r.email}"`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

diagnostic();
