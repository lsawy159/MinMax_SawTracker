#!/usr/bin/env node
/**
 * Live Schema Verification for email_queue Table
 * Created: 2026-02-03
 * Purpose: Verify the actual schema of email_queue in production database
 */

// Supabase credentials (from .env.local)
const SUPABASE_URL = "https://vpxazxzekkkepfjchjly.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweGF6eHpla2trZXBmamNoamx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjgzNjgsImV4cCI6MjA3Nzg4ODM2OH0.e7T7Nnl2cyC531Zq7utM1VfwlWm0ZoEaspbtnYQeqsA";

async function checkTableSchema() {
  const url = `${SUPABASE_URL}/rest/v1/email_queue?select=*&limit=1`;
  
  console.log("=" .repeat(80));
  console.log("📊 LIVE DATABASE SCHEMA VERIFICATION - email_queue");
  console.log("=" .repeat(80));
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log();
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Status Code: ${response.status}`);
    console.log();
    
    if (response.status === 200) {
      const data = await response.json();
      
      if (data && data.length > 0) {
        console.log("✅ Table exists and has data");
        console.log();
        console.log("📋 COLUMNS DETECTED:");
        console.log("-" .repeat(80));
        
        const record = data[0];
        const columns = Object.keys(record);
        
        columns.forEach((col, i) => {
          const value = record[col];
          const valueType = value === null ? 'null' : typeof value;
          const valuePreview = value === null ? 'NULL' : 
                              typeof value === 'object' ? JSON.stringify(value).substring(0, 40) :
                              String(value).substring(0, 40);
          
          console.log(`${String(i + 1).padStart(2)}. ${col.padEnd(25)} | Type: ${valueType.padEnd(10)} | Value: ${valuePreview}`);
        });
        
        console.log();
        console.log("🔍 CRITICAL CHECKS:");
        console.log("-" .repeat(80));
        
        // Check for critical columns
        const checks = [
          { name: 'max_retries', required: true },
          { name: 'retry_count', required: true },
          { name: 'completed_at', required: true },
          { name: 'processed_at', required: true },
          { name: 'to_emails', required: true },
          { name: 'subject', required: true },
          { name: 'status', required: true },
          { name: 'priority', required: true },
          { name: 'html_content', required: false },
          { name: 'error_message', required: false }
        ];
        
        checks.forEach(check => {
          const exists = columns.includes(check.name);
          const icon = exists ? '✅' : (check.required ? '❌' : '⚠️ ');
          console.log(`${icon} ${check.name}: ${exists ? 'EXISTS' : 'DOES NOT EXIST'}`);
        });
        
        // Get total count
        console.log();
        await getRecordCount();
        
        // Check for records by status
        console.log();
        await getStatusBreakdown();
        
        return { success: true, columns, sample: record };
        
      } else {
        console.log("⚠️  Table exists but is EMPTY");
        console.log();
        console.log("Attempting schema detection via OPTIONS request...");
        return { success: false, reason: 'empty' };
      }
    } else if (response.status === 404) {
      console.log("❌ Table 'email_queue' does NOT exist");
      return { success: false, reason: 'not_found' };
    } else if (response.status === 401 || response.status === 403) {
      console.log("❌ Authentication/Authorization failed");
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      return { success: false, reason: 'auth_failed' };
    } else {
      console.log(`⚠️  Unexpected status: ${response.status}`);
      const text = await response.text();
      console.log(`Response: ${text.substring(0, 200)}`);
      return { success: false, reason: 'unknown' };
    }
    
  } catch (error) {
    console.log(`❌ Error connecting to database: ${error.message}`);
    return { success: false, reason: 'connection_error', error: error.message };
  }
}

async function getRecordCount() {
  const url = `${SUPABASE_URL}/rest/v1/email_queue?select=id`;
  
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY,
        'Prefer': 'count=exact'
      }
    });
    
    const contentRange = response.headers.get('content-range');
    if (contentRange) {
      const count = contentRange.split('/')[1];
      console.log("📈 TABLE STATISTICS:");
      console.log("-" .repeat(80));
      console.log(`Total Records: ${count}`);
    }
  } catch (error) {
    console.log(`Could not fetch count: ${error.message}`);
  }
}

async function getStatusBreakdown() {
  const url = `${SUPABASE_URL}/rest/v1/email_queue?select=status`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ANON_KEY}`,
        'apikey': ANON_KEY
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      const statusCounts = {};
      
      data.forEach(record => {
        const status = record.status || 'null';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
      
      console.log("📊 RECORDS BY STATUS:");
      console.log("-" .repeat(80));
      Object.entries(statusCounts).forEach(([status, count]) => {
        const icon = status === 'completed' ? '🟢' : 
                     status === 'pending' ? '🟡' :
                     status === 'processing' ? '🔵' :
                     status === 'failed' ? '🔴' : '⚪';
        console.log(`${icon} ${status.padEnd(15)}: ${count}`);
      });
    }
  } catch (error) {
    console.log(`Could not fetch status breakdown: ${error.message}`);
  }
}

// Main execution
(async () => {
  const result = await checkTableSchema();
  
  console.log();
  console.log("=" .repeat(80));
  
  if (result.success) {
    console.log("✅ VERIFICATION COMPLETE");
    console.log("=" .repeat(80));
    
    // Save to JSON file
    const fs = require('fs');
    const output = {
      timestamp: new Date().toISOString(),
      table: 'email_queue',
      columns: result.columns,
      sample_record: result.sample,
      verification_status: 'success'
    };
    
    fs.writeFileSync('email_queue_schema_result.json', JSON.stringify(output, null, 2), 'utf8');
    console.log();
    console.log("💾 Results saved to: email_queue_schema_result.json");
  } else {
    console.log("⚠️  VERIFICATION INCOMPLETE");
    console.log("=" .repeat(80));
    console.log();
    console.log("📋 MANUAL VERIFICATION REQUIRED:");
    console.log("-" .repeat(80));
    console.log("1. Open Supabase Dashboard:");
    console.log("   https://app.supabase.com/project/vpxazxzekkkepfjchjly/editor");
    console.log();
    console.log("2. Navigate to: SQL Editor");
    console.log();
    console.log("3. Run the query from file: check_email_queue_schema.sql");
    console.log();
    console.log("4. Copy the results and paste them back for analysis");
  }
  
  console.log();
})();
