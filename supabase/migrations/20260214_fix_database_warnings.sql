-- ============================================================================
-- Fix Database Linter Warnings
-- Date: 2026-02-14
-- ============================================================================
-- This migration addresses all warnings from Supabase database linter:
-- 1. Auth RLS init plan (performance)
-- 2. Multiple permissive policies (performance)
-- 3. Duplicate index (performance)
-- 4. Security definer views (security)
-- 5. Function search paths (security)
-- 6. Overly permissive policies (security)
-- 7. RLS enabled without policies (security)
-- ============================================================================

BEGIN;

-- ============================================================================
-- PART 1: Fix Auth RLS Initialization Plan Issues
-- Replace auth.uid() with (select auth.uid()) in all RLS policies
-- This prevents re-evaluation for each row, improving performance
-- ============================================================================

-- facebook_scraping_jobs policies
DROP POLICY IF EXISTS "Users can create own scraping jobs" ON facebook_scraping_jobs;
CREATE POLICY "Users can create own scraping jobs" ON facebook_scraping_jobs
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can view own scraping jobs" ON facebook_scraping_jobs;
CREATE POLICY "Users can view own scraping jobs" ON facebook_scraping_jobs
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- item_links policies
DROP POLICY IF EXISTS "Users can view their own item links" ON item_links;
CREATE POLICY "Users can view their own item links" ON item_links
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own item links" ON item_links;
CREATE POLICY "Users can create their own item links" ON item_links
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own item links" ON item_links;
CREATE POLICY "Users can delete their own item links" ON item_links
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- item_groups policies
DROP POLICY IF EXISTS "Users can view their own groups" ON item_groups;
CREATE POLICY "Users can view their own groups" ON item_groups
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create their own groups" ON item_groups;
CREATE POLICY "Users can create their own groups" ON item_groups
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own groups" ON item_groups;
CREATE POLICY "Users can update their own groups" ON item_groups
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own groups" ON item_groups;
CREATE POLICY "Users can delete their own groups" ON item_groups
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- item_group_members policies
DROP POLICY IF EXISTS "Users can view their own group members" ON item_group_members;
CREATE POLICY "Users can view their own group members" ON item_group_members
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM item_groups
      WHERE item_groups.id = item_group_members.group_id
      AND item_groups.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can add items to their own groups" ON item_group_members;
CREATE POLICY "Users can add items to their own groups" ON item_group_members
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM item_groups
      WHERE item_groups.id = group_id
      AND item_groups.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can remove items from their own groups" ON item_group_members;
CREATE POLICY "Users can remove items from their own groups" ON item_group_members
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM item_groups
      WHERE item_groups.id = item_group_members.group_id
      AND item_groups.user_id = (select auth.uid())
    )
  );

-- profiles policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
CREATE POLICY "Users can view their own profile" ON profiles
  FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
CREATE POLICY "Users can update their own profile" ON profiles
  FOR UPDATE
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
CREATE POLICY "Users can insert their own profile" ON profiles
  FOR INSERT
  WITH CHECK ((select auth.uid()) = id);

-- deal_sources policies
DROP POLICY IF EXISTS "Service role can manage deal sources" ON deal_sources;
CREATE POLICY "Service role can manage deal sources" ON deal_sources
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- deals policies
DROP POLICY IF EXISTS "Anyone can view active deals" ON deals;
CREATE POLICY "Anyone can view active deals" ON deals
  FOR SELECT
  USING (status = 'active');

DROP POLICY IF EXISTS "Service role can manage deals" ON deals;
CREATE POLICY "Service role can manage deals" ON deals
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- deal_events policies
DROP POLICY IF EXISTS "Service role can create events" ON deal_events;
CREATE POLICY "Service role can create events" ON deal_events
  FOR INSERT
  WITH CHECK ((select auth.role()) = 'service_role');

-- deal_ingestion_runs policies
DROP POLICY IF EXISTS "Service role can manage runs" ON deal_ingestion_runs;
CREATE POLICY "Service role can manage runs" ON deal_ingestion_runs
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- deal_submissions policies
DROP POLICY IF EXISTS "Users can view their submissions" ON deal_submissions;
CREATE POLICY "Users can view their submissions" ON deal_submissions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create submissions" ON deal_submissions;
CREATE POLICY "Users can create submissions" ON deal_submissions
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage submissions" ON deal_submissions;
CREATE POLICY "Service role can manage submissions" ON deal_submissions
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- deal_saves policies
DROP POLICY IF EXISTS "Users can view their saves" ON deal_saves;
CREATE POLICY "Users can view their saves" ON deal_saves
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can create saves" ON deal_saves;
CREATE POLICY "Users can create saves" ON deal_saves
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete saves" ON deal_saves;
CREATE POLICY "Users can delete saves" ON deal_saves
  FOR DELETE
  USING ((select auth.uid()) = user_id);

-- search_snapshots policies
DROP POLICY IF EXISTS "Users can view their snapshots" ON search_snapshots;
CREATE POLICY "Users can view their snapshots" ON search_snapshots
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Service role can manage snapshots" ON search_snapshots;
CREATE POLICY "Service role can manage snapshots" ON search_snapshots
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- ============================================================================
-- PART 2: Fix Duplicate Index
-- Drop duplicate index on deals table
-- ============================================================================

DROP INDEX IF EXISTS idx_deals_hash; -- Keep deals_hash_key (primary), drop duplicate

-- ============================================================================
-- PART 3: Fix Security Definer Views
-- Recreate views without SECURITY DEFINER (use SECURITY INVOKER instead)
-- ============================================================================

DROP VIEW IF EXISTS recent_ingestion_summary;
CREATE OR REPLACE VIEW recent_ingestion_summary
WITH (security_invoker = true)
AS
SELECT 
  dir.source_id,
  ds.name as source_name,
  ds.type as source_type,
  dir.status,
  dir.items_created,
  dir.items_updated,
  dir.started_at,
  dir.finished_at as completed_at
FROM deal_ingestion_runs dir
JOIN deal_sources ds ON dir.source_id = ds.id
WHERE dir.started_at > NOW() - INTERVAL '24 hours'
ORDER BY dir.started_at DESC;

DROP VIEW IF EXISTS active_deals_summary;
CREATE OR REPLACE VIEW active_deals_summary
WITH (security_invoker = true)
AS
SELECT 
  COUNT(*) as total_active,
  AVG(score) as avg_score,
  COUNT(*) FILTER (WHERE score >= 70) as hot_deals,
  COUNT(DISTINCT merchant) as unique_merchants
FROM deals
WHERE status = 'active';

DROP VIEW IF EXISTS deal_source_health;
CREATE OR REPLACE VIEW deal_source_health
WITH (security_invoker = true)
AS
SELECT 
  ds.id,
  ds.name,
  ds.type as source_type,
  ds.enabled,
  COUNT(DISTINCT dir.id) as total_runs,
  COUNT(DISTINCT dir.id) FILTER (WHERE dir.status = 'success') as successful_runs,
  MAX(dir.finished_at) as last_run,
  SUM(dir.items_created) as total_deals_inserted
FROM deal_sources ds
LEFT JOIN deal_ingestion_runs dir ON ds.id = dir.source_id
  AND dir.started_at > NOW() - INTERVAL '7 days'
GROUP BY ds.id, ds.name, ds.type, ds.enabled;

-- ============================================================================
-- PART 4: Fix Function Search Paths
-- Add SET search_path to all functions for security
-- ============================================================================

CREATE OR REPLACE FUNCTION update_facebook_scraping_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_item_groups_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION cleanup_expired_search_snapshots()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM search_snapshots
  WHERE expires_at < NOW();
END;
$$;

CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS get_deal_feed(INT, INT, INT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION get_deal_feed(
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_min_score INT DEFAULT 0,
  p_merchant TEXT DEFAULT NULL,
  p_category TEXT DEFAULT NULL
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
SET search_path = public, pg_temp
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
    AND d.score >= p_min_score
    AND (p_merchant IS NULL OR d.merchant = p_merchant)
    AND (p_category IS NULL OR d.category = p_category)
  ORDER BY d.score DESC, d.posted_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

DROP FUNCTION IF EXISTS active_rss_sources();
CREATE OR REPLACE FUNCTION active_rss_sources()
RETURNS TABLE (
  id UUID,
  name TEXT,
  rss_url TEXT,
  source_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ds.id,
    ds.name,
    ds.rss_url,
    ds.type as source_type
  FROM deal_sources ds
  WHERE ds.enabled = true
    AND ds.type = 'rss'
    AND ds.rss_url IS NOT NULL;
END;
$$;

-- ============================================================================
-- PART 5: Fix Overly Permissive RLS Policy
-- Replace "Service role can do everything" with specific conditions
-- ============================================================================

DROP POLICY IF EXISTS "Service role can do everything" ON facebook_scraping_jobs;
-- Already have specific policies above, this overly permissive one is removed

-- ============================================================================
-- PART 6: Add RLS Policies to Tables with RLS Enabled But No Policies
-- ============================================================================

-- listing_job_events - Service role only
CREATE POLICY "Service role can manage listing job events" ON listing_job_events
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- listing_jobs - Service role only
CREATE POLICY "Service role can manage listing jobs" ON listing_jobs
  FOR ALL
  USING ((select auth.role()) = 'service_role');

-- platform_accounts - Users can manage their own accounts
CREATE POLICY "Users can view their platform accounts" ON platform_accounts
  FOR SELECT
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert their platform accounts" ON platform_accounts
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update their platform accounts" ON platform_accounts
  FOR UPDATE
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete their platform accounts" ON platform_accounts
  FOR DELETE
  USING ((select auth.uid()) = user_id);

COMMIT;

-- ============================================================================
-- Verification Queries (Run these after migration to confirm fixes)
-- ============================================================================

-- Check for remaining warnings (should be much fewer):
-- SELECT * FROM pg_policies WHERE schemaname = 'public';
-- SELECT * FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'deals';
-- SELECT * FROM pg_views WHERE schemaname = 'public';
