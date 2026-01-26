# One-Time Fix for Stuck Import Items

## Run this in your browser console on profitorbit.io/import:

```javascript
// Clear all import caches to reset everything
localStorage.removeItem('profit_orbit_facebook_listings');
localStorage.removeItem('profit_orbit_mercari_listings');
console.log('✅ Cleared all import caches - refresh the page and click Sync');
```

After running this:
1. Refresh the Import page
2. Click "Sync" for each marketplace
3. All items will reappear as "not imported"

This clears the entire import cache, forcing a fresh sync from the marketplaces.
