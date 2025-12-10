# Puppeteer Setup for Mercari & Facebook Crosslisting

This guide will help you set up Puppeteer for automating Mercari (and later Facebook) crosslisting.

## Prerequisites

1. **Node.js** installed (v16 or higher recommended)
2. **npm** or **yarn** package manager

## Installation Steps

### 1. Install Puppeteer

Since you mentioned you already installed Puppeteer, verify it's in your `package.json`:

```bash
npm list puppeteer
```

If it's not installed, run:

```bash
npm install puppeteer
```

This will install Puppeteer and download Chromium automatically.

### 2. Verify Installation

Create a simple test file to verify Puppeteer works:

```bash
node scripts/mercari-puppeteer.js
```

Or create a simple test:

```javascript
// test-puppeteer.js
const puppeteer = require('puppeteer');

async function test() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.mercari.com');
  await page.waitForTimeout(3000);
  await browser.close();
}

test();
```

Run it:
```bash
node test-puppeteer.js
```

## Using the Mercari Puppeteer Script

### Basic Usage

Run with default test data:

```bash
node scripts/mercari-puppeteer.js
```

### With Custom Data

You can pass custom listing data via command line arguments:

```bash
node scripts/mercari-puppeteer.js --title "Nike Air Max" --price "89.99" --condition "Like New" --brand "Nike"
```

### Available Arguments

- `--title` - Item title
- `--description` - Item description
- `--price` - Item price (as string, e.g., "29.99")
- `--condition` - Condition (New, Like New, Good, Fair, Poor)
- `--brand` - Brand name
- `--category` - Category path (e.g., "Women > Clothing > Tops & Blouses")
- `--size` - Size
- `--color` - Color
- `--shipsFrom` - Zip code (e.g., "90210")
- `--deliveryMethod` - "prepaid" or "ship_on_own"
- `--smartOffers` - true or false
- `--photos` - Comma-separated file paths (e.g., "photo1.jpg,photo2.jpg")

### Example

```bash
node scripts/mercari-puppeteer.js \
  --title "Vintage Denim Jacket" \
  --price "45.00" \
  --condition "Good" \
  --brand "Levi's" \
  --category "Women > Clothing > Jackets & Coats" \
  --size "M" \
  --color "Blue" \
  --shipsFrom "10001" \
  --deliveryMethod "prepaid" \
  --smartOffers false
```

## Script Features

The `mercari-puppeteer.js` script includes:

1. **Form Field Filling**:
   - Title
   - Description
   - Category (multi-level selection)
   - Brand
   - Condition
   - Color
   - Size
   - Ships From (zip code)
   - Delivery Method
   - Price
   - Smart Offers toggle

2. **File Upload Support**:
   - Photo uploads via Puppeteer's `uploadFile()` method

3. **Error Handling**:
   - Comprehensive error messages
   - Fallback selectors for form fields
   - Detailed logging

4. **Browser Control**:
   - Runs in non-headless mode by default (you can see what's happening)
   - Keeps browser open for 30 seconds for review
   - Can be configured to auto-close

## Configuration

### Headless Mode

To run in headless mode (no browser window), edit `scripts/mercari-puppeteer.js`:

```javascript
const browser = await puppeteer.launch({
  headless: true, // Change to true
  // ...
});
```

### Auto-Close Browser

To automatically close the browser after completion, uncomment this line in the script:

```javascript
// await browser.close();
```

### Auto-Submit

To automatically submit the form (currently disabled for safety), uncomment this line:

```javascript
// await submitMercariForm(page);
```

## Integration with Your App

You can import and use the script as a module:

```javascript
const { createMercariListing } = require('./scripts/mercari-puppeteer.js');

const listingData = {
  title: "My Item",
  price: "29.99",
  // ... other fields
};

createMercariListing(listingData)
  .then(() => console.log('Success!'))
  .catch(err => console.error('Error:', err));
```

## Troubleshooting

### Puppeteer Not Found

If you get "Cannot find module 'puppeteer'", make sure you're in the project root and run:

```bash
npm install puppeteer
```

### Chromium Download Issues

If Chromium fails to download, you can set an environment variable:

```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm install puppeteer
```

Then install Chromium separately or use your system's Chrome:

```javascript
const browser = await puppeteer.launch({
  executablePath: '/path/to/chrome', // Point to your Chrome installation
  headless: false
});
```

### Selectors Not Working

Mercari may update their HTML structure. If selectors fail:

1. Open Mercari in Chrome DevTools
2. Inspect the form elements
3. Update selectors in `scripts/mercari-puppeteer.js`
4. Look for `data-testid` attributes (most reliable)

### Form Submission Issues

The script currently doesn't auto-submit for safety. To enable:

1. Uncomment the `submitMercariForm(page)` call
2. Make sure all required fields are filled
3. Test with a dummy listing first

## Next Steps: Facebook Marketplace

The script structure is designed to be extended for Facebook Marketplace. You can:

1. Create a similar function: `createFacebookListing()`
2. Reuse helper functions like `selectMercariDropdown()` (rename to generic)
3. Follow the same pattern for form filling

## Notes

- **Rate Limiting**: Be careful not to submit too many listings too quickly. Mercari may flag automated behavior.
- **Login**: This script assumes you're already logged into Mercari in the browser session. You may need to handle login separately.
- **Captcha**: Mercari may show CAPTCHA for automated actions. You may need to solve it manually.
- **Testing**: Always test with dummy data first before using real listings.

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all selectors are correct
3. Make sure you're logged into Mercari
4. Check that the form structure hasn't changed

