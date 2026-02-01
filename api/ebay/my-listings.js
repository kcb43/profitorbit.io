/**
 * Fetch user's eBay listings (for Import page)
 * Uses eBay Sell API (Inventory + Browse)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to get date N days ago in ISO format
function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

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
      // Fetch both Active and Sold listings (skip unsold)
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
  <DetailLevel>ReturnAll</DetailLevel>
</GetMyeBaySellingRequest>`;
    } else if (status === 'Ended' || status === 'Sold') {
      // Fetch sold items from Orders API (more comprehensive than SoldList)
      xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${getDateDaysAgo(60)}</CreateTimeFrom>
  <CreateTimeTo>${new Date().toISOString()}</CreateTimeTo>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>Completed</OrderStatus>
  <Pagination>
    <EntriesPerPage>${limit}</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetOrdersRequest>`;
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
        'X-EBAY-API-CALL-NAME': status === 'Sold' || status === 'Ended' ? 'GetOrders' : 'GetMyeBaySelling',
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
    console.log('🔍 Checking for list types in response...');
    console.log('  - Has ActiveList:', xmlText.includes('<ActiveList>'));
    console.log('  - Has SoldList:', xmlText.includes('<SoldList>'));
    console.log('  - Has UnsoldList:', xmlText.includes('<UnsoldList>'));

    // Parse XML response
    const items = status === 'Sold' || status === 'Ended' 
      ? parseGetOrdersXML(xmlText, status)
      : parseMyeBaySellingXML(xmlText, status);
    console.log('✅ Parsed listings:', items.length);
    console.log('📊 Status breakdown:', {
      active: items.filter(i => i.status === 'Active').length,
      ended: items.filter(i => i.status === 'Ended').length,
    });
    
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

// Helper function to parse GetOrders XML response (for sold items)
function parseGetOrdersXML(xml, requestedStatus) {
  const items = [];
  
  console.log('🔍 Parser: Parsing GetOrders response for sold items...');
  
  // Extract OrderArray section
  const orderArrayMatch = xml.match(/<OrderArray>([\s\S]*?)<\/OrderArray>/);
  if (!orderArrayMatch) {
    console.log('⚠️ No OrderArray found in GetOrders response');
    return items;
  }
  
  // Match all Order elements
  const orderRegex = /<Order>([\s\S]*?)<\/Order>/g;
  let orderMatch;
  let orderCount = 0;

  while ((orderMatch = orderRegex.exec(orderArrayMatch[1])) !== null) {
    orderCount++;
    const orderXml = orderMatch[1];
    
    // Extract order-level fields
    const getField = (field) => {
      const match = orderXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
      return match ? match[1] : null;
    };
    
    const orderStatus = getField('OrderStatus');
    const createdTime = getField('CreatedTime'); // Date Sold
    
    // Skip cancelled orders
    if (orderStatus === 'Cancelled' || orderStatus === 'Canceled') {
      console.log(`  ⏭️ Skipping cancelled order`);
      continue;
    }
    
    // Extract TransactionArray
    const transactionArrayMatch = orderXml.match(/<TransactionArray>([\s\S]*?)<\/TransactionArray>/);
    if (!transactionArrayMatch) continue;
    
    // Match all Transaction elements
    const transactionRegex = /<Transaction>([\s\S]*?)<\/Transaction>/g;
    let transactionMatch;
    
    while ((transactionMatch = transactionRegex.exec(transactionArrayMatch[1])) !== null) {
      const transactionXml = transactionMatch[1];
      
      // Extract Item from transaction
      const itemMatch = transactionXml.match(/<Item>([\s\S]*?)<\/Item>/);
      if (!itemMatch) continue;
      
      const itemXml = itemMatch[1];
      
      const getItemField = (field) => {
        const match = itemXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
        return match ? match[1] : null;
      };
      
      // Get quantity from transaction level
      const quantityMatch = transactionXml.match(/<QuantityPurchased>([^<]*)<\/QuantityPurchased>/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      // Extract PictureURL fields
      const pictureURLs = [];
      const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
      let pictureMatch;
      while ((pictureMatch = pictureRegex.exec(itemXml)) !== null) {
        const url = pictureMatch[1];
        if (url && url.startsWith('http')) {
          pictureURLs.push(url);
        }
      }
      
      if (pictureURLs.length === 0) {
        const galleryURL = getItemField('GalleryURL');
        if (galleryURL && galleryURL.startsWith('http')) {
          pictureURLs.push(galleryURL);
        }
      }

      const itemId = getItemField('ItemID');
      const title = getItemField('Title');
      
      // Get price from TransactionPrice
      const transPriceMatch = transactionXml.match(/<TransactionPrice[^>]*>([^<]+)<\/TransactionPrice>/);
      const transactionPrice = transPriceMatch ? transPriceMatch[1] : null;
      
      const listingType = getItemField('ListingType');
      const viewItemURL = getItemField('ViewItemURL');
      const startTime = getItemField('StartTime');
      
      console.log(`📊 Sold Item ${itemId} price: ${transactionPrice}, qty: ${quantity}, sold: ${createdTime}`);

      if (itemId && title) {
        items.push({
          itemId,
          title,
          price: parseFloat(transactionPrice) || 0,
          quantity: quantity,
          quantitySold: quantity,
          imageUrl: pictureURLs[0] || null,
          pictureURLs,
          listingType,
          viewItemURL,
          startTime,
          endTime: createdTime, // Date sold
          status: 'Sold',
          description: '',
          condition: 'USED',
        });
      }
    }
  }
  
  console.log(`✅ Parsed ${items.length} sold items from GetOrders (${orderCount} orders processed)`);
  return items;
}

// Helper function to parse GetMyeBaySelling XML response
function parseMyeBaySellingXML(xml, requestedStatus) {
  const items = [];
  
  console.log('🔍 Parser: Looking for list types...');
  console.log('📋 Parser: Requested status:', requestedStatus);
  
  // Determine which list types to parse based on requested status
  let listTypesToParse = [];
  if (requestedStatus === 'Active') {
    listTypesToParse = ['ActiveList'];
  } else if (requestedStatus === 'Sold' || requestedStatus === 'Ended') {
    // Only show sold items (not unsold/expired)
    listTypesToParse = ['SoldList'];
  } else if (requestedStatus === 'All') {
    // Show everything: active + sold (skip unsold)
    listTypesToParse = ['ActiveList', 'SoldList'];
  } else {
    // Default to Active
    listTypesToParse = ['ActiveList'];
  }
  
  console.log('📋 Parser: Will parse these lists:', listTypesToParse);
  
  for (const listType of listTypesToParse) {
    console.log(`🔍 Parser: Checking ${listType}...`);
    const listMatch = xml.match(new RegExp(`<${listType}>[\\s\\S]*?</${listType}>`));
    if (!listMatch) {
      console.log(`  ⚠️ ${listType} not found in response`);
      continue;
    }
    
    console.log(`  ✅ ${listType} found, looking for items...`);
    
    // Log a snippet of the list content for debugging
    const listSnippet = listMatch[0].substring(0, 500);
    console.log(`  🔍 ${listType} content preview:`, listSnippet);
    
    // SoldList has a different structure: OrderTransactionArray instead of ItemArray
    if (listType === 'SoldList') {
      const orderTransactionMatch = listMatch[0].match(/<OrderTransactionArray>([\s\S]*?)<\/OrderTransactionArray>/);
      if (!orderTransactionMatch) {
        console.log(`  ⚠️ No OrderTransactionArray in SoldList`);
        continue;
      }
      
      console.log(`  📦 Processing sold items from OrderTransactionArray`);
      
      // Match all OrderTransaction elements
      const orderRegex = /<OrderTransaction>([\s\S]*?)<\/OrderTransaction>/g;
      let orderMatch;
      let itemCount = 0;

      while ((orderMatch = orderRegex.exec(orderTransactionMatch[1])) !== null) {
        const orderXml = orderMatch[1];
        
        // Extract the Item element from within Transaction
        const itemMatch = orderXml.match(/<Item>([\s\S]*?)<\/Item>/);
        if (!itemMatch) continue;
        
        itemCount++;
        const itemXml = itemMatch[1];
        
        // Parse the item (same logic as below but within Transaction)
        const getField = (field) => {
          const match = itemXml.match(new RegExp(`<${field}>([^<]*)`, 'i'));
          return match ? match[1] : null;
        };

        // Extract PictureURL fields
        const pictureURLs = [];
        const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
        let pictureMatch;
        while ((pictureMatch = pictureRegex.exec(itemXml)) !== null) {
          const url = pictureMatch[1];
          if (url && url.startsWith('http')) {
            pictureURLs.push(url);
          }
        }
        
        if (pictureURLs.length === 0) {
          const galleryURL = getField('GalleryURL');
          if (galleryURL && galleryURL.startsWith('http')) {
            pictureURLs.push(galleryURL);
          }
        }

        const itemId = getField('ItemID');
        const title = getField('Title');
        const currentPriceMatch = itemXml.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/);
        const currentPrice = currentPriceMatch ? currentPriceMatch[1] : null;
        const quantity = getField('Quantity');
        const quantitySold = getField('QuantitySold');
        const listingType = getField('ListingType');
        const viewItemURL = getField('ViewItemURL');
        const startTime = getField('StartTime');
        
        // For sold items, get EndTime from ListingDetails or Transaction
        const endTimeMatch = orderXml.match(/<EndTime>([^<]*)<\/EndTime>/);
        const endTime = endTimeMatch ? endTimeMatch[1] : null;
        
        console.log(`📊 Item ${itemId} price: ${currentPrice}, status: Sold`);

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
            status: 'Sold',
            description: '',
            condition: 'USED',
          });
        }
      }
      
      console.log(`  ✅ Parsed ${itemCount} sold items from SoldList`);
      continue; // Skip the regular ItemArray parsing below
    }
    
    // Regular ItemArray parsing for ActiveList and UnsoldList
    const itemArrayMatch = listMatch[0].match(/<ItemArray>([\s\S]*?)<\/ItemArray>/);
    if (!itemArrayMatch) {
      console.log(`  ⚠️ No ItemArray in ${listType}`);
      
      // Check if there's a PaginationResult that might tell us why
      const paginationMatch = listMatch[0].match(/<PaginationResult>([\s\S]*?)<\/PaginationResult>/);
      if (paginationMatch) {
        console.log(`  📊 PaginationResult found:`, paginationMatch[1].substring(0, 200));
      }
      continue;
    }
    
    // Mark status based on list type
    const itemStatus = listType === 'ActiveList' ? 'Active' : 'Sold';
    console.log(`  📦 Processing items from ${listType} as status: ${itemStatus}`);
    
    // Match all Item elements
    const itemRegex = /<Item>([\s\S]*?)<\/Item>/g;
    let itemMatch;
    let itemCount = 0;

    while ((itemMatch = itemRegex.exec(itemArrayMatch[1])) !== null) {
      itemCount++;
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
    
    console.log(`  ✅ Parsed ${itemCount} items from ${listType}`);
  }

  console.log(`🎯 Parser: Total items parsed: ${items.length}`);
  return items;
}
