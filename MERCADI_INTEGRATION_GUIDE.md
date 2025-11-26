# Mercari Integration Guide - How Vendoo Does It (And How You Can Too)

## Overview

Mercari **does NOT offer a public API** for third-party integrations. However, platforms like Vendoo have found ways to integrate by using **browser automation** and **web scraping** techniques.

---

## How Vendoo Likely Does It (Based on Network Analysis)

Based on the network requests you found, here's what's happening:

### 1. **Browser Automation Backend**
Vendoo likely uses a backend service that:
- Runs **headless browsers** (Puppeteer, Playwright, or Selenium)
- Automates the Mercari website like a real user would
- Interacts with Mercari's web interface programmatically

### 2. **Session Management via Firestore**
The Firestore requests you saw suggest:
- Vendoo stores user **sessions/authentication cookies** in Firestore
- When a user wants to list on Mercari, Vendoo's backend:
  1. Retrieves the user's Mercari session from Firestore
  2. Launches a headless browser
  3. Logs into Mercari using stored credentials/session
  4. Automates the listing creation process
  5. Returns results to the frontend

### 3. **Tracking/Analytics**
The `https://data.j.vendoo.co/api/s/track` endpoint:
- Tracks user actions (listing attempts, success/failure)
- Monitors automation performance
- Collects analytics data

---

## Technical Implementation Options

### Option 1: Browser Automation Service (Recommended)

Use a service that handles browser automation for you:

#### **Browserless.io** ⭐ Recommended
- **Cost:** ~$0.01-0.02 per automation session
- **Features:** Managed Puppeteer/Playwright service
- **Pros:** 
  - No infrastructure to manage
  - Scales automatically
  - Handles browser updates
  - Built-in proxy support

#### **Puppeteer/Playwright on Vercel/Serverless**
- **Cost:** Serverless function costs only
- **Features:** Full control over automation
- **Pros:** 
  - Customizable
  - No per-request fees
- **Cons:** 
  - Complex setup
  - Cold start delays
  - Harder to manage sessions

### Option 2: Browser Automation Library

Use a library directly in your backend:

#### **Puppeteer** (Chrome/Chromium)
```javascript
const puppeteer = require('puppeteer');

async function listOnMercari(listingData, userSession) {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  // Set user session cookies
  await page.setCookie(...userSession.cookies);
  
  // Navigate to Mercari listing page
  await page.goto('https://www.mercari.com/sell/');
  
  // Fill out form fields
  await page.type('#title', listingData.title);
  await page.type('#description', listingData.description);
  await page.type('#price', listingData.price);
  
  // Upload photos
  for (const photo of listingData.photos) {
    await page.click('#photo-upload');
    await page.uploadFile(photo);
  }
  
  // Submit listing
  await page.click('#submit-button');
  await page.waitForNavigation();
  
  // Extract listing ID from success page
  const listingId = await page.evaluate(() => {
    return document.querySelector('.listing-id').textContent;
  });
  
  await browser.close();
  return listingId;
}
```

#### **Playwright** (Multi-browser support)
```javascript
const { chromium } = require('playwright');

async function listOnMercari(listingData, userSession) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  
  // Set cookies for authentication
  await context.addCookies(userSession.cookies);
  
  const page = await context.newPage();
  await page.goto('https://www.mercari.com/sell/');
  
  // Similar automation steps...
  
  await browser.close();
}
```

---

## Architecture for Your Implementation

### Recommended Setup

```
┌─────────────┐
│  Frontend   │ User clicks "List on Mercari"
│  (React)    │─────────────────────────────────┐
└─────────────┘                                 │
                                               │
┌──────────────────────────────────────────────┘
│
│  API Endpoint
│  /api/mercari/listing
│  └─ Receives listing data
│  └─ Retrieves user session from database
│  └─ Calls browser automation service
│
└─────────────────┐
                  │
┌─────────────────▼──────────────────┐
│  Browser Automation Service        │
│  (Puppeteer/Playwright)            │
│  └─ Launches headless browser      │
│  └─ Navigates to Mercari           │
│  └─ Logs in with user session      │
│  └─ Fills listing form             │
│  └─ Submits listing                │
│  └─ Returns listing ID             │
└─────────────────┬──────────────────┘
                  │
┌─────────────────▼──────────────────┐
│  Mercari Website                   │
│  (https://www.mercari.com)         │
└────────────────────────────────────┘
```

---

## Step-by-Step Implementation

### Step 1: Create API Endpoint

Create `/api/mercari/listing.js`:

```javascript
// api/mercari/listing.js
export default async function handler(req, res) {
  const { listingData, userToken } = req.body;
  
  // Validate request
  if (!listingData || !userToken) {
    return res.status(400).json({ error: 'Missing required data' });
  }
  
  // Get user's Mercari session from database
  const userSession = await getUserMercariSession(userToken);
  
  if (!userSession) {
    return res.status(401).json({ error: 'Mercari account not connected' });
  }
  
  // Call browser automation service
  try {
    const result = await automateMercariListing(listingData, userSession);
    return res.status(200).json({ success: true, listingId: result.listingId });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
```

### Step 2: Create Browser Automation Function

```javascript
// lib/mercari-automation.js
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium'); // For AWS Lambda/Vercel

export async function automateMercariListing(listingData, userSession) {
  let browser;
  
  try {
    // Launch browser (use puppeteer-core for serverless)
    browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    
    // Restore session cookies
    if (userSession.cookies) {
      await page.setCookie(...userSession.cookies);
    }
    
    // Navigate to Mercari login (if needed) or listing page
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
    });
    
    // Check if logged in (look for user menu or login button)
    const isLoggedIn = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="user-menu"]');
    });
    
    if (!isLoggedIn && userSession.email && userSession.password) {
      // Perform login
      await performLogin(page, userSession.email, userSession.password);
      
      // Save new cookies for future use
      const newCookies = await page.cookies();
      await updateUserSession(userSession.userId, { cookies: newCookies });
    }
    
    // Navigate to listing creation page
    await page.goto('https://www.mercari.com/sell/', {
      waitUntil: 'networkidle2',
    });
    
    // Fill out listing form
    await page.waitForSelector('#item-name', { timeout: 10000 });
    await page.type('#item-name', listingData.title);
    
    await page.type('#item-description', listingData.description);
    
    await page.type('#price', listingData.price.toString());
    
    // Select category (if needed)
    if (listingData.category) {
      await page.click('#category-selector');
      await page.waitForSelector('.category-option');
      await page.click(`[data-category="${listingData.category}"]`);
    }
    
    // Upload photos
    if (listingData.photos && listingData.photos.length > 0) {
      const fileInput = await page.$('#file-upload');
      if (fileInput) {
        // Convert image URLs to files or base64
        for (const photoUrl of listingData.photos.slice(0, 10)) { // Mercari limit
          // Download and convert image
          const imageBuffer = await downloadImage(photoUrl);
          await fileInput.uploadFile(imageBuffer);
        }
      }
    }
    
    // Select condition
    if (listingData.condition) {
      await page.select('#condition', listingData.condition);
    }
    
    // Select shipping
    if (listingData.shipping) {
      await page.select('#shipping-method', listingData.shipping);
    }
    
    // Submit listing
    await page.click('#sell-button');
    
    // Wait for success page
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract listing ID from URL or page
    const listingId = await page.evaluate(() => {
      // Mercari URL format: https://www.mercari.com/us/item/m12345678901/
      const urlMatch = window.location.href.match(/\/item\/([a-z0-9]+)/);
      return urlMatch ? urlMatch[1] : null;
    });
    
    if (!listingId) {
      throw new Error('Failed to get listing ID after submission');
    }
    
    return { listingId, success: true };
    
  } catch (error) {
    console.error('Mercari automation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function performLogin(page, email, password) {
  await page.goto('https://www.mercari.com/login/');
  await page.waitForSelector('#email', { timeout: 10000 });
  
  await page.type('#email', email);
  await page.type('#password', password);
  
  await page.click('#login-button');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Check for login errors
  const hasError = await page.evaluate(() => {
    return !!document.querySelector('.error-message');
  });
  
  if (hasError) {
    throw new Error('Login failed - invalid credentials');
  }
}
```

### Step 3: Session Management

Store user sessions securely:

```javascript
// lib/mercari-session.js
import { base44 } from '@/api/base44Client';

export async function saveMercariSession(userId, sessionData) {
  // Store in your database (Base44, Supabase, etc.)
  // Include: cookies, email (encrypted), lastActivity
  
  await base44.entities.User.update(userId, {
    mercari_session: {
      cookies: sessionData.cookies,
      email: encrypt(sessionData.email), // Encrypt sensitive data
      lastActivity: new Date().toISOString(),
    },
  });
}

export async function getMercariSession(userId) {
  const user = await base44.entities.User.get(userId);
  return user.mercari_session || null;
}

export async function refreshMercariSession(userId, cookies) {
  await base44.entities.User.update(userId, {
    'mercari_session.cookies': cookies,
    'mercari_session.lastActivity': new Date().toISOString(),
  });
}
```

---

## Important Considerations

### ⚠️ Legal & Terms of Service

1. **Mercari's ToS:**
   - Likely prohibits automation/scraping
   - Could result in account bans
   - Use at your own risk

2. **Mitigation Strategies:**
   - Add user disclaimer: "By using this feature, you acknowledge the risks..."
   - Make it opt-in only
   - Don't over-automate (add delays between actions)
   - Respect rate limits
   - Use real browser fingerprints (avoid detection)

### 🔒 Security

1. **Store Credentials Securely:**
   - Encrypt passwords/email
   - Never log sensitive data
   - Use environment variables for API keys

2. **Session Management:**
   - Store cookies securely
   - Refresh sessions regularly
   - Handle session expiration gracefully

### ⚡ Performance

1. **Optimization:**
   - Use headless browsers (faster)
   - Cache sessions
   - Run automation in background (don't block user)
   - Use queues for batch operations

2. **Cost Management:**
   - Browser automation is resource-intensive
   - Consider using services like Browserless.io
   - Monitor costs closely

---

## Alternative: Using Browserless.io Service

Instead of running your own automation, use a managed service:

```javascript
// api/mercari/listing.js
import Browserless from 'browserless';

const browserless = new Browserless({
  token: process.env.BROWSERLESS_TOKEN,
});

export default async function handler(req, res) {
  const { listingData, userSession } = req.body;
  
  const result = await browserless.launch(async (page) => {
    // Same automation code as above
    await page.goto('https://www.mercari.com/sell/');
    // ... automation steps
  });
  
  return res.json({ success: true, listingId: result.listingId });
}
```

**Benefits:**
- No infrastructure to manage
- Scales automatically
- Handles browser updates
- Built-in proxy support
- Cost: ~$0.01-0.02 per automation

---

## Cost Estimates

### Option 1: Self-Hosted (Puppeteer/Playwright)
- **Infrastructure:** $20-100/month (Vercel serverless or VPS)
- **Per listing:** ~$0.001-0.01 (serverless costs)
- **Best for:** High volume, cost-sensitive

### Option 2: Browserless.io
- **Base cost:** $0-100/month (depending on plan)
- **Per listing:** ~$0.01-0.02
- **Best for:** Low volume, ease of use

### Option 3: Custom VPS
- **Base cost:** $20-50/month
- **Per listing:** ~$0.0001 (basically free after infrastructure)
- **Best for:** High volume, technical expertise

---

## Recommended Approach for ProfitPulse

### Phase 1: Proof of Concept
1. Set up Browserless.io account
2. Create basic automation script
3. Test with one listing
4. Handle errors gracefully

### Phase 2: Full Integration
1. Add Mercari login flow
2. Store user sessions securely
3. Implement listing creation
4. Add error handling/retries

### Phase 3: Optimization
1. Add session refresh logic
2. Implement rate limiting
3. Add monitoring/analytics
4. Optimize costs

---

## Example Frontend Integration

```javascript
// src/pages/CrosslistComposer.jsx

const handleListOnMercari = async () => {
  try {
    setIsSaving(true);
    
    // Prepare listing data
    const listingData = {
      title: mercariForm.title || generalForm.title,
      description: mercariForm.description || generalForm.description,
      price: mercariForm.price || generalForm.price,
      photos: generalForm.photos || [],
      condition: mapConditionToMercari(generalForm.condition),
      shipping: mercariForm.shippingMethod,
      category: mercariForm.category,
    };
    
    // Call your API endpoint
    const response = await fetch('/api/mercari/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listingData,
        userToken: userToken, // Your auth token
      }),
    });
    
    const result = await response.json();
    
    if (result.success) {
      toast({
        title: "Listed on Mercari!",
        description: `Listing ID: ${result.listingId}`,
      });
      
      // Store listing ID
      setMercariListingId(result.listingId);
    }
  } catch (error) {
    toast({
      title: "Failed to list on Mercari",
      description: error.message,
      variant: "destructive",
    });
  } finally {
    setIsSaving(false);
  }
};
```

---

## Next Steps

1. **Research Mercari's Current Interface:**
   - Inspect the listing form HTML/CSS selectors
   - Test manual listing creation
   - Identify all form fields

2. **Set Up Development Environment:**
   - Install Puppeteer/Playwright
   - Create test account
   - Build proof of concept

3. **Implement Safely:**
   - Add user disclaimers
   - Make it opt-in
   - Handle errors gracefully
   - Monitor for account issues

---

## Summary

Vendoo connects to Mercari by:
1. Using **browser automation** (Puppeteer/Playwright)
2. Storing user **sessions in Firestore**
3. Running automation on **backend servers**
4. Tracking actions via **analytics endpoints**

You can do the same by:
- Building a serverless function with Puppeteer/Playwright
- OR using a service like Browserless.io
- Storing user sessions securely
- Automating the listing creation process

**Remember:** This approach likely violates Mercari's ToS, so proceed with caution and clear user disclaimers.

---

## Last Updated
**Date:** 2025-01-27  
**Version:** 1.0

