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
          domain: c.domain,
          path: c.path || '/',
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
        };

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
    }

    this.page = await this.context.newPage();

    // More generous defaults; many modern sites never reach "networkidle"
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
      // If it's a public URL, try to download it directly
      const response = await fetch(imagePath);
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    return await downloadImage(bucket, path);
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

