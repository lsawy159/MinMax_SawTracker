-- Migration: Update Status Thresholds to Unified System
-- Date: 2025-12-10
-- Description: Updates status_thresholds with new unified terminology (urgent/high/medium)
--              Replaces old critical_days with urgent_days across all document types
-- Safety: Uses ON CONFLICT and conditional checks to prevent data loss

-- =====================================================
-- PART 1: Update Status Thresholds (Companies)
-- =====================================================

DO $$
BEGIN
  -- Check if system_settings table exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_settings'
  ) THEN
    
    RAISE NOTICE 'Updating status_thresholds with unified system...';
    
    -- Insert or update status_thresholds with new unified keys
    INSERT INTO system_settings (setting_key, setting_value, updated_at) 
    VALUES (
      'status_thresholds',
      jsonb_build_object(
        -- Commercial Registration (السجل التجاري)
        'commercial_reg_urgent_days', 7,      -- طارئ - أحمر
        'commercial_reg_high_days', 15,       -- عاجل - برتقالي
        'commercial_reg_medium_days', 30,     -- متوسط - أصفر
        
        -- Social Insurance (التأمينات الاجتماعية)
        'social_insurance_urgent_days', 7,    -- طارئ - أحمر
        'social_insurance_high_days', 15,     -- عاجل - برتقالي
        'social_insurance_medium_days', 30,   -- متوسط - أصفر
        
        -- Power Subscription (اشتراك قوى)
        'power_subscription_urgent_days', 7,  -- طارئ - أحمر
        'power_subscription_high_days', 15,   -- عاجل - برتقالي
        'power_subscription_medium_days', 30, -- متوسط - أصفر
        
        -- Moqeem Subscription (اشتراك مقيم)
        'moqeem_subscription_urgent_days', 7,  -- طارئ - أحمر
        'moqeem_subscription_high_days', 15,   -- عاجل - برتقالي
        'moqeem_subscription_medium_days', 30  -- متوسط - أصفر
      ),
      NOW()
    )
    ON CONFLICT (setting_key) 
    DO UPDATE SET 
      setting_value = EXCLUDED.setting_value,
      updated_at = EXCLUDED.updated_at;
    
    RAISE NOTICE '✓ Status thresholds updated successfully';
    
  ELSE
    RAISE WARNING 'system_settings table does not exist. Migration skipped.';
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating status_thresholds: %', SQLERRM;
END $$;

-- =====================================================
-- PART 2: Update Notification Thresholds (Employees)
-- =====================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'system_settings'
  ) THEN
    
    RAISE NOTICE 'Updating notification_thresholds with unified system...';
    
    -- Insert or update notification_thresholds for employees
    INSERT INTO system_settings (setting_key, setting_value, updated_at) 
    VALUES (
      'notification_thresholds',
      jsonb_build_object(
        -- Employee Residence (إقامة الموظف)
        'residence_urgent_days', 7,      -- طارئ - أحمر
        'residence_high_days', 15,       -- عاجل - برتقالي
        'residence_medium_days', 30,     -- متوسط - أصفر
        
        -- Employee Contract (عقد الموظف)
        'contract_urgent_days', 7,       -- طارئ - أحمر
        'contract_high_days', 15,        -- عاجل - برتقالي
        'contract_medium_days', 30,      -- متوسط - أصفر
        
        -- Health Insurance (التأمين الصحي)
        'health_insurance_urgent_days', 30,   -- طارئ - أحمر
        'health_insurance_high_days', 45,     -- عاجل - برتقالي
        'health_insurance_medium_days', 60,   -- متوسط - أصفر
        
        -- Hired Worker Contract (عقد أجير)
        'hired_worker_contract_urgent_days', 7,   -- طارئ - أحمر
        'hired_worker_contract_high_days', 15,    -- عاجل - برتقالي
        'hired_worker_contract_medium_days', 30   -- متوسط - أصفر
      ),
      NOW()
    )
    ON CONFLICT (setting_key) 
    DO UPDATE SET 
      setting_value = EXCLUDED.setting_value,
      updated_at = EXCLUDED.updated_at;
    
    RAISE NOTICE '✓ Notification thresholds updated successfully';
    
  END IF;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error updating notification_thresholds: %', SQLERRM;
END $$;

-- =====================================================
-- PART 3: Verification
-- =====================================================

DO $$
DECLARE
  status_thresholds_record RECORD;
  notification_thresholds_record RECORD;
BEGIN
  -- Verify status_thresholds
  SELECT * INTO status_thresholds_record 
  FROM system_settings 
  WHERE setting_key = 'status_thresholds';
  
  IF FOUND THEN
    RAISE NOTICE '✓ status_thresholds verified: %', status_thresholds_record.setting_value;
  ELSE
    RAISE WARNING '✗ status_thresholds not found after migration';
  END IF;
  
  -- Verify notification_thresholds
  SELECT * INTO notification_thresholds_record 
  FROM system_settings 
  WHERE setting_key = 'notification_thresholds';
  
  IF FOUND THEN
    RAISE NOTICE '✓ notification_thresholds verified: %', notification_thresholds_record.setting_value;
  ELSE
    RAISE WARNING '✗ notification_thresholds not found after migration';
  END IF;
  
END $$;

-- =====================================================
-- NOTES:
-- =====================================================
-- 1. This migration updates the unified status system
-- 2. Old terminology: critical_days → urgent_days
-- 3. Status hierarchy: منتهي → طارئ → عاجل → متوسط → ساري
-- 4. Safe to run multiple times (uses ON CONFLICT)
-- 5. Does NOT recalculate existing company/employee statuses
--    (Frontend will recalculate on-demand using new thresholds)
-- 6. No data loss - only updates settings
-- =====================================================
