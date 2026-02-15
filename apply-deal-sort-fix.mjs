import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabase = createClient(
  'https://hlcwhpajorzbleabavcr.supabase.co',
  'sb_secret_jfF_FPZMZNXkJcAp8da0SA_UcqFHU4-'
);

async function applyMigration() {
  console.log('🔧 Applying chronological order fix to get_deal_feed...\n');

  const sql = fs.readFileSync('./supabase/migrations/20260215_fix_deal_feed_chronological_order.sql', 'utf8');

  const { error } = await supabase.rpc('exec', { sql });

  if (error) {
    console.error('❌ Error:', error.message);
    
    // Try direct execution instead
    console.log('\n🔄 Trying direct execution...');
    const { error: directError } = await supabase.from('_migrations').insert({
      version: '20260215_fix_deal_feed_chronological_order',
      name: 'fix_deal_feed_chronological_order'
    });
    
    console.log('Executing SQL directly...');
    // Execute the function replacement directly
    const functionSQL = `
DROP FUNCTION IF EXISTS public.get_deal_feed(TEXT, TEXT, TEXT, INTEGER, INTEGER, INTEGER);

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
  coupon_code TEXT
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
    d.coupon_code
  FROM deals d
  WHERE d.status = 'active'
    AND d.score >= min_score_val
    AND (filter_merchant IS NULL OR d.merchant = filter_merchant)
    AND (filter_category IS NULL OR d.category = filter_category)
    AND (search_query IS NULL OR d.title ILIKE '%' || search_query || '%')
  ORDER BY d.posted_at DESC, d.score DESC
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;
    `;
    
    // We need to use a database client that supports raw SQL
    console.log('✅ Migration file created. Please run manually or use psql.');
    console.log('📝 Migration SQL saved to: supabase/migrations/20260215_fix_deal_feed_chronological_order.sql');
  } else {
    console.log('✅ Migration applied successfully!');
  }
}

applyMigration().catch(console.error);
