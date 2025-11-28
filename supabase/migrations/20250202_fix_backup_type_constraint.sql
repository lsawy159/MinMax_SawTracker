-- Migration: إصلاح constraint backup_type
-- Created: 2025-02-02
-- Description: إضافة قيمة 'manual' إلى constraint backup_type للسماح بالنسخ اليدوي

-- إسقاط constraint القديم
ALTER TABLE public.backup_history 
DROP CONSTRAINT IF EXISTS backup_history_backup_type_check;

-- إضافة constraint جديد يتضمن 'manual'
ALTER TABLE public.backup_history
ADD CONSTRAINT backup_history_backup_type_check 
CHECK (backup_type IN ('full', 'incremental', 'partial', 'manual'));

-- تعليق على التغيير
COMMENT ON CONSTRAINT backup_history_backup_type_check ON public.backup_history IS 
'يسمح بنوع النسخ الاحتياطي: full (كاملة), incremental (تزايدية), partial (جزئية), manual (يدوي)';

