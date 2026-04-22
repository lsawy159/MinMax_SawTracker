#!/usr/bin/env python3
"""
Live Schema Verification for email_queue Table
Created: 2026-02-03
Purpose: Verify the actual schema of email_queue in production database
"""

import requests
import json
import os
from datetime import datetime

# Current Supabase credentials (from .env.local)
SUPABASE_URL = "https://vpxazxzekkkepfjchjly.supabase.co"
ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZweGF6eHpla2trZXBmamNoamx5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MjgzNjgsImV4cCI6MjA3Nzg4ODM2OH0.e7T7Nnl2cyC531Zq7utM1VfwlWm0ZoEaspbtnYQeqsA"

def execute_query(sql_query):
    """
    Execute SQL query using Supabase REST API
    Note: This uses PostgREST's limited SQL execution capability
    """
    url = f"{SUPABASE_URL}/rest/v1/rpc/query"
    
    headers = {
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
        "Content-Type": "application/json",
        "Prefer": "return=representation"
    }
    
    try:
        # Try direct query via REST
        response = requests.post(url, headers=headers, json={"query": sql_query}, timeout=10)
        return response.status_code, response.text
    except Exception as e:
        return None, str(e)

def check_table_via_metadata():
    """
    Alternative: Check table by fetching a sample record
    This will reveal column names
    """
    url = f"{SUPABASE_URL}/rest/v1/email_queue"
    
    headers = {
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
        "Prefer": "return=representation"
    }
    
    try:
        # Fetch 1 record with full column set
        params = {"select": "*", "limit": "1"}
        response = requests.get(url, headers=headers, params=params, timeout=10)
        
        print("=" * 80)
        print("📊 LIVE DATABASE SCHEMA VERIFICATION - email_queue")
        print("=" * 80)
        print(f"Status Code: {response.status_code}")
        print(f"Timestamp: {datetime.now().isoformat()}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            if data and len(data) > 0:
                print("✅ Table exists and has data")
                print()
                print("📋 COLUMNS DETECTED:")
                print("-" * 80)
                
                record = data[0]
                for i, (key, value) in enumerate(record.items(), 1):
                    value_type = type(value).__name__
                    value_preview = str(value)[:50] if value is not None else "NULL"
                    print(f"{i:2d}. {key:25s} | Type: {value_type:10s} | Value: {value_preview}")
                
                print()
                print("🔍 CRITICAL CHECKS:")
                print("-" * 80)
                
                # Check for max_retries
                if 'max_retries' in record:
                    print("✅ max_retries: EXISTS")
                else:
                    print("❌ max_retries: DOES NOT EXIST")
                
                # Check for retry_count
                if 'retry_count' in record:
                    print("✅ retry_count: EXISTS")
                else:
                    print("❌ retry_count: DOES NOT EXIST")
                
                # Check for completed_at
                if 'completed_at' in record:
                    print("✅ completed_at: EXISTS")
                else:
                    print("❌ completed_at: DOES NOT EXIST")
                
                # Check for processed_at
                if 'processed_at' in record:
                    print("✅ processed_at: EXISTS")
                else:
                    print("❌ processed_at: DOES NOT EXIST")
                
                return record
            else:
                print("⚠️  Table exists but is EMPTY")
                print()
                print("Attempting to check schema via empty response...")
                # Even empty response should show column structure in headers
                return {}
        elif response.status_code == 404:
            print("❌ Table 'email_queue' does NOT exist")
        elif response.status_code == 401:
            print("❌ Authentication failed - check ANON_KEY")
        else:
            print(f"⚠️  Unexpected status: {response.status_code}")
            print(f"Response: {response.text[:200]}")
        
        return None
        
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return None

def check_stats():
    """Get count statistics"""
    url = f"{SUPABASE_URL}/rest/v1/email_queue"
    
    headers = {
        "Authorization": f"Bearer {ANON_KEY}",
        "apikey": ANON_KEY,
        "Prefer": "count=exact"
    }
    
    try:
        response = requests.head(url, headers=headers, timeout=10)
        
        if response.status_code == 200:
            count = response.headers.get('Content-Range', '').split('/')[-1]
            print()
            print("📈 TABLE STATISTICS:")
            print("-" * 80)
            print(f"Total Records: {count}")
            return int(count) if count.isdigit() else 0
        
        return None
    except Exception as e:
        print(f"Could not fetch stats: {e}")
        return None

if __name__ == "__main__":
    print()
    result = check_table_via_metadata()
    
    if result:
        count = check_stats()
        
        print()
        print("=" * 80)
        print("✅ VERIFICATION COMPLETE")
        print("=" * 80)
        
        # Save results to file
        output = {
            "timestamp": datetime.now().isoformat(),
            "table": "email_queue",
            "columns": list(result.keys()) if result else [],
            "sample_record": result,
            "total_records": count
        }
        
        with open('email_queue_schema_result.json', 'w', encoding='utf-8') as f:
            json.dump(output, f, indent=2, ensure_ascii=False, default=str)
        
        print()
        print("💾 Results saved to: email_queue_schema_result.json")
    else:
        print()
        print("=" * 80)
        print("⚠️  VERIFICATION FAILED - See errors above")
        print("=" * 80)
        print()
        print("📋 MANUAL VERIFICATION STEPS:")
        print("-" * 80)
        print("1. Open Supabase Dashboard: https://app.supabase.com/project/vpxazxzekkkepfjchjly/editor")
        print("2. Navigate to: SQL Editor")
        print("3. Run the query from: check_email_queue_schema.sql")
        print("4. Paste results back for analysis")
