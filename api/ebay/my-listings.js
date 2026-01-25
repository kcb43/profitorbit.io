/**
 * Fetch user's eBay listings (for Import page)
 * Uses Trading API GetMyeBaySelling or GetSellerList
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user's eBay access token
async function getEbayAccessToken(userId) {
  const { data, error } = await supabase
    .from('ebay_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    throw new Error('eBay not connected. Please connect your eBay account first.');
  }

  // Check if token expired and refresh if needed
  const now = Date.now();
  if (data.expires_at && now >= new Date(data.expires_at).getTime()) {
    // Token expired, need to refresh
    const refreshResponse = await fetch('/api/ebay/refresh-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    
    if (!refreshResponse.ok) {
      throw new Error('Failed to refresh eBay token');
    }
    
    const refreshData = await refreshResponse.json();
    return refreshData.access_token;
  }

  return data.access_token;
}

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const status = req.query.status || 'Active'; // Active, Ended, All

    // Get eBay access token
    const accessToken = await getEbayAccessToken(userId);

    // Determine which eBay API environment to use
    const ebayEnv = process.env.EBAY_ENV || 'production';
    const apiUrl = ebayEnv === 'production' 
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    // Use Trading API GetSellerList
    // Note: This is XML-based Trading API, not REST
    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <DetailLevel>ReturnAll</DetailLevel>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <IncludeWatchCount>true</IncludeWatchCount>
  <OutputSelector>ItemID</OutputSelector>
  <OutputSelector>Title</OutputSelector>
  <OutputSelector>PictureDetails</OutputSelector>
  <OutputSelector>SellingStatus</OutputSelector>
  <OutputSelector>ListingDetails</OutputSelector>
  <OutputSelector>StartTime</OutputSelector>
</GetSellerListRequest>`;

    const response = await fetch(`${apiUrl}/ws/api.dll`, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetSellerList',
        'X-EBAY-API-APP-NAME': process.env.EBAY_CLIENT_ID || '',
      },
      body: xmlRequest,
    });

    if (!response.ok) {
      throw new Error(`eBay API error: ${response.status}`);
    }

    const xmlText = await response.text();
    
    // Parse XML response (simple parsing - you may want to use a proper XML parser)
    const items = parseEbayXML(xmlText);

    // Check which items are already imported
    const { data: importedItems } = await supabase
      .from('inventory_items')
      .select('ebay_item_id')
      .eq('user_id', userId)
      .not('ebay_item_id', 'is', null);

    const importedIds = new Set(importedItems?.map(item => item.ebay_item_id) || []);

    // Mark items as imported or not
    const listings = items.map(item => ({
      ...item,
      imported: importedIds.has(item.itemId),
    }));

    return res.status(200).json({
      listings,
      total: listings.length,
    });

  } catch (error) {
    console.error('Error fetching eBay listings:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch eBay listings' 
    });
  }
}

// Simple XML parser for eBay response
function parseEbayXML(xmlText) {
  const items = [];
  
  // Extract each Item block
  const itemMatches = xmlText.matchAll(/<Item>([\s\S]*?)<\/Item>/g);
  
  for (const match of itemMatches) {
    const itemXml = match[1];
    
    const itemId = extractValue(itemXml, 'ItemID');
    const title = extractValue(itemXml, 'Title');
    const price = extractValue(itemXml, 'CurrentPrice');
    const startTime = extractValue(itemXml, 'StartTime');
    
    // Extract first picture URL
    const pictureMatch = itemXml.match(/<PictureURL>(.*?)<\/PictureURL>/);
    const imageUrl = pictureMatch ? pictureMatch[1] : null;
    
    items.push({
      itemId,
      title,
      price: price ? parseFloat(price) : 0,
      startTime,
      imageUrl,
      pictureURLs: imageUrl ? [imageUrl] : [],
    });
  }
  
  return items;
}

function extractValue(xml, tagName) {
  const match = xml.match(new RegExp(`<${tagName}[^>]*>([^<]*)<\/${tagName}>`));
  return match ? match[1] : null;
}
