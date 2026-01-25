-- Create ebay_tokens table to store OAuth tokens for eBay API access

CREATE TABLE IF NOT EXISTS ebay_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  expires_at TIMESTAMPTZ,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE ebay_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own eBay tokens"
  ON ebay_tokens FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own eBay tokens"
  ON ebay_tokens FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own eBay tokens"
  ON ebay_tokens FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own eBay tokens"
  ON ebay_tokens FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ebay_tokens_user_id ON ebay_tokens(user_id);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ebay_tokens_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ebay_tokens_updated_at
  BEFORE UPDATE ON ebay_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_ebay_tokens_updated_at();
