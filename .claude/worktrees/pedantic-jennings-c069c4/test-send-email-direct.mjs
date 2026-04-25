#!/usr/bin/env node
/**
 * 🧪 Test send-email directly with multiple recipients
 */

const sendEmailUrl = 'https://vpxazxzekkkepfjchjly.supabase.co/functions/v1/send-email';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
  console.error('❌ Missing SUPABASE_SERVICE_ROLE_KEY');
  console.log('Run with: SUPABASE_SERVICE_ROLE_KEY=xxx node test-send-email-direct.mjs');
  process.exit(1);
}

async function testSendEmail() {
  console.log('🧪 Testing send-email Edge Function with multiple recipients...\n');

  const recipients = [
    'ahmad.alsawy159@gmail.com',
    'a.g16591@gmail.com'
  ];

  console.log('📧 Recipients:');
  recipients.forEach((email, idx) => console.log(`  ${idx + 1}. ${email}`));
  console.log('');

  try {
    const response = await fetch(sendEmailUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${serviceRoleKey}`,
        'apikey': serviceRoleKey
      },
      body: JSON.stringify({
        to: recipients,
        subject: '🧪 Test - Multiple Recipients',
        html: '<h1>Test Email</h1><p>This is a test to verify multiple recipients work correctly.</p><p>Time: ' + new Date().toISOString() + '</p>'
      })
    });

    const data = await response.json();

    console.log('📊 Response:');
    console.log('  Status:', response.status);
    console.log('  Data:', JSON.stringify(data, null, 2));

    if (response.ok && data.success) {
      console.log('\n✅ SUCCESS! Check Resend dashboard in a moment.');
    } else {
      console.log('\n❌ FAILED!');
      if (data.failedRecipients) {
        console.log('Failed recipients:', data.failedRecipients);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testSendEmail();
