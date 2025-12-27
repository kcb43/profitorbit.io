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
} from './utils-new/db.js';
import { decrypt } from './utils-new/encryption.js';
import { MercariProcessor } from './processors-new/mercari.js';
import { FacebookProcessor } from './processors-new/facebook.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Version stamp to verify deployment
console.log('WORKER BUILD:', '2025-12-23-import-fix-1');

// Debug: Log container file structure
console.log('FILES IN /app:', fs.readdirSync('/app'));
console.log('FILES IN /app/utils-new:', fs.existsSync('/app/utils-new') ? fs.readdirSync('/app/utils-new') : 'missing');
console.log('FILES IN /app/processors-new:', fs.existsSync('/app/processors-new') ? fs.readdirSync('/app/processors-new') : 'missing');

dotenv.config();

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '2000');
const MAX_CONCURRENT_JOBS = parseInt(process.env.MAX_CONCURRENT_JOBS || '1');
const HEADLESS = false;

let browser = null;
let isRunning = false;
let currentJobs = new Set();

/**
 * Initialize Playwright browser
 */
async function initBrowser() {
  if (browser) {
    return browser;
  }

  console.log('🚀 Initializing Playwright browser...');
  browser = await chromium.launch({
    headless: HEADLESS,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
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
        await updateJobProgress(jobId, {
          percent: Math.floor((platformsArr.indexOf(platform) / platformsArr.length) * 100),
          message: `Processing ${platform}...`,
        });

        await logJobEvent(jobId, 'info', `Starting ${platform} listing`, { platform });

        // Get platform account
        const platformAccount = await getPlatformAccount(job.user_id, platform);

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
        await processor.initialize();

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
          await processor.uploadImages(localFiles);
        } else {
          const imageUrls = Array.isArray(job.payload.images) ? job.payload.images
            : Array.isArray(job.payload.photos) ? job.payload.photos.map(p => p.preview || p.imageUrl).filter(Boolean)
            : [];

          console.log("🖼️ Images resolved:", imageUrls.length);

          if (imageUrls.length > 0) {
            await processor.uploadImages(imageUrls);
            await logJobEvent(jobId, 'info', `Uploaded ${imageUrls.length} images`, { platform });
          } else {
            throw new Error("No images provided (Mercari requires at least 1 photo).");
          }
        }

        // Fill form
        await processor.fillForm(job.payload);
        await logJobEvent(jobId, 'info', 'Form filled', { platform });

        // Submit
        await processor.submit();
        await logJobEvent(jobId, 'info', 'Listing submitted', { platform });

        // Get listing URL
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

    // Update job result
    const allSuccess = Object.values(results).every((r) => r.success);
    if (!allSuccess) {
      // If not all succeeded, mark as failed
      await safeMarkJobFailed(jobId, 'Some platforms failed to list');
    }
    await updateJobResult(jobId, results);

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


