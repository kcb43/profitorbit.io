/**
 * Base processor class for marketplace listing automation
 */

import { downloadImage } from '../utils-new/storage.js';
import { updateJobProgress, logJobEvent } from '../utils-new/db.js';

export class BaseProcessor {
  constructor(browser, job, platformAccount) {
    this.browser = browser;
    this.job = job;
    this.platformAccount = platformAccount;
    this.page = null;
    this.context = null;
    this.listingUrl = null;
    
    // Parse cookies from platform account
    const sessionPayload = platformAccount.session_payload_encrypted || {};
    this.cookies = sessionPayload.cookies || [];
    this.userAgent = sessionPayload.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';
  }

  normalizeCookiesForPlaywright(cookies) {
    const mapSameSite = (v) => {
      if (!v) return undefined;
      const s = String(v).toLowerCase();
      if (s === 'lax') return 'Lax';
      if (s === 'strict') return 'Strict';
      if (s === 'none' || s === 'no_restriction') return 'None';
      return undefined;
    };

    return (Array.isArray(cookies) ? cookies : [])
      .map((c) => {
        if (!c?.name || c?.value == null) return null;

        const expires =
          typeof c.expires === 'number' ? c.expires
          : typeof c.expirationDate === 'number' ? c.expirationDate
          : undefined;

        const out = {
          name: c.name,
          value: c.value,
          path: c.path || '/',
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
        };

        // Prefer url-based cookies when provided (required for host-only / __Host-* cookies)
        if (typeof c.url === 'string' && c.url.startsWith('http')) {
          out.url = c.url;
        } else if (c.domain) {
          out.domain = c.domain;
        } else {
          return null;
        }

        const sameSite = mapSameSite(c.sameSite);
        if (sameSite) out.sameSite = sameSite;
        if (typeof expires === 'number') out.expires = expires;

        return out;
      })
      .filter(Boolean);
  }

  /**
   * Initialize the browser page
   */
  async initialize() {
    this.context = await this.browser.newContext({
      userAgent: this.userAgent,
      viewport: { width: 1280, height: 720 },
    });

    // Set cookies
    if (this.cookies && this.cookies.length > 0) {
      const normalized = this.normalizeCookiesForPlaywright(this.cookies);
      console.log(`🍪 Adding cookies: raw=${this.cookies.length} normalized=${normalized.length}`);
      await this.context.addCookies(normalized);

      // Verify cookies actually landed in the context (helps debug Mercari login redirects)
      try {
        const applied = await this.context.cookies('https://www.mercari.com/');
        const hostCookies = applied.filter((c) => typeof c?.domain === 'string' && c.domain.includes('mercari'));
        const hostNames = hostCookies.slice(0, 12).map((c) => c.name);
        const hasHostPrefix = hostCookies.some((c) => typeof c?.name === 'string' && c.name.startsWith('__Host-'));
        console.log(
          `🍪 Context cookies for mercari.com: count=${hostCookies.length} has__Host=${hasHostPrefix} sample=${hostNames.join(',')}`
        );
      } catch (e) {
        console.log('⚠️ Could not verify applied cookies:', e?.message || e);
      }
    }

    this.page = await this.context.newPage();

    // Mercari/Facebook can be slow and `networkidle` is unreliable; use generous defaults.
    this.page.setDefaultTimeout(90000);
    this.page.setDefaultNavigationTimeout(90000);
  }

  /**
   * Upload images to the marketplace
   * Must be implemented by subclasses
   */
  async uploadImages(imagePaths) {
    throw new Error('uploadImages() must be implemented by subclass');
  }

  /**
   * Fill the listing form
   * Must be implemented by subclasses
   */
  async fillForm(payload) {
    throw new Error('fillForm() must be implemented by subclass');
  }

  /**
   * Submit the listing
   * Must be implemented by subclasses
   */
  async submit() {
    throw new Error('submit() must be implemented by subclass');
  }

  /**
   * Get the listing URL after submission
   * Must be implemented by subclasses
   */
  async getListingUrl() {
    return this.listingUrl;
  }

  /**
   * Download image from Supabase Storage
   */
  async downloadImageFromStorage(imagePath) {
    // Extract bucket and path from full URL or path
    let bucket = 'listing-photos';
    let path = imagePath;

    // If it's a full URL, extract the path
    if (imagePath.includes('supabase.co/storage/v1/object/public/')) {
      const urlParts = imagePath.split('/storage/v1/object/public/');
      if (urlParts.length > 1) {
        const pathParts = urlParts[1].split('/');
        bucket = pathParts[0];
        path = pathParts.slice(1).join('/');
      }
    } else if (imagePath.startsWith('http')) {
      // If it's a public URL, try to download it directly (with a timeout)
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);
      try {
        const response = await fetch(imagePath, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Failed to fetch image (${response.status})`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } finally {
        clearTimeout(t);
      }
    }

    // Supabase download (add a timeout so a hung download doesn't stall the whole worker)
    const timeoutMs = 60000;
    return await Promise.race([
      downloadImage(bucket, path),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Supabase image download timeout after ${timeoutMs}ms`)), timeoutMs)
      ),
    ]);
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    if (this.page) {
      await this.page.close();
    }
    if (this.context) {
      await this.context.close();
    }
  }
}

