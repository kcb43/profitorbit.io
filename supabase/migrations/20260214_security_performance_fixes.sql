-- Security and Performance Fixes for Supabase Linting Issues
-- Generated: 2026-02-14
-- Fixes:
-- 1. Multiple Permissive Policies on deal_ingestion_runs
-- 2. Function Search Path (already fixed, but verify)
-- 3. Leaked Password Protection (Auth configuration)

-- ============================================================================
-- FIX 1: Remove Multiple Permissive Policies on deal_ingestion_runs
-- ============================================================================
-- Issue: Two policies allow SELECT for anon role:
--   1. "Anyone can view ingestion runs" (FOR SELECT USING true)
--   2. "Service role can manage runs" (FOR ALL - includes SELECT)
-- Problem: Both policies execute for every SELECT query (performance hit)
-- Solution: Combine into single policy or remove redundant policy

-- Drop the overly permissive "Anyone" policy
DROP POLICY IF EXISTS "Anyone can view ingestion runs" ON deal_ingestion_runs;

-- Keep only the service role policy (ingestion runs are internal data)
-- If anon/authenticated users need access, add a more specific policy
-- But for now, only service role should access ingestion metadata

-- Alternative: If you DO want anon to view, combine with service role:
-- DROP POLICY IF EXISTS "Service role can manage runs" ON deal_ingestion_runs;
-- CREATE POLICY "View ingestion runs" ON deal_ingestion_runs
--   FOR SELECT
--   USING (true); -- Anyone can view
-- 
-- CREATE POLICY "Service role can manage runs" ON deal_ingestion_runs
--   FOR INSERT, UPDATE, DELETE
--   USING (auth.role() = 'service_role')
--   WITH CHECK (auth.role() = 'service_role');

-- For now, keeping only service role access (more secure)
COMMENT ON POLICY "Service role can manage runs" ON deal_ingestion_runs IS 
  'Service role has full access. Anon access removed to eliminate multiple permissive policies.';

-- ============================================================================
-- FIX 2: Function Search Path (Drop old vulnerable function)
-- ============================================================================
-- Issue: get_deal_feed has TWO versions due to different parameter signatures
--   1. OLD (vulnerable): get_deal_feed(search_query, filter_merchant, filter_category, min_score_val, page_limit, page_offset)
--   2. NEW (secure): get_deal_feed(p_limit, p_offset, p_min_score, p_merchant, p_category)
-- Problem: CREATE OR REPLACE didn't replace the old one because signatures differ
-- Solution: Explicitly drop the old vulnerable signature

-- Drop ALL versions of get_deal_feed (there are multiple due to overloading)
-- We need to drop each signature explicitly since the name is not unique

-- Version 1: Old vulnerable function with 6 TEXT/INTEGER params
DROP FUNCTION IF EXISTS public.get_deal_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);

-- Version 2: New function with different param names/order (if exists)
DROP FUNCTION IF EXISTS public.get_deal_feed(INT, INT, INT, TEXT, TEXT);

-- Recreate with the CORRECT signature that orben-api expects + add SET search_path
CREATE OR REPLACE FUNCTION get_deal_feed(
  search_query TEXT DEFAULT NULL,
  filter_merchant TEXT DEFAULT NULL,
  filter_category TEXT DEFAULT NULL,
  min_score_val INTEGER DEFAULT 0,
  page_limit INTEGER DEFAULT 50,
  page_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  url TEXT,
  image_url TEXT,
  price NUMERIC,
  original_price NUMERIC,
  merchant TEXT,
  category TEXT,
  score INT,
  posted_at TIMESTAMP WITH TIME ZONE,
  coupon_code TEXT,
  source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp  -- ✅ SECURE!
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.title,
    d.url,
    d.image_url,
    d.price,
    d.original_price,
    d.merchant,
    d.category,
    d.score,
    d.posted_at,
    d.coupon_code,
    d.source
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (filter_merchant IS NULL OR d.merchant = filter_merchant)
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
  ORDER BY d.score DESC, d.posted_at DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;

COMMENT ON FUNCTION get_deal_feed IS 'Secure deal feed with search_path protection. Used by orben-api /v1/deals/feed endpoint.';

-- ============================================================================
-- FIX 3: Enable Leaked Password Protection
-- ============================================================================
-- Issue: Auth is not checking passwords against HaveIBeenPwned database
-- Solution: This is configured in Supabase Dashboard, not SQL
-- Navigate to: Authentication > Settings > Password Protection

-- SQL cannot enable this - must be done via Supabase Dashboard or API
-- Documentation for enabling leaked password protection:
--   1. Go to Supabase Dashboard
--   2. Navigate to Authentication > Settings  
--   3. Find "Password Protection" section
--   4. Enable "Check for compromised passwords using HaveIBeenPwned.org"
--   5. This adds real-time breach checking during signup/password change

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify deal_ingestion_runs policies (should have only 1 for service_role)
SELECT 
  schemaname,
  tablename,
  policyname,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public' 
  AND tablename = 'deal_ingestion_runs'
ORDER BY policyname;

-- Expected result: Only "Service role can manage runs" policy

-- Verify all SECURITY DEFINER functions have search_path set
SELECT 
  n.nspname || '.' || p.proname as function_name,
  CASE 
    WHEN p.proconfig IS NOT NULL THEN 'SECURE ✓'
    ELSE 'VULNERABLE ✗'
  END as search_path_status,
  p.proconfig as config
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- Expected: All functions show 'SECURE ✓'
