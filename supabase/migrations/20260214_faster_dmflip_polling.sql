-- Reduce DMFlip polling interval from 45 minutes to 5 minutes
-- This provides near real-time deal discovery

UPDATE deal_sources
SET poll_interval_minutes = 5
WHERE name = 'DMFlip';
