# Facebook Pagination Broken - Investigation

## Problem Discovered (Feb 8, 2026)

The Facebook GraphQL API response structure has changed. The `page_info` field is **completely missing** from the response.

### Evidence

From console logs:
```javascript
📄 Pagination info: {hasNextPage: false, endCursor: null, currentCursor: null, pageInfoFull: undefined}

🔍 FULL marketplace_listing_sets structure: {
  "edges": [
    ...10 items...
  ]
  // NO page_info field at all!
}
```

### Code Expectation

Our code expects:
```javascript
const pageInfo = data.viewer?.marketplace_listing_sets?.page_info;
const hasNextPage = pageInfo?.has_next_page || false;
const endCursor = pageInfo?.end_cursor || null;
```

But `page_info` doesn't exist in the response!

### Why This Happened

User reported: **"This worked like 3 days ago"**

Possible causes:
1. **Facebook API Change**: Facebook may have updated their GraphQL schema
2. **Doc ID Issue**: The doc_id `6222877017763459` may have been deprecated
3. **Query Structure Change**: The persisted query no longer includes `page_info` fields

### Attempted Solutions

1. **Tried doc_id 25467927229556480** - Requires Facebook internal parameters we don't have
2. **Tried doc_id 6222877017763459** - No `page_info` in response (current state)

### What We Need

From the user:
1. Go to `https://www.facebook.com/marketplace/you/selling`
2. Open DevTools → Network → Filter "graphql"
3. **Scroll down** on the page to trigger loading more items
4. Find the GraphQL request that loads next page
5. Check:
   - What `doc_id` is used?
   - What variables are sent?
   - Does the response include `page_info`?
   - What is the response structure for pagination?

### Temporary Workaround

Since pagination is broken, we can only fetch the first 10-50 items that Facebook returns by default. This affects:
- ❌ Available items: Only ~10 instead of all items
- ❌ Sold items: Only ~10 instead of historical sales

### Related Files

- `extension/facebook-api.js` - Line 262: `page_info` extraction
- `extension/background.js` - Line 2386-2416: Pagination loop (currently stops after 1 page)

### Next Steps

1. Get working curl from user's actual Facebook page scroll
2. Identify correct doc_id and response structure
3. Update code to match current API format
