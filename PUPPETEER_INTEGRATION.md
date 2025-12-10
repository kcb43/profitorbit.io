# Puppeteer Integration with Chrome Extension

This document explains how Puppeteer is integrated with the existing Chrome extension for Mercari crosslisting.

## Overview

The system uses a **hybrid approach**:
- **Chrome Extension** (fast, works for most fields) - Used when there are NO photos
- **Puppeteer API** (handles photo uploads) - Used when photos are present

## How It Works

### Flow Diagram

```
User clicks "List on Mercari"
    ↓
Extension checks: Does listing have photos?
    ↓
    ├─ NO PHOTOS → Use Extension Method (fast, fills form in browser)
    │
    └─ HAS PHOTOS → Call Puppeteer API (handles photo uploads)
                        ↓
                    Puppeteer opens browser
                    Fills all form fields
                    Uploads photos
                    Submits listing
                        ↓
                    Returns success/error
```

### 1. Extension Method (No Photos)

When there are **no photos**, the extension:
1. Navigates to Mercari sell page
2. Fills all form fields using DOM manipulation
3. Submits the form
4. **Note**: Photos cannot be uploaded via extension due to browser security

**Location**: `extension/content.js` → `createMercariListing()`

### 2. Puppeteer API Method (With Photos)

When there **are photos**, the extension:
1. Detects photos in listing data
2. Calls the Puppeteer API endpoint: `POST /api/mercari-puppeteer`
3. Puppeteer handles everything:
   - Opens browser
   - Fills all form fields
   - **Uploads photos** (this is why we use Puppeteer!)
   - Submits the form
4. Returns result to extension

**Location**: 
- Extension: `extension/content.js` → `createMercariListingWithPuppeteer()`
- API: `api/mercari-puppeteer.js`

## Setup Instructions

### 1. Install Puppeteer

```bash
npm install puppeteer
```

### 2. Configure API URL

The extension needs to know where your Puppeteer API is hosted. Set this in your environment:

**For local development:**
```javascript
// In extension/content.js, the API URL is determined by:
const apiUrl = process.env.VITE_API_URL || 
               window.location.origin.includes('localhost') 
                 ? 'http://localhost:3000' 
                 : 'https://your-api-domain.com';
```

**For production (Vercel):**
- Set `VITE_API_URL` environment variable to your Vercel deployment URL
- Or update the fallback URL in `extension/content.js`

### 3. Deploy Puppeteer API

The Puppeteer API is a Vercel serverless function at `api/mercari-puppeteer.js`.

**Important Notes for Vercel:**
- Puppeteer requires special configuration on Vercel
- You may need to use `@sparticuz/chromium` instead of full Puppeteer
- See Vercel's Puppeteer documentation for serverless functions

**Alternative: Local Server**
If Vercel doesn't work, you can run a local Express server:

```javascript
// server-puppeteer.js
const express = require('express');
const { createMercariListing } = require('./scripts/mercari-puppeteer.js');

const app = express();
app.use(express.json());

app.post('/api/mercari-puppeteer', async (req, res) => {
  try {
    const result = await createMercariListing(req.body.listingData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Puppeteer API running on http://localhost:3000');
});
```

## API Endpoint

### POST `/api/mercari-puppeteer`

**Request Body:**
```json
{
  "listingData": {
    "title": "Item Title",
    "description": "Item description",
    "price": "29.99",
    "condition": "Like New",
    "brand": "Nike",
    "category": "Women > Clothing > Tops",
    "size": "M",
    "color": "Black",
    "shipsFrom": "90210",
    "deliveryMethod": "prepaid",
    "smartOffers": false,
    "photos": [
      "https://example.com/photo1.jpg",
      "/path/to/photo2.jpg"
    ]
  }
}
```

**Response (Success):**
```json
{
  "success": true,
  "listingId": "m123456789",
  "listingUrl": "https://www.mercari.com/items/m123456789",
  "message": "Listing created successfully"
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": "Error message",
  "message": "Detailed error description"
}
```

## Photo Handling

### Photo Sources

The Puppeteer API accepts photos as:
1. **URLs** (https://example.com/photo.jpg) - Will be downloaded to temp files
2. **Local file paths** (/path/to/photo.jpg) - Used directly

### Photo Download

The API automatically downloads URLs to temporary files before uploading to Mercari. This happens in the `downloadPhotosIfNeeded()` function.

**Note**: On Vercel, temp files are stored in `/tmp` which has limited space. For large images, consider:
- Pre-processing images to reduce size
- Using a CDN or storage service
- Downloading images client-side before sending to API

## Testing

### Test Extension Method (No Photos)

1. Create a listing without photos
2. Click "List on Mercari"
3. Should use extension method (fast, no API call)

### Test Puppeteer Method (With Photos)

1. Create a listing with photos
2. Click "List on Mercari"
3. Should call Puppeteer API
4. Check browser console for API response

### Test Puppeteer API Directly

```bash
curl -X POST http://localhost:3000/api/mercari-puppeteer \
  -H "Content-Type: application/json" \
  -d '{
    "listingData": {
      "title": "Test Item",
      "price": "29.99",
      "photos": ["https://example.com/photo.jpg"]
    }
  }'
```

## Troubleshooting

### "Puppeteer not available" Error

- Make sure Puppeteer is installed: `npm install puppeteer`
- For Vercel, you may need `@sparticuz/chromium` instead
- Check that the API endpoint is deployed correctly

### Photos Not Uploading

- Verify photo URLs are accessible
- Check that file paths are correct
- Ensure temp directory has write permissions
- Check Puppeteer logs for upload errors

### API Not Found

- Verify API URL is correct in extension
- Check CORS settings on API endpoint
- Ensure API is deployed/running

### Form Not Submitting

- Check that all required fields are filled
- Verify Mercari hasn't changed their form structure
- Check browser console for errors
- Review Puppeteer logs

## Future Enhancements

1. **Hybrid Approach**: Use extension for form filling, Puppeteer only for photos
2. **Photo Pre-processing**: Compress/resize images before upload
3. **Retry Logic**: Automatic retry on failures
4. **Progress Updates**: Real-time status updates during automation
5. **Facebook Support**: Extend Puppeteer integration to Facebook Marketplace

## Security Considerations

- **API Authentication**: Add authentication to Puppeteer API endpoint
- **Rate Limiting**: Prevent abuse of Puppeteer API
- **Input Validation**: Validate all listing data before processing
- **Error Handling**: Don't expose sensitive errors to clients

## Performance

- **Extension Method**: ~5-10 seconds (no photos)
- **Puppeteer Method**: ~30-60 seconds (with photos, depending on image size)
- **Photo Download**: Adds ~2-5 seconds per photo

## Code Locations

- Extension integration: `extension/content.js`
- Puppeteer API: `api/mercari-puppeteer.js`
- Standalone script: `scripts/mercari-puppeteer.js`
- Setup docs: `scripts/PUPPETEER_SETUP.md`

