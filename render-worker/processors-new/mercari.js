/**
 * Mercari listing processor
 */

import { BaseProcessor } from './base.js';
import { updateJobProgress, logJobEvent } from '../utils/db.js';

export class MercariProcessor extends BaseProcessor {
  async uploadImages(imagePaths) {
    await updateJobProgress(this.job.id, {
      percent: 20,
      message: 'Uploading images to Mercari...',
    });

    // Navigate to sell page if not already there
    if (!this.page.url().includes('mercari.com/sell')) {
      await this.page.goto('https://www.mercari.com/sell/', {
        waitUntil: 'networkidle',
      });
    }

    // Wait for image upload area
    const uploadArea = await this.page.waitForSelector(
      'input[type="file"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (!uploadArea) {
      throw new Error('Could not find image upload area on Mercari');
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
        await this.page.waitForTimeout(2000);

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

    await logJobEvent(this.job.id, 'info', `Successfully uploaded ${imagePaths.length} images`, { platform: 'mercari' });
  }

  async fillForm(payload) {
    await updateJobProgress(this.job.id, {
      percent: 50,
      message: 'Filling listing form...',
    });

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

    // Find and click submit button
    const submitButton = await this.page.waitForSelector(
      'button:has-text("List"), button:has-text("出品"), button[type="submit"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (!submitButton) {
      throw new Error('Could not find submit button on Mercari');
    }

    await submitButton.click();

    // Wait for confirmation or listing page
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
      // Navigation might not happen, that's okay
    });

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

    await logJobEvent(this.job.id, 'info', 'Listing submitted successfully', { platform: 'mercari' });
  }
}

