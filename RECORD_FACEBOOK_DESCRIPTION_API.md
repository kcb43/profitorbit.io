# Recording Facebook API - Get Full Description

## What We Need

The current Facebook GraphQL API call (`doc_id: 6222877017763459`) doesn't include the full `description` field. We need to find the correct GraphQL query that includes:

- ✅ Full description text
- ✅ Category name
- ✅ Condition
- ✅ Brand (if available)
- ✅ Size (if available)

## Recording Instructions

### Step 1: Enable Facebook API Recorder

1. **Open profitorbit.io in Chrome**
2. **Open Console** (F12)
3. **Run this command**:
   ```javascript
   await window.ProfitOrbitExtension.startFacebookApiRecording()
   ```
4. You should see: `✅ Recording started`

### Step 2: Navigate Facebook Marketplace

Go to your Facebook Marketplace "Selling" page and perform these actions:

**Option A: View Your Listings**
1. Go to: https://www.facebook.com/marketplace/you/selling
2. Let the page fully load (wait for all listings to appear)
3. Scroll down to load more listings (if you have many)

**Option B: Click on Individual Listing** (Most likely to have description)
1. Go to: https://www.facebook.com/marketplace/you/selling
2. **Click on one of your listings** to open the detail view
3. This should trigger a GraphQL call that fetches the full listing data including description

**Option C: Edit a Listing** (Definitely has description)
1. Go to: https://www.facebook.com/marketplace/you/selling
2. Click "Edit" on one of your listings
3. This will load the full listing data for editing

### Step 3: Stop Recording

1. **Back in Console**, run:
   ```javascript
   const recording = await window.ProfitOrbitExtension.stopFacebookApiRecording()
   console.log('Recorded calls:', recording.records)
   ```

2. **Download the recording**:
   ```javascript
   await window.downloadFacebookApiRecording()
   ```

### Step 4: Share the Recording

Look for API calls that include `description` field. The most likely candidates are:

1. **MarketplaceListingQuery** - Individual listing detail
2. **MarketplaceComposerQuery** - Edit listing view
3. **MarketplaceYouSellingQuery** - Your listings with full details

Send me the downloaded JSON file and I'll extract the right query!

---

## Alternative: Manual Network Inspection

If the recorder doesn't work, you can manually inspect:

### Method 1: Chrome DevTools

1. Open Chrome DevTools (F12)
2. Go to **Network** tab
3. Filter by: `graphql`
4. Go to https://www.facebook.com/marketplace/you/selling
5. **Click on one of your listings** to open it
6. Look for GraphQL calls in Network tab
7. Find one that has `description` in the Response
8. Copy the **Request Payload** (especially `doc_id` and `variables`)

### Method 2: Compare with Vendoo

If you have Vendoo installed:

1. Use Vendoo to import Facebook listings
2. Open DevTools during the import
3. Look for their GraphQL calls
4. Compare their `doc_id` and `variables` with ours

---

## What I'm Looking For

In the GraphQL response, we need fields like:

```json
{
  "data": {
    "viewer": {
      "marketplace_listing_sets": {
        "edges": [{
          "node": {
            "first_listing": {
              "id": "...",
              "marketplace_listing_title": "...",
              "description": "FULL DESCRIPTION TEXT HERE", // ← This is what we need!
              "category": "...",
              "condition": "...",
              "brand": "...",
              "size": "..."
            }
          }
        }]
      }
    }
  }
}
```

Once you share the recording, I'll update `facebook-api.js` to use the correct query!
