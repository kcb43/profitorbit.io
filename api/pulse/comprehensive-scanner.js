/**
 * Comprehensive Deal Scanner
 * Combines logic from all 3 GitHub repos:
 * - Amazon-Deal-Scraper: 6-hour scan intervals, coupon detection
 * - Amazon-Deal-Monitor: Category-based scanning, filter matching
 * - Amazon-WD-Alerts: Warehouse deal tracking, condition monitoring
 * 
 * This is the main background worker that runs on Vercel Cron
 */

import { createClient } from '@supabase/supabase-js';
import { checkWarehouseDeal, storeWarehouseDeal } from './warehouse-detector.js';
import { scanLightningDeals, storeLightningDeal, matchLightningDealsToWatchlists, createLightningDealAlerts } from './lightning-scanner.js';
import { checkForCoupon, storeCouponDeal, matchCouponsToWatchlists, createCouponAlerts } from './coupon-detector.js';
import { matchDealToFilters, getUserFilters } from './deal-filters.js';

/**
 * Main comprehensive scan function
 * Runs all deal detection types and creates alerts
 */
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const scanType = req.query.type || 'all'; // 'warehouse', 'lightning', 'coupon', 'all'
  const startTime = Date.now();

  console.log(`🚀 Starting comprehensive deal scan (type: ${scanType})`);

  try {
    // Initialize Supabase
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Create scan log entry
    const { data: scanLog } = await supabase
      .from('deal_scan_log')
      .insert({
        scan_type: scanType,
        status: 'running',
        started_at: new Date().toISOString()
      })
      .select()
      .single();

    const scanLogId = scanLog?.id;

    let stats = {
      productsScanned: 0,
      warehouseDealsFound: 0,
      lightningDealsFound: 0,
      couponsFound: 0,
      alertsCreated: 0,
      errors: []
    };

    // Get all active watchlists to scan
    const { data: watchlists, error: watchlistError } = await supabase
      .from('price_watchlist')
      .select('*')
      .eq('notify_on_drop', true);

    if (watchlistError) throw watchlistError;

    console.log(`📋 Found ${watchlists.length} watchlists to scan`);

    // 1. WAREHOUSE DEAL SCAN
    if (scanType === 'all' || scanType === 'warehouse') {
      console.log('\n📦 SCANNING FOR WAREHOUSE DEALS...');
      
      const warehouseResults = await scanWarehouseDeals(supabase, watchlists);
      stats.warehouseDealsFound = warehouseResults.found;
      stats.alertsCreated += warehouseResults.alertsCreated;
      stats.productsScanned += warehouseResults.scanned;
      
      console.log(`✅ Warehouse scan complete: ${warehouseResults.found} deals found`);
    }

    // 2. LIGHTNING DEAL SCAN  
    if (scanType === 'all' || scanType === 'lightning') {
      console.log('\n⚡ SCANNING FOR LIGHTNING DEALS...');
      
      const lightningResults = await scanLightningDealsAll(supabase, watchlists);
      stats.lightningDealsFound = lightningResults.found;
      stats.alertsCreated += lightningResults.alertsCreated;
      stats.productsScanned += lightningResults.scanned;
      
      console.log(`✅ Lightning scan complete: ${lightningResults.found} deals found`);
    }

    // 3. COUPON SCAN
    if (scanType === 'all' || scanType === 'coupon') {
      console.log('\n🎫 SCANNING FOR COUPONS...');
      
      const couponResults = await scanCoupons(supabase, watchlists);
      stats.couponsFound = couponResults.found;
      stats.alertsCreated += couponResults.alertsCreated;
      stats.productsScanned += couponResults.scanned;
      
      console.log(`✅ Coupon scan complete: ${couponResults.found} coupons found`);
    }

    // 4. REGULAR PRICE DROP SCAN (existing logic)
    if (scanType === 'all' || scanType === 'regular') {
      console.log('\n💰 SCANNING FOR PRICE DROPS...');
      
      const priceDropResults = await scanPriceDrops(supabase, watchlists);
      stats.alertsCreated += priceDropResults.alertsCreated;
      stats.productsScanned += priceDropResults.scanned;
      
      console.log(`✅ Price drop scan complete: ${priceDropResults.alertsCreated} alerts created`);
    }

    // Calculate duration
    const durationSeconds = Math.floor((Date.now() - startTime) / 1000);

    // Update scan log
    await supabase
      .from('deal_scan_log')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        duration_seconds: durationSeconds,
        products_scanned: stats.productsScanned,
        deals_found: stats.warehouseDealsFound + stats.lightningDealsFound + stats.couponsFound,
        alerts_created: stats.alertsCreated,
        errors: stats.errors.length > 0 ? stats.errors : null,
        metadata: stats
      })
      .eq('id', scanLogId);

    console.log('\n✅ COMPREHENSIVE SCAN COMPLETE');
    console.log(`📊 Stats:`, stats);
    console.log(`⏱️  Duration: ${durationSeconds}s`);

    return res.status(200).json({
      success: true,
      scanType,
      duration: `${durationSeconds}s`,
      stats
    });

  } catch (error) {
    console.error('❌ Scan failed:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Scan watchlists for warehouse deals
 */
async function scanWarehouseDeals(supabase, watchlists) {
  const results = { found: 0, alertsCreated: 0, scanned: 0 };

  // Only scan Amazon products
  const amazonWatchlists = watchlists.filter(w => 
    w.marketplace === 'amazon' || 
    (w.product_url && w.product_url.includes('amazon.com'))
  );

  for (const watchlist of amazonWatchlists) {
    try {
      results.scanned++;

      const warehouseDeal = await checkWarehouseDeal(watchlist.product_url);
      
      if (warehouseDeal) {
        results.found++;

        // Store warehouse deal
        await storeWarehouseDeal(
          supabase,
          warehouseDeal,
          watchlist.product_name,
          watchlist.product_image_url
        );

        // Create alert for user
        const { error: alertError } = await supabase
          .from('deal_alerts')
          .insert({
            user_id: watchlist.user_id,
            watchlist_id: watchlist.id,
            deal_type: 'warehouse',
            product_name: watchlist.product_name,
            product_url: warehouseDeal.url,
            product_image_url: watchlist.product_image_url,
            current_price: warehouseDeal.price,
            original_price: warehouseDeal.originalPrice,
            discount_percentage: warehouseDeal.percentOff,
            savings_amount: warehouseDeal.savings,
            condition: warehouseDeal.condition,
            condition_note: warehouseDeal.conditionNote,
            alert_reason: `📦 Warehouse Deal! ${warehouseDeal.condition.replace('_', ' ')} condition at ${warehouseDeal.percentOff}% off`,
            deal_quality_score: 75 + warehouseDeal.percentOff * 0.25,
            is_read: false
          });

        if (!alertError) results.alertsCreated++;
      }

    } catch (error) {
      console.error(`Error scanning watchlist ${watchlist.id}:`, error.message);
    }
  }

  return results;
}

/**
 * Scan for lightning deals across categories
 */
async function scanLightningDealsAll(supabase, watchlists) {
  const results = { found: 0, alertsCreated: 0, scanned: 0 };

  try {
    // Get unique categories from watchlists
    const categories = [...new Set(watchlists.map(w => w.category).filter(Boolean))];
    
    // Scan each category
    for (const category of categories) {
      const lightningDeals = await scanLightningDeals({ category, minDiscount: 50 });
      results.found += lightningDeals.length;

      // Store deals
      for (const deal of lightningDeals) {
        await storeLightningDeal(supabase, deal);
      }

      // Match to watchlists and create alerts
      const matches = await matchLightningDealsToWatchlists(supabase, lightningDeals);
      const alerts = await createLightningDealAlerts(supabase, matches);
      results.alertsCreated += alerts.length;
    }

    results.scanned = categories.length;

  } catch (error) {
    console.error('Lightning deals scan error:', error);
  }

  return results;
}

/**
 * Scan watchlists for coupons
 */
async function scanCoupons(supabase, watchlists) {
  const results = { found: 0, alertsCreated: 0, scanned: 0 };

  // Only scan Amazon products
  const amazonWatchlists = watchlists.filter(w => 
    w.marketplace === 'amazon' || 
    (w.product_url && w.product_url.includes('amazon.com'))
  );

  for (const watchlist of amazonWatchlists) {
    try {
      results.scanned++;

      const coupon = await checkForCoupon(watchlist.product_url);
      
      if (coupon) {
        results.found++;

        // Store coupon deal
        await storeCouponDeal(
          supabase,
          coupon,
          watchlist.product_name,
          watchlist.product_image_url,
          watchlist.category
        );

        // Create alert for user
        const alertReason = coupon.isClippable
          ? `🎫 Clippable Coupon! ${coupon.totalPercentOff}% off (no code needed)`
          : `🎫 Coupon Available! Code: ${coupon.couponCode} for ${coupon.totalPercentOff}% off`;

        const { error: alertError } = await supabase
          .from('deal_alerts')
          .insert({
            user_id: watchlist.user_id,
            watchlist_id: watchlist.id,
            deal_type: 'coupon',
            product_name: watchlist.product_name,
            product_url: `https://www.amazon.com/dp/${coupon.asin}`,
            product_image_url: watchlist.product_image_url,
            current_price: coupon.finalPrice,
            original_price: coupon.currentPrice,
            discount_percentage: coupon.totalPercentOff,
            savings_amount: coupon.totalSavings,
            coupon_code: coupon.couponCode,
            coupon_discount: coupon.couponDiscount,
            expires_at: coupon.expiresAt,
            alert_reason: alertReason,
            deal_quality_score: 60 + coupon.totalPercentOff * 0.4,
            is_read: false
          });

        if (!alertError) results.alertsCreated++;
      }

    } catch (error) {
      console.error(`Error scanning watchlist ${watchlist.id}:`, error.message);
    }
  }

  return results;
}

/**
 * Scan for regular price drops (existing logic)
 */
async function scanPriceDrops(supabase, watchlists) {
  const results = { alertsCreated: 0, scanned: 0 };

  // This is your existing scan-deals.js logic
  // I'm keeping it minimal here as you already have it implemented
  
  for (const watchlist of watchlists) {
    try {
      results.scanned++;

      // Fetch current price (use your existing product search logic)
      // const currentPrice = await fetchCurrentPrice(watchlist.product_url);
      
      // Check if price dropped below target
      // if (currentPrice <= watchlist.target_price) {
      //   // Create alert
      //   results.alertsCreated++;
      // }

    } catch (error) {
      console.error(`Error scanning watchlist ${watchlist.id}:`, error.message);
    }
  }

  return results;
}

// Allow direct execution for testing
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    console.log('🧪 Running comprehensive scan (test mode)');
    
    const mockReq = {
      headers: {
        authorization: `Bearer ${process.env.CRON_SECRET}`
      },
      query: {
        type: process.argv[2] || 'all'
      }
    };

    const mockRes = {
      status: (code) => ({
        json: (data) => {
          console.log('\n📤 Response:', JSON.stringify(data, null, 2));
          process.exit(code === 200 ? 0 : 1);
        }
      })
    };

    await handler(mockReq, mockRes);
  })();
}
