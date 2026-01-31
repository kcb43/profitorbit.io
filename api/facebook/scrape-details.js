/**
 * Facebook Scraping Job API - Create Jobs
 * POST /api/facebook/scrape-details
 * 
 * Creates scraping jobs for Facebook listings
 * Returns job IDs immediately, worker processes in background
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { listings, userId } = req.body;

    if (!listings || !Array.isArray(listings) || listings.length === 0) {
      return res.status(400).json({ error: 'listings array is required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

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

    console.log(`📝 Creating ${listings.length} scraping jobs for user ${userId}`);

    // Create jobs for each listing
    const jobs = listings.map(listing => ({
      user_id: userId,
      item_id: listing.itemId,
      listing_url: listing.listingUrl,
      status: 'pending',
    }));

    // Use upsert to handle duplicates (update if exists)
    const { data, error } = await supabase
      .from('facebook_scraping_jobs')
      .upsert(jobs, {
        onConflict: 'user_id,item_id',
        ignoreDuplicates: false // Update existing jobs
      })
      .select('id, item_id, status');

    if (error) {
      console.error('❌ Error creating scraping jobs:', error);
      return res.status(500).json({ error: 'Failed to create scraping jobs', details: error.message });
    }

    console.log(`✅ Created ${data.length} scraping jobs`);

    // Return job IDs
    return res.status(200).json({
      success: true,
      jobs: data,
      message: `Created ${data.length} scraping jobs. Results will be available shortly.`
    });

  } catch (error) {
    console.error('❌ Server error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
