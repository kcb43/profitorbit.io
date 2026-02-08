# How to Find Facebook's Sold Items GraphQL Query

## The Problem

We're currently using `MarketplaceYouSellingFastActiveSectionPaginationQuery` (doc_id: `6222877017763459`) which is designed for **active** listings. This query intentionally limits sold items to only ~10 recent ones.

To fetch historical sold items (90+ days back), we need to find the **correct GraphQL query** that Facebook uses for the "Sold" tab.

## Step-by-Step Instructions

### 1. Open Facebook Marketplace
Go to: https://www.facebook.com/marketplace/you/selling

### 2. Open Chrome DevTools
- Press `F12` or Right-click → Inspect
- Click on the **Network** tab
- In the filter box, type: `graphql`

### 3. Clear Network Log
- Click the 🚫 icon to clear existing requests

### 4. Click the "Sold" Tab
- In Facebook Marketplace, click on the **"Sold"** tab
- Watch the Network tab for new GraphQL requests

### 5. Find the GraphQL Request
Look for a request that:
- URL contains `/api/graphql/`
- Method is `POST`
- Happens right when you click "Sold"
- Returns sold items data

### 6. Inspect the Request
Click on the GraphQL request and look at:

**Request Payload (Form Data):**
```
doc_id: ????????????????  ← This is what we need!
fb_api_req_friendly_name: MarketplaceYouSelling_____Query
variables: {"count":50,"status":["OUT_OF_STOCK"],...}
```

### 7. What to Look For

The `fb_api_req_friendly_name` might be:
- `MarketplaceYouSellingSoldSectionPaginationQuery`
- `MarketplaceYouSellingHistorySectionQuery`
- `MarketplaceYouSellingCompletedItemsQuery`
- `MarketplaceSellerInventorySoldQuery`
- Something similar with "Sold", "History", "Completed", or "Inventory"

### 8. Extract the Information

Copy these values:
1. **doc_id**: The numeric ID (example: `7234567890123456`)
2. **fb_api_req_friendly_name**: The query name
3. **variables**: The full JSON object (to see what parameters it accepts)

### 9. Check Response
Click on the **Response** tab and verify:
- It returns more than 10 items
- It includes older sold items
- `page_info.has_next_page` is `true` (indicating pagination works)

## Example of What You're Looking For

```javascript
// Request Payload (what we need to find):
{
  "doc_id": "7234567890123456",  // ← NEW doc_id for sold items
  "fb_api_req_friendly_name": "MarketplaceYouSellingSoldSectionPaginationQuery",  // ← NEW query name
  "variables": {
    "count": 50,
    "cursor": null,
    "status": ["OUT_OF_STOCK"],
    "state": "SOLD",  // ← Might be different
    "order": "SOLD_TIME_DESC",  // ← Might be different
    ...
  },
  "fb_dtsg": "..."
}
```

## Alternative: Check Mobile App

Facebook's mobile app might use different queries. You can:
1. Use Charles Proxy or mitmproxy to intercept mobile app traffic
2. Open Marketplace → Sold tab in the app
3. Look for GraphQL requests
4. Mobile queries sometimes have better pagination for historical data

## Once You Find It

Share the following information:
1. **doc_id**: `________________`
2. **fb_api_req_friendly_name**: `________________`
3. **variables** (full JSON): 
```json
{
  ...
}
```

I'll update the code to use the correct query for sold items, which should give us access to all your historical sold listings (90+ days back).

## Why This Matters

- **Current query (Active)**: Only returns ~10 recent sold items
- **Correct query (Sold)**: Should return ALL sold items with proper pagination
- This is the same pattern Facebook uses internally - different queries for different tabs

## Quick Test

After finding the doc_id, you can test it manually:
1. Open browser console on Facebook
2. Paste this code (replace DOC_ID):
```javascript
fetch('https://www.facebook.com/api/graphql/', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    doc_id: 'YOUR_DOC_ID_HERE',
    variables: JSON.stringify({ count: 100, status: ['OUT_OF_STOCK'] }),
    fb_dtsg: document.querySelector('[name="fb_dtsg"]').value
  })
}).then(r => r.json()).then(d => console.log('Items:', d))
```

If it returns more than 10 items, you found the right query! 🎉
