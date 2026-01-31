-- Facebook Scraping Jobs Table
-- Stores scraping job requests and results

CREATE TABLE IF NOT EXISTS facebook_scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Job metadata
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- Input data
  item_id TEXT NOT NULL, -- Facebook listing ID
  listing_url TEXT NOT NULL,
  
  -- Scraped results (populated when completed)
  scraped_data JSONB, -- Full scraped data: {description, category, condition, brand, size, etc}
  
  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Indexes
  CONSTRAINT facebook_scraping_jobs_user_item_key UNIQUE(user_id, item_id)
);

-- Index for efficient job polling by worker
CREATE INDEX IF NOT EXISTS idx_facebook_scraping_jobs_status_created 
  ON facebook_scraping_jobs(status, created_at);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_facebook_scraping_jobs_user_status 
  ON facebook_scraping_jobs(user_id, status);

-- Index for item_id lookups
CREATE INDEX IF NOT EXISTS idx_facebook_scraping_jobs_item_id 
  ON facebook_scraping_jobs(item_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_facebook_scraping_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_facebook_scraping_jobs_timestamp
  BEFORE UPDATE ON facebook_scraping_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_facebook_scraping_jobs_updated_at();

-- RLS Policies
ALTER TABLE facebook_scraping_jobs ENABLE ROW LEVEL SECURITY;

-- Users can only see their own jobs
CREATE POLICY "Users can view own scraping jobs"
  ON facebook_scraping_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own jobs
CREATE POLICY "Users can create own scraping jobs"
  ON facebook_scraping_jobs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Service role can do everything (for worker)
CREATE POLICY "Service role can do everything"
  ON facebook_scraping_jobs
  FOR ALL
  USING (true);
