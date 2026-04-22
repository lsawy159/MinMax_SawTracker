#!/usr/bin/env node
/**
 * 🧪 Test: Check how automated-backup parses notification_recipients
 */

const testData = `"{\\"primary_admin\\":\\"ahmad.alsawy159@gmail.com\\",\\"primary_admin_locked\\":true,\\"additional_recipients\\":[{\\"id\\":\\"21e2cd00-cee5-477b-b65b-8c379fa9893c\\",\\"email\\":\\"a.g16591@gmail.com\\",\\"expiryAlerts\\":true,\\"backupNotifications\\":true,\\"dailyDigest\\":true,\\"added_at\\":\\"2026-02-04T13:53:54.890Z\\",\\"added_by\\":\\"432e313b-1f24-4622-ba1d-23b2667a1afc\\"}],\\"version\\":\\"1.0\\",\\"last_modified\\":\\"2026-02-04T13:53:58.068Z\\"}"`;

console.log('🔍 Testing notification_recipients parsing (same logic as automated-backup)...\n');

console.log('📦 Raw data from database:');
console.log(testData);
console.log('\n---\n');

try {
  let parsed = testData;
  
  // First parse
  if (typeof parsed === 'string') {
    console.log('🔄 First JSON.parse()...');
    parsed = JSON.parse(parsed);
    console.log('Type after first parse:', typeof parsed);
    
    // Second parse if needed
    if (typeof parsed === 'string') {
      console.log('🔄 Second JSON.parse() (double-encoded)...');
      parsed = JSON.parse(parsed);
      console.log('Type after second parse:', typeof parsed);
    }
  }

  console.log('\n📋 Parsed object:');
  console.log(JSON.stringify(parsed, null, 2));
  
  console.log('\n---\n');

  // Extract recipients (same logic as automated-backup)
  const recipients = [];
  
  // Primary admin
  if (parsed.primary_admin && typeof parsed.primary_admin === 'string') {
    recipients.push(parsed.primary_admin);
    console.log('✅ Primary admin:', parsed.primary_admin);
  }
  
  // Additional recipients with backupNotifications flag
  if (Array.isArray(parsed.additional_recipients)) {
    console.log(`\n📧 Additional recipients: ${parsed.additional_recipients.length} found`);
    
    for (const recipient of parsed.additional_recipients) {
      console.log(`\n  Email: ${recipient.email}`);
      console.log(`  backupNotifications: ${recipient.backupNotifications}`);
      
      if (recipient.email && recipient.backupNotifications === true) {
        recipients.push(recipient.email);
        console.log(`  ✅ ADDED to recipients list`);
      } else {
        console.log(`  ❌ NOT ADDED (backupNotifications is ${recipient.backupNotifications})`);
      }
    }
  }

  console.log('\n---\n');
  console.log(`🎯 Final recipients list (${recipients.length} total):`);
  recipients.forEach((email, idx) => {
    console.log(`  ${idx + 1}. ${email}`);
  });

  if (recipients.includes('a.g16591@gmail.com')) {
    console.log('\n✅ SUCCESS: a.g16591@gmail.com is in the recipients list!');
  } else {
    console.log('\n❌ PROBLEM: a.g16591@gmail.com is NOT in the recipients list!');
  }

} catch (error) {
  console.error('\n❌ Parsing error:', error.message);
  console.error('Stack:', error.stack);
}
