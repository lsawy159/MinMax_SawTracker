-- حذف عمود تاريخ انتهاء الرقم الموحد من جدول companies
ALTER TABLE companies DROP COLUMN IF EXISTS ending_subscription_unified_date;