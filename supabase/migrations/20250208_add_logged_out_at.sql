-- Migration: إضافة عمود logged_out_at إلى جدول user_sessions
-- Created: 2025-02-08
-- Description: إضافة عمود لتسجيل وقت تسجيل الخروج للمستخدمين

-- =========================================
-- إضافة عمود logged_out_at
-- =========================================
ALTER TABLE public.user_sessions
ADD COLUMN IF NOT EXISTS logged_out_at TIMESTAMP WITH TIME ZONE;

-- إضافة index لتحسين الأداء عند البحث عن الجلسات المنتهية
CREATE INDEX IF NOT EXISTS idx_user_sessions_logged_out_at ON public.user_sessions(logged_out_at);

-- تعليق على العمود
COMMENT ON COLUMN public.user_sessions.logged_out_at IS 'وقت تسجيل الخروج من الجلسة (NULL يعني أن الجلسة لا تزال نشطة)';

