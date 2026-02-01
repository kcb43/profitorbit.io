/**
 * Fetch user's eBay listings (for Import page)
 * Uses eBay Sell API (Inventory + Browse)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get user ID from request
function getUserId(req) {
  return req.headers['x-user-id'] || null;
}

// Helper to get eBay token from request headers
function getEbayToken(req) {
  return req.headers['x-user-token'] || null;
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-user-id, x-user-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    console.log('🔍 API: getUserId result:', userId);
    
    if (!userId) {
      console.error('❌ API: No user ID in headers');
      return res.status(401).json({ error: 'Unauthorized - User ID missing' });
    }

    const accessToken = getEbayToken(req);
    console.log('🔍 API: getEbayToken result:', accessToken ? 'token present' : 'NO TOKEN');
    
    if (!accessToken) {
      console.error('❌ API: No eBay token in headers');
      return res.status(401).json({ error: 'eBay not connected. Please connect your eBay account first.' });
    }

    const status = req.query.status || 'Active'; // Active, Ended, All
    const limit = req.query.limit || '200';

    // Determine which eBay API environment to use
    const ebayEnv = process.env.EBAY_ENV || 'production';
    const useProduction = ebayEnv === 'production';
    const apiUrl = useProduction
      ? 'https://api.ebay.com'
      : 'https://api.sandbox.ebay.com';

    console.log('🔍 Fetching eBay listings:', { useProduction, status, userId: userId.substring(0, 8) + '...' });

    // Use Trading API's GetMyeBaySelling to get actual "My eBay" listings
    // This works regardless of SKU/inventory management and returns all active listings
    const tradingUrl = useProduction
      ? 'https://api.ebay.com/ws/api.dll'
      : 'https://api.sandbox.ebay.com/ws/api.dll';

    // Build XML request for GetMyeBaySelling based on status filter
    let xmlRequest;
    
    if (status === 'All') {
      // Fetch both Active and Ended listings
      xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
  <SoldList>
    <Include>true</Include>
    <DaysBeforeToday>60</DaysBeforeToday>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </SoldList>
  <UnsoldList>
    <Include>true</Include>
    <DaysBeforeToday>60</DaysBeforeToday>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </UnsoldList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
    } else if (status === 'Ended') {
      // Fetch only Ended listings (Sold + Unsold)
      xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <SoldList>
    <Include>true</Include>
    <DaysBeforeToday>60</DaysBeforeToday>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </SoldList>
  <UnsoldList>
    <Include>true</Include>
    <DaysBeforeToday>60</DaysBeforeToday>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </UnsoldList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
    } else {
      // Default: Fetch only Active listings
      xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetMyeBaySellingRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ActiveList>
    <Include>true</Include>
    <Pagination>
      <EntriesPerPage>${limit}</EntriesPerPage>
      <PageNumber>1</PageNumber>
    </Pagination>
  </ActiveList>
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
    }

    const response = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
      },
      body: xmlRequest,
    });

    console.log('📡 eBay Trading API response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch eBay listings',
        details: errorText,
      });
    }

    const xmlText = await response.text();
    console.log('📡 Raw XML response length:', xmlText.length);

    // Parse XML response
    const items = parseMyeBaySellingXML(xmlText);
    console.log('✅ Parsed listings:', items.length);
    
    // Debug: Log first item's image data
    if (items.length > 0) {
      console.log('🖼️ Sample item image data:', {
        itemId: items[0].itemId,
        imageUrl: items[0].imageUrl,
        pictureURLs: items[0].pictureURLs,
      });
    }

    // Check which items are already imported
    const itemIds = items.map(item => item.itemId).filter(Boolean);
    
    if (itemIds.length > 0) {
      const { data: importedItems } = await supabase
        .from('inventory_items')
        .select('ebay_item_id')
        .eq('user_id', userId)
        .in('ebay_item_id', itemIds);

      const importedItemIds = new Set(importedItems?.map(item => item.ebay_item_id) || []);

      // Mark items as imported or not
      const listings = items.map(item => ({
        ...item,
        imported: importedItemIds.has(item.itemId),
      }));

      return res.status(200).json({
        listings,
        total: listings.length,
      });
    }

    return res.status(200).json({
      listings: items.map(item => ({ ...item, imported: false })),
      total: items.length,
    });

  } catch (error) {
    console.error('❌ Error fetching eBay listings:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch eBay listings',
      details: error.stack,
    });
  }
}

// Helper function to parse GetMyeBaySelling XML response
function parseMyeBaySellingXML(xml) {
  const items = [];
  
  // Extract ItemArray from ActiveList, SoldList, and UnsoldList
  const listTypes = ['ActiveList', 'SoldList', 'UnsoldList'];
  
  for (const listType of listTypes) {
    const listMatch = xml.match(new RegExp(`<${listType}>[\\s\\S]*?</${listType}>`));
    if (!listMatch) continue;
    
    const itemArrayMatch = listMatch[0].match(/<ItemArray>([\s\S]*?)<\/ItemArray>/);
    if (!itemArrayMatch) continue;
    
    // Mark status based on list type
    const itemStatus = listType === 'ActiveList' ? 'Active' : 'Ended';
    
    // Match all Item elements
    const itemRegex = /<Item>([\s\S]*?)<\/Item>/g;
    let itemMatch;

    while ((itemMatch = itemRegex.exec(itemArrayMatch[1])) !== null) {
      const itemXml = itemMatch[1];
      
      // Extract fields with regex
      const getField = (field) => {
        const match = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
        return match ? match[1] : null;
      };

      // Extract PictureURL fields (can be in Item or PictureDetails)
      const pictureURLs = [];
      
      // Try direct PictureURL under Item
      const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
      let pictureMatch;
      while ((pictureMatch = pictureRegex.exec(itemXml)) !== null) {
        const url = pictureMatch[1];
        if (url && url.startsWith('http')) {
          pictureURLs.push(url);
        }
      }
      
      // If no pictures found, try PictureDetails > PictureURL
      if (pictureURLs.length === 0) {
        const pictureDetailsMatch = itemXml.match(/<PictureDetails>([\s\S]*?)<\/PictureDetails>/);
        if (pictureDetailsMatch) {
          const pictureDetailsRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
          let detailsPictureMatch;
          while ((detailsPictureMatch = pictureDetailsRegex.exec(pictureDetailsMatch[1])) !== null) {
            const url = detailsPictureMatch[1];
            if (url && url.startsWith('http')) {
              pictureURLs.push(url);
            }
          }
        }
      }
      
      // If still no pictures, try GalleryURL as fallback
      if (pictureURLs.length === 0) {
        const galleryURL = getField('GalleryURL');
        if (galleryURL && galleryURL.startsWith('http')) {
          pictureURLs.push(galleryURL);
        }
      }

      const itemId = getField('ItemID');
      const title = getField('Title');
      
      // Extract price with attribute handling (e.g., <CurrentPrice currencyID="USD">25.99</CurrentPrice>)
      const currentPriceMatch = itemXml.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/);
      const currentPrice = currentPriceMatch ? currentPriceMatch[1] : null;
      
      const quantity = getField('Quantity');
      const quantitySold = getField('QuantitySold');
      const listingType = getField('ListingType');
      const viewItemURL = getField('ViewItemURL');
      const startTime = getField('StartTime');
      const endTime = getField('EndTime');
      
      console.log(`📊 Item ${itemId} price: ${currentPrice}, status: ${itemStatus}`);

      if (itemId && title) {
        items.push({
          itemId,
          title,
          price: parseFloat(currentPrice) || 0,
          quantity: parseInt(quantity) || 0,
          quantitySold: parseInt(quantitySold) || 0,
          imageUrl: pictureURLs[0] || null,
          pictureURLs,
          listingType,
          viewItemURL,
          startTime,
          endTime,
          status: itemStatus,
          description: '', // GetMyeBaySelling doesn't include full description
          condition: 'USED', // Default, would need GetItem for actual condition
        });
      }
    }
  }

  return items;
}
