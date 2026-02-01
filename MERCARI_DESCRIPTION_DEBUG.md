# Mercari Description Investigation Guide

## Problem
The `searchQuery` returns `description: ""` (empty string) but there ARE descriptions on the Mercari listing pages. We need to find where the description is stored.

## Investigation Steps

### Step 1: Run the Enhanced Logging

1. **Reload the extension** to get the updated `mercari-api.js` with enhanced logging
2. **Open Mercari.com** and navigate to your listings
3. **Import your Mercari listings** from Orben
4. **Check the console** for these new debug logs:
   ```
   🔍 ALL available fields in item: [...]
   🔍 Description field value: ...
   🔍 Possible description fields: [...]
   ```

### Step 2: Test Individual Item Query

If the search query doesn't have descriptions, we can fetch them individually using the `itemQuery`. Run this in the browser console:

```javascript
// Test fetching a single item's details
async function testItemDetails() {
  const { bearerToken, csrfToken } = await self.__mercariApi.getMercariAuth();
  
  // Replace with one of your actual item IDs (starts with 'm')
  const itemId = 'm85955812918'; // REPLACE THIS WITH YOUR ITEM ID
  
  const details = await self.__mercariApi.fetchMercariItemDetails(itemId, bearerToken, csrfToken);
  
  console.log('📋 Item details:', details);
}

testItemDetails();
```

This will:
1. Log ALL available fields in the item response
2. Show the full item data structure
3. Help us identify where the description is stored

### Step 3: Check Network Tab

1. Open Chrome DevTools → **Network** tab
2. Filter by **Fetch/XHR**
3. Navigate to one of your Mercari listings (click to view it)
4. Find the GraphQL request to `/v1/api`
5. Look at the **Response** tab to see what fields are returned
6. Search for your item description text in the response

### Step 4: Alternative - Check DOM Scraping

If the GraphQL API doesn't provide descriptions, we may need to scrape them from the DOM:

```javascript
// Test if we can scrape description from the listing page
async function testDomScraping() {
  // This assumes you're ON a Mercari listing page
  const descriptionSelectors = [
    '[data-testid="item-description"]',
    '.item-description',
    '.merItem__description',
    '[class*="description"]',
    '[class*="Description"]'
  ];
  
  for (const selector of descriptionSelectors) {
    const el = document.querySelector(selector);
    if (el) {
      console.log(`✅ Found description with selector: ${selector}`);
      console.log('📝 Description:', el.textContent);
      return;
    }
  }
  
  console.log('❌ Could not find description in DOM');
  
  // List all elements that might contain description
  const allElements = document.querySelectorAll('[class*="desc" i], [class*="text" i], [data-testid*="desc" i]');
  console.log('🔍 Possible description elements:', allElements);
}

testDomScraping();
```

## What to Report Back

Please run these tests and share:

1. **From Step 1**: What fields are available in the search results?
2. **From Step 2**: Does the `itemQuery` return a description? What fields does it have?
3. **From Step 3**: What does the network response show?
4. **From Step 4**: Can we find the description in the DOM? What selector works?

## Likely Solutions

Based on what we find:

### Solution A: itemQuery has description
- Fetch item details for each listing (slower but gets full data)
- Or: Only fetch descriptions on-demand when user views item

### Solution B: Description is in different field
- Update the code to use the correct field name

### Solution C: Need to scrape from DOM
- Add content script to scrape descriptions from listing pages
- Or: Show message that descriptions aren't available via API

## Quick Test Command

Copy/paste this into the browser console while on Mercari.com:

```javascript
(async () => {
  console.log('🧪 Starting Mercari Description Investigation...');
  
  // Test 1: Get your listings
  const listings = await self.__mercariApi.fetchMercariListings({ page: 1 });
  console.log('📦 Fetched listings:', listings);
  
  if (listings.success && listings.listings.length > 0) {
    const firstItem = listings.listings[0];
    console.log('🔍 First item:', firstItem);
    console.log('📝 Description from search:', firstItem.description);
    
    // Test 2: Fetch detailed info
    const { bearerToken, csrfToken } = await self.__mercariApi.getMercariAuth();
    const details = await self.__mercariApi.fetchMercariItemDetails(firstItem.itemId, bearerToken, csrfToken);
    console.log('🔎 Detailed item info:', details);
    console.log('📝 Description from itemQuery:', details?.description);
  }
})();
```

This will show us exactly what data is available and where the descriptions are!
