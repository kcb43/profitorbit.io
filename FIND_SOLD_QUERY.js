/**
 * Facebook GraphQL Query Discovery Script
 * 
 * INSTRUCTIONS:
 * 1. Open Facebook Marketplace: https://www.facebook.com/marketplace/you/selling
 * 2. Open Chrome DevTools (F12) → Network tab
 * 3. Filter by "graphql"
 * 4. Click on "Sold" tab in Facebook
 * 5. Look for GraphQL request with "Sold" or "History" in the name
 * 6. Find the doc_id in the request payload
 * 
 * We're looking for queries like:
 * - MarketplaceYouSellingSoldSectionQuery
 * - MarketplaceYouSellingHistorySectionQuery  
 * - MarketplaceYouSellingCompletedQuery
 * - MarketplaceSellerHubInventoryListViewerQuery
 * 
 * The doc_id will be different from 6222877017763459 (which is for Active items)
 */

// Current query (WRONG for sold items):
// doc_id: 6222877017763459
// name: MarketplaceYouSellingFastActiveSectionPaginationQuery
// Purpose: Fetches ACTIVE listings only

// Need to find (CORRECT for sold items):
// doc_id: ????????????????
// name: MarketplaceYouSelling[Sold/History]SectionQuery or similar
// Purpose: Fetches SOLD/HISTORICAL listings

console.log('📝 To find the correct GraphQL query for sold items:');
console.log('1. Go to https://www.facebook.com/marketplace/you/selling');
console.log('2. Open DevTools → Network tab → Filter "graphql"');
console.log('3. Click "Sold" tab');
console.log('4. Look for the GraphQL request that loads sold items');
console.log('5. Copy the doc_id and fb_api_req_friendly_name');
