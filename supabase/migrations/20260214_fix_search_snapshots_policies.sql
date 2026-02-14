-- Fix Multiple Permissive Policies on search_snapshots
-- Generated: 2026-02-14
-- Issue: Two policies allow SELECT for authenticated users:
--   1. "Users can view their snapshots" (FOR SELECT, user_id check)
--   2. "Service role can manage snapshots" (FOR ALL - includes SELECT)
-- Problem: Both policies execute for every SELECT query (performance hit)
-- Solution: Remove the service role policy (service_role bypasses RLS anyway!)

-- ============================================================================
-- Analysis: Service Role and RLS
-- ============================================================================
-- IMPORTANT: The service_role in Supabase BYPASSES RLS completely!
-- 
-- When using the service_role key:
--   - RLS policies are NOT evaluated at all
--   - service_role has full superuser-like access
--   - Creating RLS policies for service_role is redundant and misleading
--
-- The "Service role can manage snapshots" policy does NOTHING for service_role.
-- However, because it's defined as FOR ALL with TO PUBLIC (default), it DOES
-- affect authenticated users, causing policy overlap for SELECT operations.
-- ============================================================================

-- Drop the unnecessary service role policy
DROP POLICY IF EXISTS "Service role can manage snapshots" ON search_snapshots;

-- Keep only the user-facing policy
-- (already exists from previous migration, just document)
COMMENT ON POLICY "Users can view their snapshots" ON search_snapshots IS 
  'Users can only view their own cached search results. Service role bypasses RLS entirely and needs no policy.';

-- ============================================================================
-- Performance: Ensure user_id is indexed
-- ============================================================================
-- The policy uses: WHERE user_id = auth.uid()
-- Verify index exists (should be idx_search_snapshots_user)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'search_snapshots' 
    AND indexname = 'idx_search_snapshots_user'
  ) THEN
    CREATE INDEX idx_search_snapshots_user ON search_snapshots(user_id);
    RAISE NOTICE 'Created index on search_snapshots(user_id)';
  ELSE
    RAISE NOTICE 'Index on search_snapshots(user_id) already exists';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify search_snapshots policies (should have only 1 for users)
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
  AND tablename = 'search_snapshots'
ORDER BY policyname;

-- Expected result: Only "Users can view their snapshots" policy

-- Verify index exists for performance
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename = 'search_snapshots'
ORDER BY indexname;

-- Expected: idx_search_snapshots_user on user_id column
