-- Remove company limits logic from database schema
-- This migration drops the deprecated companies.max_employees column.

ALTER TABLE public.companies
DROP COLUMN IF EXISTS max_employees;