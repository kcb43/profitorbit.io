/**
 * Facebook Marketplace listing processor
 */

import { BaseProcessor } from './base.js';
import { updateJobProgress, logJobEvent } from '../utils/db.js';

export class FacebookProcessor extends BaseProcessor {
  async uploadImages(imagePaths) {
    await updateJobProgress(this.job.id, {
      percent: 20,
      message: 'Uploading images to Facebook...',
    });

    // Navigate to create listing page if not already there
    if (!this.page.url().includes('marketplace/create')) {
      await this.page.goto('https://www.facebook.com/marketplace/create/item', {
        waitUntil: 'networkidle',
      });
    }

    // Wait for photo upload area
    const photoInput = await this.page.waitForSelector(
      'input[type="file"][accept*="image"]',
      { timeout: 15000 }
    ).catch(() => null);

    if (!photoInput) {
      // Try alternative selector
      const addPhotoButton = await this.page.$('div[aria-label*="photo" i], div[aria-label*="Photo" i]');
      if (addPhotoButton) {
        await addPhotoButton.click();
        await this.page.waitForTimeout(1000);
      }
    }

    // Download and upload each image
    const fileInputs = [];
    for (let i = 0; i < imagePaths.length; i++) {
      const imagePath = imagePaths[i];
      await logJobEvent(this.job.id, 'info', `Uploading image ${i + 1}/${imagePaths.length}`, { platform: 'facebook' });

      try {
        // Download image from Supabase Storage
        const imageBuffer = await this.downloadImageFromStorage(imagePath);

        // Find file input (Facebook may have multiple inputs)
        const fileInput = await this.page.$('input[type="file"][accept*="image"]');
        if (fileInput) {
          await fileInput.setInputFiles({
            name: `image-${i}.jpg`,
            mimeType: 'image/jpeg',
            buffer: imageBuffer,
          });

          // Wait for image to be processed
          await this.page.waitForTimeout(2000);

          // If there are more images, click add more
          if (i < imagePaths.length - 1) {
            const addMore = await this.page.$('div[aria-label*="Add" i], div[aria-label*="add" i]');
            if (addMore) {
              await addMore.click();
              await this.page.waitForTimeout(1000);
            }
          }
        }
      } catch (error) {
        console.error(`Error uploading image ${i + 1}:`, error);
        throw new Error(`Failed to upload image ${i + 1}: ${error.message}`);
      }
    }

    await logJobEvent(this.job.id, 'info', `Successfully uploaded ${imagePaths.length} images`, { platform: 'facebook' });
  }

  async fillForm(payload) {
    await updateJobProgress(this.job.id, {
      percent: 50,
      message: 'Filling listing form...',
    });

    // Fill title - Facebook uses a specific input
    const titleInput = await this.page.waitForSelector(
      'input[placeholder*="What are you selling" i], input[aria-label*="Title" i], input[aria-label*="title" i]',
      { timeout: 15000 }
    ).catch(() => null);

    if (titleInput) {
      await titleInput.fill(payload.title || '');
    }

    // Fill price
    const priceInput = await this.page.waitForSelector(
      'input[placeholder*="Price" i], input[aria-label*="Price" i], input[type="text"][value*="$"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (priceInput && payload.price) {
      const price = parseFloat(payload.price).toFixed(2);
      await priceInput.fill(price);
    }

    // Fill description
    const descInput = await this.page.waitForSelector(
      'textarea[placeholder*="Describe" i], textarea[aria-label*="Description" i], div[contenteditable="true"]',
      { timeout: 10000 }
    ).catch(() => null);

    if (descInput) {
      if (descInput.tagName === 'TEXTAREA') {
        await descInput.fill(payload.description || '');
      } else {
        // ContentEditable div
        await descInput.click();
        await descInput.fill(payload.description || '');
      }
    }

    // Select category if provided
    if (payload.category) {
      const categoryButton = await this.page.$('div[aria-label*="Category" i], button:has-text("Category")');
      if (categoryButton) {
        await categoryButton.click();
        await this.page.waitForTimeout(1000);
        const categoryOption = await this.page.$(`text="${payload.category}"`);
        if (categoryOption) {
          await categoryOption.click();
        }
      }
    }

    // Select condition if provided
    if (payload.condition) {
      const conditionButton = await this.page.$('div[aria-label*="Condition" i], button:has-text("Condition")');
      if (conditionButton) {
        await conditionButton.click();
        await this.page.waitForTimeout(1000);
        const conditionOption = await this.page.$(`text="${payload.condition}"`);
        if (conditionOption) {
          await conditionOption.click();
        }
      }
    }

    await logJobEvent(this.job.id, 'info', 'Form filled successfully', { platform: 'facebook' });
  }

  async submit() {
    await updateJobProgress(this.job.id, {
      percent: 80,
      message: 'Submitting listing...',
    });

    // Find and click publish button
    const publishButton = await this.page.waitForSelector(
      'div[aria-label*="Publish" i], button:has-text("Publish"), button:has-text("Next")',
      { timeout: 15000 }
    ).catch(() => null);

    if (!publishButton) {
      throw new Error('Could not find publish button on Facebook');
    }

    await publishButton.click();

    // Wait for confirmation or listing page
    await this.page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 }).catch(() => {
      // Navigation might not happen immediately
    });

    // Extract listing URL
    const currentUrl = this.page.url();
    if (currentUrl.includes('marketplace/item/')) {
      this.listingUrl = currentUrl;
    } else {
      // Try to find listing URL in page
      await this.page.waitForTimeout(3000);
      const listingLink = await this.page.$('a[href*="/marketplace/item/"]');
      if (listingLink) {
        this.listingUrl = await listingLink.getAttribute('href');
        if (!this.listingUrl.startsWith('http')) {
          this.listingUrl = `https://www.facebook.com${this.listingUrl}`;
        }
      }
    }

    await logJobEvent(this.job.id, 'info', 'Listing submitted successfully', { platform: 'facebook' });
  }
}

