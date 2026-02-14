-- Fix Multiple Permissive Policies on deal_sources
-- Generated: 2026-02-14
-- Issue: Two policies allow SELECT for anon role:
--   1. "Anyone can view deal sources" (FOR SELECT USING true)
--   2. "Service role can manage deal sources" (FOR ALL - includes SELECT)
-- Problem: Both policies execute for every SELECT query (performance hit)
-- Solution: Remove the redundant "Anyone" policy

-- ============================================================================
-- Analysis: Should anon users view deal sources?
-- ============================================================================
-- Deal sources contain:
--   - Source names (e.g., "Slickdeals RSS")
--   - URLs for RSS feeds
--   - Enabled/disabled status
--   - Last polling timestamps
-- 
-- Decision: This is INTERNAL metadata that users don't need to see.
-- Only the service role (backend workers) should access this data.
-- ============================================================================

-- Drop the overly permissive "Anyone" policy
DROP POLICY IF EXISTS "Anyone can view deal sources" ON deal_sources;

-- Keep only the service role policy (already exists from previous migration)
-- No need to recreate, just document
COMMENT ON POLICY "Service role can manage deal sources" ON deal_sources IS 
  'Service role has full access to deal sources. Anon access removed to eliminate multiple permissive policies and improve performance.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify deal_sources policies (should have only 1 for service_role)
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
  AND tablename = 'deal_sources'
ORDER BY policyname;

-- Expected result: Only "Service role can manage deal sources" policy
