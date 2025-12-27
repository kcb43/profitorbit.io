/**
 * Render Worker Service
 * Polls Supabase for queued listing jobs and processes them with Playwright
 */

import { chromium } from 'playwright';
import dotenv from 'dotenv';
import {
  claimJob,
  updateJobProgress,
  updateJobResult,
  markJobFailed,
  logJobEvent,
  supabase,
} from './utils-new/db.js';
import { decrypt } from './utils-new/encryption.js';
import { MercariProcessor } from './processors-new/mercari.js';
import { FacebookProcessor } from './processors-new/facebook.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Version stamp to verify deployment
console.log('WORKER BUILD:', '2025-12-27-worker-fix-3');

// Debug: Log container file structure
console.log('FILES IN /app:', fs.readdirSync('/app'));
console.log('FILES IN /app/utils-new:', fs.existsSync('/app/utils-new') ? fs.readdirSync('/app/utils-new') : 'missing');
console.log('FILES IN /app/processors-new:', fs.existsSync('/app/processors-new') ? fs.readdirSync('/app/processors-new') : 'missing');

dotenv.config();

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '2000');
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '1');
const HEADLESS = process.env.HEADLESS ? process.env.HEADLESS !== 'false' : true;

let browser = null;
let isRunning = false;
let currentJobs = new Set();

function getPlaywrightProxyConfig() {
  // Supports either a full proxy URL in PLAYWRIGHT_PROXY (e.g. http://user:pass@host:port)
  // or discrete vars:
  // - PLAYWRIGHT_PROXY_SERVER (e.g. http://host:port)
  // - PLAYWRIGHT_PROXY_USERNAME
  // - PLAYWRIGHT_PROXY_PASSWORD
  // - PLAYWRIGHT_PROXY_BYPASS (comma-separated domains)
  const raw = process.env.PLAYWRIGHT_PROXY;
  if (raw && typeof raw === 'string' && raw.trim()) {
    // Playwright accepts server/username/password/bypass but not a combined URL with creds reliably across all cases,
    // so parse it ourselves.
    try {
      const u = new URL(raw);
      const username = u.username ? decodeURIComponent(u.username) : undefined;
      const password = u.password ? decodeURIComponent(u.password) : undefined;
      const server = `${u.protocol}//${u.host}`;
      return {
        server,
        username,
        password,
        bypass: process.env.PLAYWRIGHT_PROXY_BYPASS || undefined,
      };
    } catch {
      // If it's not a valid URL, treat it as server
      return { server: raw.trim() };
    }
  }

  const server = process.env.PLAYWRIGHT_PROXY_SERVER;
  if (!server) return null;

  return {
    server,
    username: process.env.PLAYWRIGHT_PROXY_USERNAME || undefined,
    password: process.env.PLAYWRIGHT_PROXY_PASSWORD || undefined,
    bypass: process.env.PLAYWRIGHT_PROXY_BYPASS || undefined,
  };
}

function withTimeout(promise, ms, label) {
  let t = null;
  const timeoutPromise = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (t) clearTimeout(t);
  });
}

/**
 * Initialize Playwright browser
 */
async function initBrowser() {
  if (browser) {
    return browser;
  }

  console.log('🚀 Initializing Playwright browser...');
  const proxy = getPlaywrightProxyConfig();
  if (proxy?.server) {
    console.log('🧷 Using Playwright proxy server:', proxy.server);
  } else {
    console.log('🧷 No Playwright proxy configured (direct connection)');
  }

  browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
    ...(proxy?.server ? { proxy } : {}),
  });

  console.log('✅ Browser initialized');
  return browser;
}

/**
 * Get platform account for user and platform
 */
async function getPlatformAccount(userId, platform) {
  const { data, error } = await supabase
    .from('platform_accounts')
    .select('*')
    .eq('user_id', userId)
    .eq('platform', platform)
    .eq('status', 'connected')
    .single();

  if (error || !data) {
    throw new Error(`Platform account not found or not connected: ${platform}`);
  }

  // Decrypt session payload
  const decrypted = decrypt(data.session_payload_encrypted);
  return {
    ...data,
    session_payload_encrypted: decrypted,
  };
}

function normalizeMercariPayload(p) {
  // Normalize common fields from upstream payload shapes
  const photos = Array.isArray(p?.photos) ? p.photos : [];
  const imageUrls = photos
    .map((ph) => ph?.preview)
    .filter((u) => typeof u === 'string' && u.startsWith('http'));

  const normalized = {
    ...p,
    category: p?.category || p?.mercariCategory || p?.mercariCategoryId,
    images: imageUrls, // default to URL list; will download before upload
    shipping: p?.shipping || {
      paidBy: p?.shipping?.paidBy || p?.shippingPayer,
      method: p?.shipping?.method || p?.deliveryMethod || p?.shippingCarrier,
    },
  };

  const missing = [];

  // Core
  if (!normalized?.title || normalized.title.trim().length < 3) missing.push("title");
  if (!normalized?.description || normalized.description.trim().length < 10) missing.push("description");
  if (normalized?.price == null || Number(normalized.price) <= 0) missing.push("price");
  if (!normalized?.category) missing.push("category");
  if (!normalized?.condition) missing.push("condition");

  // Shipping
  if (!normalized?.shipping) {
    missing.push("shipping");
  } else {
    const s = normalized.shipping;
    if (!s?.paidBy) missing.push("shipping.paidBy");
    if (!s?.method) missing.push("shipping.method");
    // add weight here if required: if (!s?.weight) missing.push("shipping.weight");
  }

  // Photos
  const imgs = normalized?.images || [];
  if (!Array.isArray(imgs) || imgs.length === 0) missing.push("images");

  return { missing, normalized, imageUrls };
}

async function downloadToTmp(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download image: ${url} (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const filePath = path.join(
    os.tmpdir(),
    `img-${Date.now()}-${Math.random().toString(16).slice(2)}.jpg`
  );
  await fs.promises.writeFile(filePath, buf);
  return filePath;
}

/**
 * Process a single listing job
 */
async function processJob(job) {
  if (!job || !job.id) {
    console.error("❌ Claimed job is invalid:", job);
    return;
  }

  const jobId = job.id;
  currentJobs.add(jobId);

  try {
    const platformsArr = Array.isArray(job.platforms) ? job.platforms : [];
    if (platformsArr.length === 0) {
      console.error("❌ Job platforms is not an array or empty:", job.platforms, "job:", job);
      await safeMarkJobFailed(jobId, "Job has no platforms");
      return;
    }

    const platformsStr = platformsArr.join(', ');
    console.log(`📦 Processing job ${jobId} for platforms: ${platformsStr}`);

    // Initialize browser if needed
    await initBrowser();

    const results = {};

    // Process each platform sequentially
    for (const platform of platformsArr) {
      try {
        console.log(`➡️ Job ${jobId}: starting platform ${platform}`);
        await updateJobProgress(jobId, {
          percent: Math.floor((platformsArr.indexOf(platform) / platformsArr.length) * 100),
          message: `Processing ${platform}...`,
        });

        await logJobEvent(jobId, 'info', `Starting ${platform} listing`, { platform });

        // Get platform account
        console.log(`🔐 Job ${jobId}: fetching platform account for ${platform}`);
        const platformAccount = await getPlatformAccount(job.user_id, platform);
        console.log(`🔐 Job ${jobId}: platform account loaded for ${platform}`);

        // Create processor
        let processor;
        switch (platform) {
          case 'mercari':
            processor = new MercariProcessor(browser, job, platformAccount);
            break;
          case 'facebook':
            processor = new FacebookProcessor(browser, job, platformAccount);
            break;
          default:
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Initialize processor
        console.log(`🧭 Job ${jobId}: initializing processor for ${platform}`);
        await processor.initialize();
        console.log(`🧭 Job ${jobId}: processor initialized for ${platform}`);

        // Validate Mercari payload before filling form
        if (platform === 'mercari') {
          const { missing, normalized, imageUrls } = normalizeMercariPayload(job.payload);
          if (missing.length) {
            const msg = `Mercari form validation errors: ${missing.join("; ")}`;
            await safeMarkJobFailed(jobId, msg);
            await logJobEvent(jobId, 'error', 'Mercari validation failed', { missing });
            throw new Error(msg);
          }
          // Download images to temp files for upload (Playwright requires file paths)
          const localFiles = [];
          for (const url of imageUrls) {
            localFiles.push(await downloadToTmp(url));
          }
          job.payload = {
            ...normalized,
            images: localFiles,
            imageUrls, // keep original urls for debugging if needed
          };
          // Upload images using local file paths
          if (localFiles.length === 0) {
            throw new Error("Mercari requires at least 1 photo. payload.photos is empty/invalid.");
          }
          console.log(`🖼️ Job ${jobId}: uploading ${localFiles.length} images to Mercari`);
          await withTimeout(
            processor.uploadImages(localFiles),
            4 * 60 * 1000,
            `mercari uploadImages (${localFiles.length} images)`
          );
        } else {
          const imageUrls = Array.isArray(job.payload.images) ? job.payload.images
            : Array.isArray(job.payload.photos) ? job.payload.photos.map(p => p.preview || p.imageUrl).filter(Boolean)
            : [];

          console.log("🖼️ Images resolved:", imageUrls.length);

          if (imageUrls.length > 0) {
            console.log(`🖼️ Job ${jobId}: uploading ${imageUrls.length} images to ${platform}`);
            await withTimeout(
              processor.uploadImages(imageUrls),
              4 * 60 * 1000,
              `${platform} uploadImages (${imageUrls.length} images)`
            );
            await logJobEvent(jobId, 'info', `Uploaded ${imageUrls.length} images`, { platform });
          } else {
            throw new Error("No images provided (Mercari requires at least 1 photo).");
          }
        }

        // Fill form
        console.log(`📝 Job ${jobId}: filling form for ${platform}`);
        await withTimeout(processor.fillForm(job.payload), 3 * 60 * 1000, `${platform} fillForm`);
        await logJobEvent(jobId, 'info', 'Form filled', { platform });

        // Submit
        console.log(`🚀 Job ${jobId}: submitting for ${platform}`);
        await withTimeout(processor.submit(), 3 * 60 * 1000, `${platform} submit`);
        await logJobEvent(jobId, 'info', 'Listing submitted', { platform });

        // Get listing URL
        console.log(`🔗 Job ${jobId}: fetching listing URL for ${platform}`);
        const listingUrl = await processor.getListingUrl();
        if (platform === 'mercari') {
          const ok =
            typeof listingUrl === 'string' &&
            listingUrl.includes('mercari.com/items/');
          if (!ok) {
            throw new Error(
              `Mercari listingUrl not confirmed (expected mercari.com/items/...). Got: ${listingUrl || 'empty'}`
            );
          }
        }
        results[platform] = {
          success: true,
          listingUrl,
        };

        await logJobEvent(jobId, 'success', `Listing created: ${listingUrl}`, {
          platform,
          url: listingUrl,
        });

        // Cleanup
        await processor.cleanup();
      } catch (error) {
        console.error(`Error processing ${platform}:`, error);
        results[platform] = {
          success: false,
          error: error.message,
        };

        await logJobEvent(jobId, 'error', `Failed: ${error.message}`, {
          platform,
          error: error.message,
          stack: error.stack,
        });

        // Mark platform as needing reauth if it's an auth error
        if (error.message.includes('auth') || error.message.includes('login')) {
          await supabase
            .from('platform_accounts')
            .update({ status: 'needs_reauth' })
            .eq('user_id', job.user_id)
            .eq('platform', platform);
        }
      }
    }

    // Persist results without overwriting status incorrectly.
    const allSuccess = Object.values(results).every((r) => r.success);

    if (!allSuccess) {
      await safeMarkJobFailed(jobId, 'Some platforms failed to list');
      await updateJobResult(jobId, results);
      console.log(`✅ Job ${jobId} completed (with failures)`);
      return;
    }

    // All succeeded: mark completed + persist results
    await updateJobResult(jobId, results);
    await supabase
      .from('listing_jobs')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`✅ Job ${jobId} completed`);
  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    await safeMarkJobFailed(jobId, error.message);
    await logJobEvent(jobId, 'error', `Job failed: ${error.message}`, {
      error: error.message,
      stack: error.stack,
    });
  } finally {
    currentJobs.delete(jobId);
  }
}

async function safeMarkJobFailed(jobId, errMessage) {
  if (!jobId) {
    console.error("❌ Cannot mark failed: missing jobId", errMessage);
    return;
  }
  try {
    await supabase
      .from('listing_jobs')
      .update({
        status: 'failed',
        progress: { percent: 0, message: 'Failed' },
        result: { error: errMessage },
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
  } catch (err) {
    console.error("❌ safeMarkJobFailed error", err);
  }
}

/**
 * Main worker loop
 */
async function workerLoop() {
  if (isRunning) {
    return;
  }

  isRunning = true;

  try {
    // Don't claim new jobs if we're at max concurrent
    if (currentJobs.size >= MAX_CONCURRENT_JOBS) {
      return;
    }

    // Claim a job with proper error handling
    // claimJob() returns null or a job object, but may throw errors
    // Normalize to { job, error } format for consistent handling
    const result = await claimJob()
      .then((job) => ({ job, error: null })) // Success: normalize to { job, error: null }
      .catch((err) => ({ job: null, error: err })); // Error: normalize to { job: null, error }
    
    if (!result || result.error) {
      console.error('Error claiming job:', result?.error || 'unknown');
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      return; // Continue polling instead of crashing
    }
    
    const job = result.job;
    if (!job) {
      // No jobs available
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      return; // Continue polling
    }

    // Process job inline for stability (MAX_CONCURRENT_JOBS=1)
    await processJob(job);
  } catch (error) {
    // Catch any unexpected errors to prevent worker crash
    console.error('Unexpected error in workerLoop:', error);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  } finally {
    isRunning = false;
  }
}

/**
 * Start worker
 */
async function start() {
  console.log('🚀 Starting Listing Automation Worker...');
  console.log(`⏱️  Poll interval: ${POLL_INTERVAL_MS}ms`);
  console.log(`🔢 Max concurrent jobs: ${MAX_CONCURRENT_JOBS}`);
  console.log(`👻 Headless mode: ${HEADLESS}`);

  // Start polling loop
  setInterval(workerLoop, POLL_INTERVAL_MS);

  // Run immediately
  workerLoop();

  // Handle graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('🛑 Shutting down gracefully...');
    if (browser) {
      await browser.close();
    }
    process.exit(0);
  });
}

// Start the worker
start().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});


