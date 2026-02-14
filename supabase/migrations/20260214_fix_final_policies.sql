-- Fix Multiple Permissive Policies on deal_submissions and deals
-- Generated: 2026-02-14
-- Issues:
--   1. deal_submissions: Multiple policies for INSERT (anon role)
--   2. deals: Multiple policies for SELECT (anon role)

-- ============================================================================
-- FIX 1: deal_submissions Multiple Permissive Policies
-- ============================================================================
-- Issue: Two policies allow INSERT for authenticated users:
--   1. "Users can create submissions" (FOR INSERT, user_id check)
--   2. "Service role can manage submissions" (FOR ALL - includes INSERT)
-- Problem: Both policies evaluated for every INSERT (performance hit)
-- Solution: Remove service role policy (service_role bypasses RLS anyway!)

-- Analysis: What is deal_submissions?
-- Purpose: Users submit deals they find (community contributions)
-- Schema: user_id, title, url, price, merchant, notes, status
-- Access model:
--   - Authenticated users: Can INSERT their own submissions
--   - Users: Can SELECT only their own submissions
--   - Service role: Reviews/approves (bypasses RLS)
--   - Anon: Should NOT be able to submit deals (requires auth)

-- Drop the unnecessary service role policy
DROP POLICY IF EXISTS "Service role can manage submissions" ON deal_submissions;

-- Keep only the user-facing policies (SELECT and INSERT)
-- These already exist from previous migrations, just add comments
COMMENT ON POLICY "Users can view their submissions" ON deal_submissions IS 
  'Users can only view their own deal submissions. Service role bypasses RLS.';

COMMENT ON POLICY "Users can create submissions" ON deal_submissions IS 
  'Authenticated users can submit deals. user_id must match auth.uid() to prevent spoofing.';

-- ============================================================================
-- FIX 2: deals Multiple Permissive Policies
-- ============================================================================
-- Issue: Two policies allow SELECT for anon:
--   1. "Anyone can view active deals" (FOR SELECT WHERE status = 'active')
--   2. "Service role can manage deals" (FOR ALL - includes SELECT)
-- Problem: Both policies evaluated for every SELECT (performance hit)
-- Solution: Remove service role policy (service_role bypasses RLS anyway!)

-- Analysis: What is deals?
-- Purpose: The main deals feed (products/discounts users see)
-- Schema: title, url, price, merchant, score, status, etc.
-- Access model:
--   - Anon/Authenticated: Can SELECT active deals only
--   - Service role: Full CRUD access (bypasses RLS)
--   - Users: Read-only (no INSERT/UPDATE/DELETE)

-- Drop the unnecessary service role policy
DROP POLICY IF EXISTS "Service role can manage deals" ON deals;

-- Keep only the public read policy
COMMENT ON POLICY "Anyone can view active deals" ON deals IS 
  'Public read access to active deals only. Service role bypasses RLS for CRUD operations.';

-- ============================================================================
-- Performance: Verify Indexes
-- ============================================================================

-- For deal_submissions policy: WHERE user_id = auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'deal_submissions' 
    AND indexname = 'idx_submissions_user'
  ) THEN
    CREATE INDEX idx_submissions_user ON deal_submissions(user_id);
    RAISE NOTICE 'Created index on deal_submissions(user_id)';
  ELSE
    RAISE NOTICE 'Index on deal_submissions(user_id) already exists';
  END IF;
END $$;

-- For deals policy: WHERE status = 'active'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename = 'deals' 
    AND indexname = 'idx_deals_status'
  ) THEN
    CREATE INDEX idx_deals_status ON deals(status);
    RAISE NOTICE 'Created index on deals(status)';
  ELSE
    RAISE NOTICE 'Index on deals(status) already exists';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify deal_submissions policies (should have 2: SELECT and INSERT for users)
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
  AND tablename = 'deal_submissions'
ORDER BY cmd, policyname;

-- Expected results:
--   1. "Users can view their submissions" (SELECT)
--   2. "Users can create submissions" (INSERT)

-- Verify deals policies (should have 1: SELECT for public)
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
  AND tablename = 'deals'
ORDER BY policyname;

-- Expected result: Only "Anyone can view active deals" (SELECT)

-- Verify indexes
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
  AND tablename IN ('deal_submissions', 'deals')
  AND indexname IN ('idx_submissions_user', 'idx_deals_status')
ORDER BY tablename, indexname;

-- Expected: Both indexes exist
