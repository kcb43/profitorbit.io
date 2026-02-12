const { createClient } = require('@supabase/supabase-js');
const { scrapeProducts } = require('../product-search/scraper');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Background Deal Scraper Worker
 * Runs periodically to monitor prices and detect deals
 * Can be triggered via:
 * - Vercel Cron Job
 * - Manual API call: POST /api/pulse/scan-deals
 * - Scheduled task
 */

async function scanDealsForUser(userId) {
  console.log(`🔍 Scanning deals for user ${userId}...`);

  try {
    // Get user's active watchlist
    const { data: watchlist } = await supabase
      .from('price_watchlist')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    if (!watchlist || watchlist.length === 0) {
      console.log(`⚠️ No watchlist items for user ${userId}`);
      return;
    }

    console.log(`📋 Found ${watchlist.length} watchlist items`);

    // Scan each watchlist item
    for (const item of watchlist) {
      try {
        // Extract product name from URL or use stored name
        const productName = item.product_name;

        // Scrape current price
        const scrapedData = await scrapeProducts(productName, {
          maxResults: 5,
          sortBy: 'price_low'
        });

        if (!scrapedData.success || scrapedData.products.length === 0) {
          console.log(`⚠️ No results for ${productName}`);
          continue;
        }

        // Find best deal matching marketplace
        const matchingProducts = scrapedData.products.filter(p => 
          item.marketplace ? p.marketplace === item.marketplace : true
        );

        if (matchingProducts.length === 0) continue;

        const bestDeal = matchingProducts[0]; // Already sorted by price_low
        const currentPrice = bestDeal.price;

        // Record price history
        await supabase.from('price_history').insert({
          watchlist_item_id: item.id,
          price: currentPrice,
          source: scrapedData.source
        });

        // Check if price dropped below target
        const priceDropped = item.target_price && currentPrice <= item.target_price;
        const significantDrop = item.initial_price && 
          ((item.initial_price - currentPrice) / item.initial_price) >= 0.15; // 15% drop

        if ((priceDropped || significantDrop) && item.notify_on_drop) {
          // Create deal alert
          const discountPercentage = item.initial_price
            ? Math.round(((item.initial_price - currentPrice) / item.initial_price) * 100)
            : bestDeal.discountPercentage || 0;

          const alertReason = priceDropped
            ? `Price dropped to your target of $${item.target_price.toFixed(2)}!`
            : `Significant price drop detected: ${discountPercentage}% off!`;

          await supabase.from('deal_alerts').insert({
            user_id: userId,
            watchlist_item_id: item.id,
            product_name: item.product_name,
            product_url: bestDeal.productUrl || item.product_url,
            product_image_url: bestDeal.imageUrl || item.product_image_url,
            marketplace: bestDeal.marketplace || item.marketplace,
            current_price: currentPrice,
            original_price: item.initial_price,
            discount_percentage: discountPercentage,
            alert_reason: alertReason,
            is_read: false
          });

          console.log(`🔔 Alert created: ${item.product_name} - ${alertReason}`);
        }

        // Update watchlist with last check time
        await supabase
          .from('price_watchlist')
          .update({ last_checked_at: new Date().toISOString() })
          .eq('id', item.id);

      } catch (error) {
        console.error(`❌ Error scanning ${item.product_name}:`, error);
      }
    }

    console.log(`✅ Deal scan complete for user ${userId}`);

  } catch (error) {
    console.error(`❌ Error scanning deals for user ${userId}:`, error);
  }
}

/**
 * Main worker function - scans deals for all users
 */
async function scanAllDeals() {
  console.log('🚀 Starting deal scan for all users...');

  try {
    // Get all users with active watchlists
    const { data: users } = await supabase
      .from('price_watchlist')
      .select('user_id')
      .eq('is_active', true);

    if (!users || users.length === 0) {
      console.log('⚠️ No active watchlists found');
      return { success: true, message: 'No watchlists to scan' };
    }

    // Get unique user IDs
    const uniqueUserIds = [...new Set(users.map(u => u.user_id))];
    console.log(`👥 Scanning for ${uniqueUserIds.length} users`);

    // Scan deals for each user
    for (const userId of uniqueUserIds) {
      await scanDealsForUser(userId);
      // Rate limiting: wait 5 seconds between users
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('✅ Deal scan complete for all users');
    return {
      success: true,
      usersScanned: uniqueUserIds.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('❌ Error in deal scan:', error);
    return {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Vercel serverless function handler
export default async function handler(req, res) {
  // Verify cron secret for security
  const cronSecret = req.headers['x-vercel-cron-secret'];
  const validSecret = process.env.CRON_SECRET || 'dev-secret';

  if (cronSecret !== validSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const result = await scanAllDeals();
    return res.status(200).json(result);
  } catch (error) {
    console.error('Worker error:', error);
    return res.status(500).json({
      error: 'Worker failed',
      message: error.message
    });
  }
}

// Allow manual execution for testing
if (require.main === module) {
  console.log('🧪 Running deal scanner manually...');
  scanAllDeals()
    .then(result => {
      console.log('Result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error:', error);
      process.exit(1);
    });
}

module.exports = { scanAllDeals, scanDealsForUser };
