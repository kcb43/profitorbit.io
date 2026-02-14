# eBay API Debug Guide

## Current Status
- eBay API returning **500 Internal Server Error**
- App ID: `fa80841cfbd27ce6-PRD-a5dbfdb4c-1ca12db1`
- Environment: Production (PRD)

## Test Result
```bash
curl "https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=fa80841cfbd27ce6-PRD-a5dbfdb4c-1ca12db1&RESPONSE-DATA-FORMAT=JSON&keywords=Nintendo+Switch&paginationInput.entriesPerPage=3"

# Result: 500 Internal Server Error
```

## Possible Causes

### 1. **eBay App Status Issue**
The app might be:
- Suspended or disabled
- Missing required permissions
- Not approved for production use
- Rate limited

### 2. **Incorrect App ID Format**
The full production App ID should be:
- Format: `{ClientID}-{Environment}-{CertID}`
- Current: `fa80841cfbd27ce6-PRD-a5dbfdb4c-1ca12db1`

However, for the Finding API, you might only need the **Client ID** (first part):
- Try: `fa80841cfbd27ce6`

### 3. **API Endpoint Changed**
eBay has been migrating to new APIs. The Finding API (v1) might be deprecated.

## How to Fix

### Step 1: Check eBay Developer Portal
1. Go to: https://developer.ebay.com/my/keys
2. Check your app status:
   - Is it approved for production?
   - Is it suspended?
   - Does it have "Finding API" enabled?

### Step 2: Try Client ID Only
Update the search worker to use just the client ID:

```javascript
// Current (WRONG):
const appId = process.env.EBAY_APP_ID; // fa80841cfbd27ce6

// Should be (in URL):
SECURITY-APPNAME=fa80841cfbd27ce6  // WITHOUT -PRD suffix
```

### Step 3: Update Fly Secret
```bash
# Set the client ID only (no -PRD suffix)
fly secrets set EBAY_APP_ID="fa80841cfbd27ce6" -a orben-search-worker
```

### Step 4: Check API Endpoint
The Finding API endpoint should be:
```
https://svcs.ebay.com/services/search/FindingService/v1
```

### Step 5: Alternative - Use Browse API
If Finding API is deprecated, migrate to the Browse API:
```javascript
// Browse API endpoint (newer, requires OAuth)
https://api.ebay.com/buy/browse/v1/item_summary/search?q=Nintendo+Switch

// Requires OAuth token instead of App ID
```

## Quick Test Commands

### Test with Client ID only:
```powershell
$url = "https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findItemsByKeywords&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=fa80841cfbd27ce6&RESPONSE-DATA-FORMAT=JSON&keywords=Nintendo+Switch&paginationInput.entriesPerPage=3"
Invoke-RestMethod $url
```

### Check Fly secrets:
```bash
fly secrets list -a orben-search-worker
```

## Next Steps
1. Check eBay Developer Portal for app status
2. Try using Client ID only (without -PRD suffix)
3. If that fails, check if Finding API is still active
4. Consider migrating to Browse API (more modern)

## Notes
- The 500 error suggests the app ID is invalid or the API is having issues
- eBay's Finding API is older and might be phased out
- The Browse API is recommended for new integrations
