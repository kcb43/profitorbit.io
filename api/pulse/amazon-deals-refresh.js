/**
 * Amazon Deals Refresh Cron Job
 * 
 * Runs every 30 minutes to refresh deal cache
 * Stores deals in database to reduce API calls
 */

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Verify this is actually a cron request from Vercel
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  console.log('🔄 Starting Amazon deals refresh...');

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Fetch fresh deals from amazon-deals-live API
    const categories = ['all', 'electronics', 'home', 'toys', 'sports'];
    const allDeals = [];

    for (const category of categories) {
      try {
        // Import the deal fetching logic
        const { fetchLiveDeals } = await import('./amazon-deals-live-helper.js');
        const deals = await fetchLiveDeals({ category, minDiscount: 30, limit: 20 });
        allDeals.push(...deals);
        console.log(`✅ Fetched ${deals.length} deals from ${category}`);
      } catch (error) {
        console.error(`❌ Error fetching ${category} deals:`, error.message);
      }
    }

    console.log(`📊 Total deals fetched: ${allDeals.length}`);

    // Store deals in database (upsert by ASIN)
    if (allDeals.length > 0) {
      const { error } = await supabase
        .from('deal_cache')
        .upsert(
          allDeals.map(deal => ({
            asin: deal.asin,
            product_name: deal.title,
            product_url: deal.productUrl,
            product_image_url: deal.imageUrl,
            current_price: deal.currentPrice,
            original_price: deal.originalPrice,
            discount_percentage: deal.discount,
            deal_type: deal.dealType,
            category: deal.category,
            source: deal.source,
            quality_score: deal.qualityScore,
            sales_rank: deal.salesRank || null,
            num_reviews: deal.numReviews || null,
            avg_rating: deal.avgRating || null,
            ends_at: deal.endsAt || null,
            updated_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min cache
          })),
          { onConflict: 'asin' }
        );

      if (error) {
        console.error('❌ Error storing deals:', error);
        throw error;
      }

      console.log('✅ Deals stored in database');
    }

    // Clean up expired deals
    const { error: cleanupError } = await supabase
      .from('deal_cache')
      .delete()
      .lt('expires_at', new Date().toISOString());

    if (cleanupError) {
      console.error('❌ Error cleaning up expired deals:', cleanupError);
    } else {
      console.log('✅ Expired deals cleaned up');
    }

    return res.status(200).json({
      success: true,
      dealsRefreshed: allDeals.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Deals refresh failed:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
