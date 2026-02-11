/**
 * eBay Analytics API - Traffic Report
 * Fetches view counts and traffic metrics for eBay listings
 * 
 * API Docs: https://developer.ebay.com/api-docs/sell/analytics/resources/traffic_report/methods/getTrafficReport
 */

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { listingIds, marketplaceId = 'EBAY_US', dateRange } = req.query;

  if (!listingIds) {
    return res.status(400).json({ error: 'listingIds parameter is required' });
  }

  try {
    // Get eBay access token from request headers or query
    const authHeader = req.headers.authorization;
    let accessToken = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      accessToken = authHeader.substring(7);
    } else if (req.query.token) {
      accessToken = req.query.token;
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'eBay access token required' });
    }

    // Parse listing IDs (can be comma-separated or pipe-separated)
    const listingIdsArray = listingIds.split(/[,|]/).map(id => id.trim()).filter(Boolean);
    
    if (listingIdsArray.length === 0) {
      return res.status(400).json({ error: 'At least one listing ID is required' });
    }

    if (listingIdsArray.length > 200) {
      return res.status(400).json({ error: 'Maximum 200 listing IDs allowed per request' });
    }

    // Calculate date range (default to last 90 days)
    let startDate, endDate;
    if (dateRange) {
      const [start, end] = dateRange.split('..');
      startDate = start;
      endDate = end;
    } else {
      // Default: last 90 days
      const now = new Date();
      const ninetyDaysAgo = new Date(now.getTime() - (90 * 24 * 60 * 60 * 1000));
      
      endDate = formatDate(now);
      startDate = formatDate(ninetyDaysAgo);
    }

    console.log(`📊 Fetching traffic report for ${listingIdsArray.length} listings...`);
    console.log(`📅 Date range: ${startDate} to ${endDate}`);

    // Build filter parameter
    const listingIdsFilter = `{${listingIdsArray.join('|')}}`;
    const filter = `marketplace_ids:{${marketplaceId}},date_range:[${startDate}..${endDate}],listing_ids:${listingIdsFilter}`;

    // Build the API request URL
    const baseUrl = 'https://api.ebay.com/sell/analytics/v1/traffic_report';
    const params = new URLSearchParams({
      dimension: 'LISTING',
      metric: 'LISTING_VIEWS_TOTAL,LISTING_IMPRESSION_TOTAL,LISTING_VIEWS_SOURCE_DIRECT,LISTING_VIEWS_SOURCE_SEARCH_RESULTS_PAGE',
      filter: filter,
    });

    const url = `${baseUrl}?${params.toString()}`;
    
    console.log(`🌐 API URL: ${url}`);

    // Make request to eBay Analytics API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ eBay Analytics API error (${response.status}):`, errorText);
      
      // Handle specific error cases
      if (response.status === 401) {
        return res.status(401).json({ error: 'Invalid or expired eBay token' });
      } else if (response.status === 403) {
        return res.status(403).json({ error: 'Analytics API access not authorized for this eBay account' });
      }
      
      return res.status(response.status).json({ 
        error: 'eBay Analytics API request failed',
        details: errorText 
      });
    }

    const data = await response.json();
    
    console.log(`✅ Received traffic report with ${data.records?.length || 0} records`);

    // Parse and transform the response into a simpler format
    const viewCounts = {};
    
    if (data.records && Array.isArray(data.records)) {
      for (const record of data.records) {
        // Get listing ID from dimensionValues
        const listingId = record.dimensionValues?.[0]?.value;
        
        if (listingId) {
          // Extract metrics
          const metrics = {};
          const metricKeys = data.header?.metrics || [];
          
          record.metricValues?.forEach((metricValue, index) => {
            const metricKey = metricKeys[index]?.key;
            if (metricKey && metricValue.applicable) {
              metrics[metricKey] = metricValue.value || 0;
            }
          });

          viewCounts[listingId] = {
            listingId,
            totalViews: metrics.LISTING_VIEWS_TOTAL || 0,
            totalImpressions: metrics.LISTING_IMPRESSION_TOTAL || 0,
            directViews: metrics.LISTING_VIEWS_SOURCE_DIRECT || 0,
            searchViews: metrics.LISTING_VIEWS_SOURCE_SEARCH_RESULTS_PAGE || 0,
          };
        }
      }
    }

    // For listings with no data, set view count to 0
    listingIdsArray.forEach(listingId => {
      if (!viewCounts[listingId]) {
        viewCounts[listingId] = {
          listingId,
          totalViews: 0,
          totalImpressions: 0,
          directViews: 0,
          searchViews: 0,
        };
      }
    });

    console.log(`📈 View counts summary:`, {
      totalListings: Object.keys(viewCounts).length,
      listingsWithViews: Object.values(viewCounts).filter(v => v.totalViews > 0).length,
    });

    return res.status(200).json({
      success: true,
      startDate: data.startDate,
      endDate: data.endDate,
      lastUpdatedDate: data.lastUpdatedDate,
      viewCounts,
      summary: {
        totalListings: Object.keys(viewCounts).length,
        totalViews: Object.values(viewCounts).reduce((sum, v) => sum + v.totalViews, 0),
        totalImpressions: Object.values(viewCounts).reduce((sum, v) => sum + v.totalImpressions, 0),
      },
    });

  } catch (error) {
    console.error('Error fetching eBay traffic report:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch traffic report',
      details: error.message 
    });
  }
}

/**
 * Format date as YYYYMMDD for eBay API
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}
