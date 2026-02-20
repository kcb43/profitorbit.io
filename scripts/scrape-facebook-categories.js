/**
 * Facebook Marketplace Category Scraper
 *
 * Validates each known top-level category by navigating to its URL,
 * then scrapes subcategories from each confirmed category page.
 *
 * Output: scripts/output/facebook-categories.json
 *
 * Usage:
 *   node scripts/scrape-facebook-categories.js
 */

import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config ----------
const SESSION_DIR = path.resolve(__dirname, '.fb-session');
const OUTPUT_DIR  = path.resolve(__dirname, 'output');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'facebook-categories.json');
const BASE_URL    = 'https://www.facebook.com';
const CAT_URL     = `${BASE_URL}/marketplace/categories/`;
const NAV_TIMEOUT = 20_000;
const SLUG_WAIT   = 800;   // ms between slug validation requests
const SUBCAT_WAIT = 1500;  // ms after navigating to a category page
// ----------------------------

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Known top-level Facebook Marketplace categories with multiple slug candidates.
 * The validator navigates to each candidate and keeps the first one that
 * returns a real category page.
 */
const CATEGORY_CANDIDATES = [
  { name: 'Vehicles',                  candidates: ['vehicles'] },
  { name: 'Property Rentals',          candidates: ['propertyrentals'] },
  { name: 'Apparel',                   candidates: ['apparel'] },
  { name: 'Classifieds',               candidates: ['classifieds'] },
  { name: 'Electronics',               candidates: ['electronics'] },
  { name: 'Entertainment',             candidates: ['entertainment'] },
  { name: 'Family',                    candidates: ['family'] },
  { name: 'Hobbies',                   candidates: ['hobbies'] },
  { name: 'Office Supplies',           candidates: ['office-supplies', 'officesupplies'] },
  { name: 'Free Stuff',                candidates: ['freestuff', 'free-stuff', 'free'] },
  { name: 'Garden & Outdoor',          candidates: ['garden', 'gardenoutdoor', 'garden-outdoor'] },
  { name: 'Home Goods',                candidates: ['homegoods', 'home-goods', 'furniture'] },
  { name: 'Home Improvement Supplies', candidates: ['homeimprovement', 'home-improvement-supplies', 'diy'] },
  { name: 'Home Sales',                candidates: ['homesales', 'forsalehomes', 'home-sales'] },
  { name: 'Musical Instruments',       candidates: ['musicalinstruments', 'musical-instruments', 'instruments'] },
  { name: 'Pet Supplies',              candidates: ['petsupplies', 'pet-supplies', 'pets'] },
  { name: 'Sporting Goods',            candidates: ['sportinggoods', 'sporting-goods', 'sports'] },
  { name: 'Toys & Games',              candidates: ['toys', 'toysandgames', 'toys-and-games'] },
  { name: 'Baby & Kids',               candidates: ['babykids', 'baby-kids', 'baby'] },
];

async function waitForLogin(page) {
  const url = page.url();
  if (!url.includes('login') && !url.includes('checkpoint') && !url.includes('recover')) {
    return true;
  }

  console.log('\n⚠️  Please log in to Facebook in the browser window.');
  console.log('    The script will continue automatically once you are logged in.\n');

  await page.waitForNavigation({
    timeout: 5 * 60_000,
    waitUntil: 'domcontentloaded',
  }).catch(() => {});

  return true;
}

/**
 * Navigate to a candidate slug URL and confirm it's a real category page.
 */
async function validateSlug(page, slug) {
  const url = `${BASE_URL}/marketplace/category/${slug}`;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    const finalUrl = page.url();
    // Must still be on the slug URL (not redirected away)
    if (!finalUrl.includes(`/marketplace/category/${slug}`)) return false;
    // Must have actual marketplace content
    const hasContent = await page.$('a[href*="/marketplace/item/"], a[href*="/marketplace/category/"]');
    return Boolean(hasContent);
  } catch {
    return false;
  }
}

/**
 * Navigate to each category candidate and confirm which slug is correct.
 */
async function resolveCategories(page) {
  console.log('📂 Validating category slugs...\n');

  const validated = [];

  for (const { name, candidates } of CATEGORY_CANDIDATES) {
    let found = null;
    for (const slug of candidates) {
      process.stdout.write(`   ${name.padEnd(32)} trying "${slug}"... `);
      const valid = await validateSlug(page, slug);
      if (valid) {
        console.log('✅');
        found = { id: slug, name, href: `${BASE_URL}/marketplace/category/${slug}` };
        break;
      } else {
        console.log('✗');
      }
      await sleep(SLUG_WAIT);
    }

    if (found) {
      validated.push(found);
    } else {
      console.warn(`   ⚠️  No valid slug found for "${name}" — skipping`);
    }
  }

  console.log(`\n   Resolved ${validated.length}/${CATEGORY_CANDIDATES.length} categories.\n`);
  return validated;
}

/**
 * Scrape direct subcategories from a category page.
 * Only collects links matching /marketplace/category/PARENT/CHILD pattern.
 */
async function scrapeSubcategories(page, parentSlug, categoryHref) {
  try {
    await page.goto(categoryHref, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT });
    await sleep(SUBCAT_WAIT);

    return await page.evaluate((parentSlug, baseUrl) => {
      const seen = new Set();
      const results = [];

      // Pattern 1: /marketplace/category/PARENT/CHILD nested paths
      const nested = new RegExp(`/marketplace/category/${parentSlug}/([^/?#]+)`, 'i');
      document.querySelectorAll('a[href]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const m = href.match(nested);
        if (!m) return;
        const childSlug = m[1];
        if (seen.has(childSlug)) return;
        seen.add(childSlug);
        const name = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (name && name.length <= 60) results.push({ id: childSlug, name });
      });

      if (results.length > 0) return results;

      // Pattern 2: filter chip links (short text, different slug from parent)
      document.querySelectorAll('a[href*="/marketplace/category/"]').forEach(a => {
        const href = a.getAttribute('href') || '';
        const m2 = href.match(/\/marketplace\/category\/([^/?#]+)/i);
        const slug = m2 ? m2[1] : null;
        if (!slug || slug === parentSlug || seen.has(slug)) return;
        seen.add(slug);
        const name = (a.textContent || '').replace(/\s+/g, ' ').trim();
        if (!name || name.length > 40 || name.length < 2) return;
        if (/^(marketplace|buy|sell|inbox|facebook|notifications)$/i.test(name)) return;
        results.push({ id: slug, name });
      });

      return results;
    }, parentSlug, BASE_URL);
  } catch (err) {
    console.warn(`   ⚠️  Subcategory scrape failed for ${categoryHref}: ${err.message}`);
    return [];
  }
}

async function main() {
  ensureDir(SESSION_DIR);
  ensureDir(OUTPUT_DIR);

  console.log('🚀 Facebook Marketplace Category Scraper');
  console.log('==========================================');
  console.log(`Session dir : ${SESSION_DIR}`);
  console.log(`Output file : ${OUTPUT_FILE}\n`);

  const browser = await puppeteer.launch({
    headless: false,
    userDataDir: SESSION_DIR,
    defaultViewport: null,
    args: ['--start-maximized', '--no-sandbox', '--disable-setuid-sandbox'],
  });

  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    // Navigate to Facebook marketplace to trigger login if needed
    console.log('🌐 Opening Facebook Marketplace...');
    await page.goto(CAT_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await waitForLogin(page);
    await sleep(1500);

    // ── Step 1: Validate all category slugs ──
    const categories = await resolveCategories(page);

    if (categories.length === 0) {
      console.error('❌ No categories resolved. Check your Facebook login.');
      await browser.close();
      process.exit(1);
    }

    // ── Step 2: Scrape subcategories for each confirmed category ──
    console.log('📑 Scraping subcategories...\n');
    const fullTree = [];

    for (let i = 0; i < categories.length; i++) {
      const cat = categories[i];
      console.log(`   [${i + 1}/${categories.length}] ${cat.name}  (${cat.id})`);

      const subcats = await scrapeSubcategories(page, cat.id, cat.href);
      console.log(`      └─ ${subcats.length} subcategories`);

      fullTree.push({ id: cat.id, name: cat.name, subcategories: subcats });

      // Save progress after each category
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(
        { scraped_at: new Date().toISOString(), categories: fullTree }, null, 2
      ));
    }

    // ── Step 3: Write final output ──
    const output = {
      scraped_at: new Date().toISOString(),
      total_categories: fullTree.length,
      total_subcategories: fullTree.reduce((n, c) => n + c.subcategories.length, 0),
      categories: fullTree,
    };

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));

    console.log('\n✅ Done!');
    console.log(`   Categories    : ${output.total_categories}`);
    console.log(`   Subcategories : ${output.total_subcategories}`);
    console.log(`   Saved to      : ${OUTPUT_FILE}`);

  } catch (err) {
    console.error('\n❌ Fatal error:', err.message);
  } finally {
    await browser.close();
  }
}

main();
