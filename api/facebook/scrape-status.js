/**
 * Facebook Scraping Job API - Get Job Status
 * GET /api/facebook/scrape-status?jobIds=id1,id2,id3
 * 
 * Returns status and results for scraping jobs
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobIds, userId } = req.query;

    if (!jobIds) {
      return res.status(400).json({ error: 'jobIds parameter is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId parameter is required' });
    }

    const jobIdArray = jobIds.split(',');

    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Fetch jobs
    const { data, error } = await supabase
      .from('facebook_scraping_jobs')
      .select('id, item_id, status, scraped_data, error_message, created_at, completed_at')
      .in('id', jobIdArray)
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error fetching jobs:', error);
      return res.status(500).json({ error: 'Failed to fetch jobs', details: error.message });
    }

    // Calculate summary
    const summary = {
      total: data.length,
      pending: data.filter(j => j.status === 'pending').length,
      processing: data.filter(j => j.status === 'processing').length,
      completed: data.filter(j => j.status === 'completed').length,
      failed: data.filter(j => j.status === 'failed').length,
    };

    return res.status(200).json({
      success: true,
      jobs: data,
      summary
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
