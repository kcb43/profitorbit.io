# Mercari Date Field - Root Cause Found

## The Problem
Mercari's `searchQuery` GraphQL API **does not return `created` or `updated` timestamp fields** in the search results.

From your console output:
```
Has startTime? null
Has created? undefined
Has updated? undefined
```

## Why The Code Assumes These Fields Exist
The code at `extension/mercari-api.js` lines 455-458 was written assuming Mercari's API would return these fields:
```javascript
startTime: item.created ? new Date(item.created * 1000).toISOString() : 
           item.updated ? new Date(item.updated * 1000).toISOString() : null,
```

But `item.created` and `item.updated` simply don't exist in the API response!

## Solution Options

### Option 1: Scrape Date from Item HTML Page (Slow but Reliable)
When you visit a Mercari item page (e.g., `https://www.mercari.com/us/item/m79893323132/`), the date IS displayed in the HTML.

We can:
1. For each item, fetch its HTML page
2. Extract the "Posted X days ago" or actual date from the page
3. Parse it into a date

**Pros:** Will definitely work
**Cons:** Requires 1 HTTP request per item (20 items = 20 requests), slower sync

### Option 2: Find Alternative Date Field in API
Maybe Mercari returns the date under a different field name that we haven't checked yet.

### Option 3: Skip Dates for Now
Simply accept that Mercari listings won't show dates on the import page.

## Recommended: Option 1 with Caching

I recommend implementing Option 1 but with smart caching:
- Only scrape date for items that don't have one cached
- Store dates in localStorage so we don't re-scrape on every sync
- Show a progress indicator during initial sync

## Next Step

Would you like me to:
1. **Implement Option 1** (scrape dates from HTML pages)
2. **Test Option 2** first (run TEST_MERCARI_FIELDS.js to see all available fields)
3. **Skip dates** and mark this as "not supported by Mercari API"

Let me know which approach you prefer!

## Date: February 1, 2026
