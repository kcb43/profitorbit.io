/**
 * Facebook Scraper Worker
 * 
 * Continuously polls for pending scraping jobs and processes them using Puppeteer
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer-core';
import puppeteerFull from 'puppeteer';
import chromium from '@sparticuz/chromium';

// Configuration
const POLL_INTERVAL_MS = 3000; // Check for jobs every 3 seconds
const MAX_RETRIES = 3;
const CONCURRENT_JOBS = 2; // Process 2 jobs at a time
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Initialize Supabase
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

console.log('🚀 Facebook Scraper Worker starting...');
console.log(`📊 Poll interval: ${POLL_INTERVAL_MS}ms`);
console.log(`🔄 Max retries: ${MAX_RETRIES}`);
console.log(`⚡ Concurrent jobs: ${CONCURRENT_JOBS}`);

/**
 * Scrape a single Facebook listing page
 */
async function scrapeFacebookListing(url, browser) {
  console.log(`🔍 Scraping: ${url}`);
  
  let page;
  try {
    page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    // Navigate to listing
    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for dynamic content
    await page.waitForTimeout(2000);

    // Extract data using page.evaluate
    const scrapedData = await page.evaluate(() => {
      const data = {
        title: null,
        description: null,
        price: null,
        condition: null,
        brand: null,
        category: null,
        categoryPath: [],
        location: null,
        size: null
      };

      // Extract title from meta tags
      const titleMeta = document.querySelector('meta[property="og:title"]');
      if (titleMeta) {
        data.title = titleMeta.content;
      }

      // Extract description from meta tags
      const descMeta = document.querySelector('meta[name="description"]') || 
                      document.querySelector('meta[property="og:description"]');
      if (descMeta) {
        data.description = descMeta.content;
      }

      // Try structured data
      const jsonLd = document.querySelector('script[type="application/ld+json"]');
      if (jsonLd) {
        try {
          const structured = JSON.parse(jsonLd.textContent);
          if (structured.description) data.description = structured.description;
          if (structured.offers?.price) data.price = structured.offers.price;
        } catch (e) {
          console.error('Failed to parse JSON-LD:', e);
        }
      }

      // Enhanced description extraction from page text
      const bodyText = document.body.textContent || '';
      
      // Pattern 1: Look for "Details" section
      const detailsMatch = bodyText.match(/Details[\s\S]{0,500}?(Brand New|Selling|Brand:|Condition:)([\s\S]{50,2000}?)(?:Pickup|Delivery|Shipping|Listed|Posted|Message|See more)/i);
      if (detailsMatch && detailsMatch[0]) {
        const extracted = detailsMatch[0]
          .replace(/^Details\s*/i, '')
          .replace(/(?:Pickup|Delivery|Shipping|Listed|Posted|Message).*$/i, '')
          .trim();
        if (extracted.length > 50 && extracted.length > (data.description?.length || 0)) {
          data.description = extracted;
        }
      }

      // Extract condition
      const conditionMatch = bodyText.match(/Condition\s*[:·]?\s*(New|Used|Brand New|Like New|Good|Fair|Poor|New with tags|New without tags)/i);
      if (conditionMatch) {
        data.condition = conditionMatch[1];
      }

      // Extract brand
      const brandMatch = bodyText.match(/Brand\s*[:·]?\s*([A-Za-z0-9\s&'-]{2,30})(?:\s|$|,|\.|;)/i);
      if (brandMatch) {
        data.brand = brandMatch[1].trim();
      }

      // Extract size
      const sizeMatch = bodyText.match(/Size\s*[:·]?\s*([A-Z0-9\s/.-]{1,20})(?:\s|$|,|\.|;)/i);
      if (sizeMatch) {
        data.size = sizeMatch[1].trim();
      }

      return data;
    });

    console.log('✅ Scraped data:', scrapedData);
    
    await page.close();
    return scrapedData;

  } catch (error) {
    console.error('❌ Scraping error:', error.message);
    if (page) await page.close().catch(() => {});
    throw error;
  }
}

/**
 * Process a single job
 */
async function processJob(job, browser) {
  console.log(`📦 Processing job ${job.id} for item ${job.item_id}`);

  try {
    // Mark as processing
    await supabase
      .from('facebook_scraping_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job.id);

    // Scrape the listing
    const scrapedData = await scrapeFacebookListing(job.listing_url, browser);

    // Mark as completed with results
    const { error } = await supabase
      .from('facebook_scraping_jobs')
      .update({
        status: 'completed',
        scraped_data: scrapedData,
        completed_at: new Date().toISOString()
      })
      .eq('id', job.id);

    if (error) throw error;

    console.log(`✅ Job ${job.id} completed successfully`);
    return true;

  } catch (error) {
    console.error(`❌ Job ${job.id} failed:`, error.message);

    // Update job with error
    const newRetryCount = (job.retry_count || 0) + 1;
    const shouldFail = newRetryCount >= MAX_RETRIES;

    await supabase
      .from('facebook_scraping_jobs')
      .update({
        status: shouldFail ? 'failed' : 'pending',
        error_message: error.message,
        retry_count: newRetryCount
      })
      .eq('id', job.id);

    return false;
  }
}

/**
 * Main worker loop
 */
async function work() {
  let browser = null;

  try {
    // Launch browser once and reuse
    console.log('🌐 Launching browser...');
    
    if (IS_PRODUCTION) {
      // Production: Use system chromium from Alpine
      browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu'
        ]
      });
    } else {
      // Local development: Use regular puppeteer with bundled Chromium
      browser = await puppeteerFull.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    
    console.log('✅ Browser launched');

    // Main loop
    while (true) {
      try {
        // Fetch pending jobs
        const { data: jobs, error } = await supabase
          .from('facebook_scraping_jobs')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(CONCURRENT_JOBS);

        if (error) {
          console.error('❌ Error fetching jobs:', error);
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }

        if (!jobs || jobs.length === 0) {
          // No jobs, wait and poll again
          await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
          continue;
        }

        console.log(`📋 Found ${jobs.length} pending job(s)`);

        // Process jobs concurrently
        await Promise.all(jobs.map(job => processJob(job, browser)));

        // Small delay before next batch
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error('❌ Worker loop error:', error);
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }

  } catch (error) {
    console.error('❌ Fatal error:', error);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

// Start the worker
work();
