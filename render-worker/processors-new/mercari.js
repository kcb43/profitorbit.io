/**
 * Mercari listing processor
 */

import { BaseProcessor } from './base.js';
import { updateJobProgress, logJobEvent } from '../utils-new/db.js';

export class MercariProcessor extends BaseProcessor {
  async checkCaptchaWall(label) {
    const captchaHints = [
      'text=/captcha/i',
      'text=/verify/i',
      'text=/robot/i',
      'text=/unusual traffic/i',
      'text=/just a moment/i',
      'text=/checking your browser/i',
      'text=/access denied/i',
      'iframe[src*="captcha"]',
      'iframe[src*="hcaptcha"]',
      'iframe[src*="recaptcha"]',
    ];
    for (const hint of captchaHints) {
      const count = await this.page.locator(hint).count().catch(() => 0);
      if (count > 0) {
        throw new Error(`Blocked by CAPTCHA / verification wall on Mercari (${label})`);
      }
    }
  }

  async uploadImages(imagePaths) {
    await updateJobProgress(this.job.id, {
      percent: 20,
      message: 'Uploading images to Mercari...',
    });

    // Navigate to sell page if not already there
    if (!this.page.url().includes('mercari.com/sell')) {
      // NOTE: `networkidle` often never happens on modern sites due to long-polling/analytics.
      // Use domcontentloaded + explicit waits instead.
      await this.page.goto('https://www.mercari.com/sell/', {
        waitUntil: 'domcontentloaded',
        timeout: 90000,
      });
    }

    await this.checkCaptchaWall('before upload');

    const ensureStillOnSell = async (label) => {
      const u = this.page.url();
      if (
        u.includes('/login') ||
        u.includes('/signin') ||
        u.includes('/authenticate') ||
        u.includes('/auth')
      ) {
        throw new Error(
          `Mercari session is not logged in (redirected to ${u}) (${label}). Reconnect Mercari in the extension and try again.`
        );
      }
    };

    // If we got redirected to login, cookies/session are not valid
    await ensureStillOnSell('after goto');

    // Mercari often hides the file input behind an "Add photos" UI.
    // Try to reveal it and then locate a usable input[type=file].
    const fileInputSelectors = [
      'input[type="file"]',
      'input[type="file"][accept*="image"]',
      'form input[type="file"]',
    ];

    const revealSelectors = [
      'button:has-text("Add photos")',
      'button:has-text("Add photo")',
      'button:has-text("Add")',
      'button:has-text("Upload")',
      'text=/add photos/i',
      'text=/upload/i',
      '[data-testid*="photo"]',
    ];

    let uploadArea = null;

    // Try a few rounds: check for file input, otherwise click "reveal" controls.
    for (let attempt = 1; attempt <= 4; attempt++) {
      await ensureStillOnSell(`attempt ${attempt}`);
      for (const sel of fileInputSelectors) {
        uploadArea = await this.page.waitForSelector(sel, { timeout: 5000 }).catch(() => null);
        if (uploadArea) break;
      }
      if (uploadArea) break;

      for (const rs of revealSelectors) {
        const loc = this.page.locator(rs).first();
        const visible = await loc.isVisible().catch(() => false);
        if (!visible) continue;
        await loc.click({ timeout: 5000 }).catch(() => {});
        await this.page.waitForTimeout(750);
        break;
      }
    }

    if (!uploadArea) {
      const url = this.page.url();
      const title = await this.page.title().catch(() => 'unknown');
      try {
        await this.page.screenshot({ path: `/tmp/mercari-no-upload-area-${this.job.id}.png`, fullPage: true });
        const html = await this.page.content().catch(() => '');
        await import('fs').then((fs) => {
          fs.writeFileSync(`/tmp/mercari-no-upload-area-${this.job.id}.html`, html);
        });
        console.log(`🧾 Saved /tmp/mercari-no-upload-area-${this.job.id}.png and .html`);
      } catch (e) {
        console.log('⚠️ Could not save Mercari debug artifacts:', e?.message || e);
      }
      throw new Error(`Could not find image upload area on Mercari (url=${url} title=${title})`);
    }

    // Download and upload each image
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      await logJobEvent(this.job.id, 'info', `Uploading image ${i + 1}/${imagePaths.length}`, { platform: 'mercari' });

      try {
        // Download image from Supabase Storage
        const imageBuffer = await this.downloadImageFromStorage(imagePath);

        // Upload file using Playwright's file input
        await this.page.setInputFiles('input[type="file"]', {
          name: `image-${i}.jpg`,
          mimeType: 'image/jpeg',
          buffer: imageBuffer,
        });

        // Wait for image to be processed (Mercari shows thumbnail)
        await this.page.waitForSelector(
          'img[src^="blob:"], img[src*="mercari"]',
          { timeout: 10000 }
        );

        // If there are more images, click add more button
        if (i < imagePaths.length - 1) {
          const addMoreButton = await this.page.$('button:has-text("Add more")');
          if (addMoreButton) {
            await addMoreButton.click();
            await this.page.waitForTimeout(1000);
          }
        }
      } catch (error) {
        console.error(`Error uploading image ${i + 1}:`, error);
        throw new Error(`Failed to upload image ${i + 1}: ${error.message}`);
      }
    }

    const uploadedImages = await this.page.$$eval(
      'img[src^="blob:"], img[src*="mercari"]',
      imgs => imgs.length
    );
    if (uploadedImages === 0) {
      throw new Error("Mercari did not register uploaded images");
    }

    await logJobEvent(this.job.id, 'info', `Successfully uploaded ${imagePaths.length} images`, { platform: 'mercari' });
  }

  async fillForm(payload) {
    await updateJobProgress(this.job.id, {
      percent: 50,
      message: 'Filling listing form...',
    });

    await this.checkCaptchaWall('before form fill');

    // Fill title
    const titleInput = await this.page.waitForSelector(
      'input[placeholder*="title" i], input[name*="title" i], textarea[placeholder*="title" i]',
      { timeout: 10000 }
    ).catch(() => null);

    if (titleInput) {
      await titleInput.fill(payload.title || '');
    }

    // Fill description
    const descInput = await this.page.waitForSelector(
      'textarea[placeholder*="description" i], textarea[name*="description" i]',
      { timeout: 10000 }
    ).catch(() => null);

    if (descInput) {
      await descInput.fill(payload.description || '');
    }

    // Fill price
    const priceInput = await this.page.waitForSelector(
      'input[placeholder*="price" i], input[name*="price" i], input[type="number"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (priceInput && payload.price) {
      const price = parseFloat(payload.price).toFixed(0);
      await priceInput.fill(price);
    }

    // Fill category if provided
    if (payload.category) {
      const categoryButton = await this.page.$('button:has-text("Category"), button:has-text("カテゴリー")');
      if (categoryButton) {
        await categoryButton.click();
        await this.page.waitForTimeout(1000);
        // Select category (this will need to be customized based on Mercari's UI)
        const categoryOption = await this.page.$(`text="${payload.category}"`);
        if (categoryOption) {
          await categoryOption.click();
        }
      }
    }

    // Fill condition if provided
    if (payload.condition) {
      const conditionSelect = await this.page.$('select[name*="condition" i], select[id*="condition" i]');
      if (conditionSelect) {
        await conditionSelect.selectOption({ label: payload.condition });
      }
    }

    await logJobEvent(this.job.id, 'info', 'Form filled successfully', { platform: 'mercari' });
  }

  async submit() {
    await updateJobProgress(this.job.id, {
      percent: 80,
      message: 'Submitting listing...',
    });

    await this.checkCaptchaWall('before submit');

    // Prefer the actual form submit button inside the sell form
    const submitButton = this.page.locator('form button[type="submit"]').first();

    // Wait for it to exist + be visible
    await submitButton.waitFor({ state: 'visible', timeout: 15000 });

    // If it's disabled, Mercari is blocking submit due to missing fields
    const disabled = await submitButton.isDisabled().catch(() => false);
    if (disabled) {
      const requiredMissing = await this.page.evaluate(() => {
        const invalid = Array.from(document.querySelectorAll(':invalid'));
        return invalid.map(el => ({
          name: el.getAttribute('name'),
          id: el.id,
          aria: el.getAttribute('aria-label'),
          placeholder: el.getAttribute('placeholder'),
          tag: el.tagName,
          type: el.getAttribute('type'),
        }));
      }).catch(() => []);
      console.log("🚨 Submit disabled; invalid fields:", requiredMissing);
      throw new Error("Submit button is disabled (Mercari still missing required fields).");
    }

    // Wait for actual create-listing POST
    const createReqPromise = this.page.waitForResponse((resp) => {
      const url = resp.url();
      const status = resp.status();
      return (
        resp.request().method() === "POST" &&
        status >= 200 && status < 500 &&
        (url.includes("/api/") || url.includes("/sell") || url.includes("/listings") || url.includes("/items"))
      );
    }, { timeout: 20000 }).catch(() => null);

    await submitButton.scrollIntoViewIfNeeded();
    await submitButton.click({ delay: 50 });

    // Post-submit forensic dump and checks
    await this.page.waitForTimeout(2000);
    console.log("🌐 After submit URL:", this.page.url());
    console.log("🧠 After submit title:", await this.page.title().catch(() => "no title"));

    try {
      await this.page.screenshot({ path: `/tmp/mercari-after-submit.png`, fullPage: true });
      require('fs').writeFileSync(`/tmp/mercari-after-submit.html`, await this.page.content());
      console.log("🧾 Saved /tmp/mercari-after-submit.png and .html");
    } catch (e) {
      console.log("⚠️ Could not save forensic artifacts:", e?.message || e);
    }

    // Blocker check after submit
    await this.checkCaptchaWall('after submit');
    const blockers = [
      "text=/captcha/i",
      "text=/verify/i",
      "text=/unusual/i",
      "text=/robot/i",
      "text=/sign in/i",
      "text=/log in/i",
      "iframe[src*='captcha']",
      "iframe[src*='recaptcha']",
      "iframe[src*='hcaptcha']",
    ];
    for (const b of blockers) {
      const found = await this.page.locator(b).count().catch(() => 0);
      if (found > 0) {
        throw new Error(`Mercari blocker detected: ${b} (not able to proceed)`);
      }
    }

    // Inline validation errors
    const errLocators = [
      "[role='alert']",
      "[data-testid*='error']",
      ".error",
      "text=/required/i",
      "text=/please enter/i",
      "text=/invalid/i",
    ];
    let anyErr = false;
    for (const sel of errLocators) {
      const count = await this.page.locator(sel).count().catch(() => 0);
      if (count > 0) {
        anyErr = true;
        const txt = await this.page.locator(sel).first().innerText().catch(() => "");
        console.log("🚨 Mercari error found:", sel, "=>", txt.slice(0, 300));
      }
    }
    if (anyErr) {
      throw new Error("Mercari form validation errors present after submit (see logs)");
    }

    // If Mercari shows a loading overlay, wait for it to finish
    await this.page.locator('[aria-busy="true"], .loading, .spinner').first()
      .waitFor({ state: 'detached', timeout: 20000 })
      .catch(() => {});

    // Require success: navigation or success message or listing URL pattern
    const startUrl = this.page.url();
    await Promise.race([
      this.page.waitForURL(/\/items\/|\/listing\/|\/sell\/complete|\/sell\/success/i, { timeout: 30000 }),
      this.page.waitForSelector('a[href*="/items/"]', { timeout: 30000 }),
      this.page.waitForSelector('text=/Your listing|Listed|Success|出品が完了/i', { timeout: 30000 }),
    ]).catch(() => {});

    if (this.page.url() === startUrl) {
      throw new Error("Submit did not navigate or show success; listing likely not created.");
    }

    // Extract listing URL from current page
    const currentUrl = this.page.url();
    if (currentUrl.includes('mercari.com/items/')) {
      this.listingUrl = currentUrl;
    } else {
      // Try to find listing URL in page
      const listingLink = await this.page.$('a[href*="/items/"]');
      if (listingLink) {
        this.listingUrl = await listingLink.getAttribute('href');
        if (!this.listingUrl.startsWith('http')) {
          this.listingUrl = `https://www.mercari.com${this.listingUrl}`;
        }
      }
    }

    // Open listing in a new tab for confirmation
    if (this.listingUrl && this.context) {
      try {
        const viewPage = await this.context.newPage();
        await viewPage.goto(this.listingUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await logJobEvent(this.job.id, 'info', 'Opened listing in new tab', {
          platform: 'mercari',
          listingUrl: this.listingUrl,
        });
      } catch (err) {
        await logJobEvent(this.job.id, 'warn', 'Failed to open listing tab', {
          platform: 'mercari',
          listingUrl: this.listingUrl,
          error: err?.message,
        });
      }
    }

    await logJobEvent(this.job.id, 'info', 'Listing submitted successfully', { platform: 'mercari' });
  }
}

