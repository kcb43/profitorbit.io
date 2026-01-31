/**
 * Test Facebook Scraper - Verify it extracts data correctly
 * 
 * Run this locally to test the scraping logic before using in production
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import puppeteer from 'puppeteer';

const TEST_URL = 'https://www.facebook.com/marketplace/item/1727032111296260';

async function testScraper() {
  console.log('🧪 Testing Facebook scraper...');
  console.log('📄 Test URL:', TEST_URL);
  
  let browser;
  try {
    // Launch browser
    console.log('\n🌐 Launching browser...');
    browser = await puppeteer.launch({
      headless: false, // Show browser for debugging
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    console.log('✅ Browser launched');
    
    // Create page
    const page = await browser.newPage();
    
    // Set user agent
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );
    
    console.log('\n📡 Navigating to listing...');
    await page.goto(TEST_URL, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });
    console.log('✅ Page loaded');
    
    // Wait for dynamic content
    console.log('\n⏳ Waiting for dynamic content (3s)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract data
    console.log('\n🔍 Extracting data...');
    const scrapedData = await page.evaluate(() => {
      const data = {
        title: null,
        description: null,
        price: null,
        condition: null,
        brand: null,
        category: null,
        size: null,
        rawText: null // For debugging
      };

      // Get all text content
      const bodyText = document.body.textContent || '';
      data.rawText = bodyText.substring(0, 2000); // First 2000 chars for inspection
      
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
      // Pattern 1: Look for "Details" section - more precise
      const detailsMatch = bodyText.match(/Details\s*Condition\s*[A-Za-z\s-]+\s*(?:Men's|Women's|Kid's|Boys|Girls)?\s*(?:Shoe|Clothing|Show)?\s*Size\s*[\d.]+\s*(.+?)(?:Pickup|Delivery|Shipping|Listed|Posted|Message seller|Local pickup)/is);
      if (detailsMatch && detailsMatch[1]) {
        const extracted = detailsMatch[1]
          .replace(/^[^\w]+/, '') // Remove leading non-word chars
          .trim();
        if (extracted.length > 50 && extracted.length > (data.description?.length || 0)) {
          data.description = extracted;
        }
      }

      // Extract condition
      const conditionMatch = bodyText.match(/Condition\s+(New|Used|Brand New|Like New|Good|Fair|Poor|New with tags|New without tags|Used - Like New)/i);
      if (conditionMatch) {
        data.condition = conditionMatch[1];
      }

      // Extract brand - look after "Brand" but not "Brand new"
      const brandMatch = bodyText.match(/Brand\s+([A-Z][A-Za-z0-9\s&'-]{2,30})(?=\s*–|\s*-|\s*\n|$)/i);
      if (brandMatch && !brandMatch[1].toLowerCase().includes('new')) {
        data.brand = brandMatch[1].trim();
      }

      // Extract size - more precise pattern
      const sizeMatch = bodyText.match(/(?:Men's|Women's|Kid's|Boys|Girls)?\s*(?:Shoe|Clothing|Show)?\s*Size\s+([\d.]+(?:\s*[A-Z])?)/i);
      if (sizeMatch) {
        data.size = sizeMatch[1].trim();
      }

      return data;
    });
    
    // Display results
    console.log('\n📊 SCRAPED DATA:');
    console.log('================');
    console.log('Title:', scrapedData.title || '❌ NOT FOUND');
    console.log('Price:', scrapedData.price || '❌ NOT FOUND');
    console.log('Condition:', scrapedData.condition || '❌ NOT FOUND');
    console.log('Brand:', scrapedData.brand || '❌ NOT FOUND');
    console.log('Size:', scrapedData.size || '❌ NOT FOUND');
    console.log('\nDescription:');
    console.log(scrapedData.description || '❌ NOT FOUND');
    
    console.log('\n\n📝 RAW TEXT SAMPLE (first 2000 chars):');
    console.log('=====================================');
    console.log(scrapedData.rawText);
    
    await page.close();
    await browser.close();
    
    console.log('\n✅ Test complete!');
    
    // Analyze results
    console.log('\n📈 ANALYSIS:');
    console.log('============');
    if (scrapedData.description && scrapedData.description.length > 50) {
      console.log('✅ Description extracted successfully');
    } else {
      console.log('❌ Description extraction failed - needs investigation');
    }
    
    if (scrapedData.condition) {
      console.log('✅ Condition extracted');
    } else {
      console.log('⚠️ Condition not found');
    }
    
    if (scrapedData.brand) {
      console.log('✅ Brand extracted');
    } else {
      console.log('⚠️ Brand not found');
    }
    
    if (scrapedData.size) {
      console.log('✅ Size extracted');
    } else {
      console.log('⚠️ Size not found');
    }
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    if (browser) await browser.close().catch(() => {});
    process.exit(1);
  }
}

testScraper();
