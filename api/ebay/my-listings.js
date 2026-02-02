/**
 * Fetch user's eBay listings (for Import page)
 * Uses eBay Sell API (Inventory + Browse)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Simple in-memory cache for GetItemTransactions data
// Cache structure: { userId-status: { data: {...}, timestamp: number } }
const transactionDataCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCachedTransactionData(userId, status) {
  const cacheKey = `${userId}-${status}`;
  const cached = transactionDataCache.get(cacheKey);
  
  if (!cached) return null;
  
  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL_MS) {
    transactionDataCache.delete(cacheKey);
    return null;
  }
  
  console.log(`🚀 Using cached transaction data (age: ${Math.round(age / 1000)}s)`);
  return cached.data;
}

function setCachedTransactionData(userId, status, data) {
  const cacheKey = `${userId}-${status}`;
  transactionDataCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });
}

// Helper to decode HTML entities in strings
function decodeHtmlEntities(text) {
  if (!text) return text;
  
  const entities = {
    '&quot;': '"',
    '&apos;': "'",
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&#39;': "'",
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#x60;': '`',
    '&#x3D;': '=',
  };
  
  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replaceAll(entity, char);
  }
  
  // Also handle numeric entities like &#34; for quotes
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
  
  return decoded;
}

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
      // For "All" status, we need to fetch both Active and Sold items
      // We'll make API calls in parallel for best performance:
      // 1. GetMyeBaySelling for Active items (fast, includes images)
      // 2. GetOrders for sold transaction details (buyer info, accurate dates)
      // 3. GetSellerList for sold item details and images
      // Then merge them together
      
      console.log('📋 Fetching Active and Sold items in parallel...');
      
      const createTimeFrom = getDateDaysAgo(90);
      const endTimeFrom = getDateDaysAgo(90);
      const endTimeTo = new Date().toISOString();
      
      // Build all 3 requests
      const activeRequest = `<?xml version="1.0" encoding="utf-8"?>
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

      const getOrdersRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${createTimeFrom}</CreateTimeFrom>
  <OrderRole>Seller</OrderRole>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetOrdersRequest>`;

      const getSellerListRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <EndTimeFrom>${endTimeFrom}</EndTimeFrom>
  <EndTimeTo>${endTimeTo}</EndTimeTo>
  <IncludeWatchCount>false</IncludeWatchCount>
  <Pagination>
    <EntriesPerPage>${limit}</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetSellerListRequest>`;

      // Make all 3 API calls in parallel using Promise.all
      const [activeResponse, ordersResponse, sellerListResponse] = await Promise.all([
        fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': 'GetMyeBaySelling',
          },
          body: activeRequest,
        }),
        fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': 'GetOrders',
          },
          body: getOrdersRequest,
        }),
        fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': 'GetSellerList',
          },
          body: getSellerListRequest,
        })
      ]);
      
      // Parse active items
      if (!activeResponse.ok) {
        throw new Error(`eBay API error: ${activeResponse.status}`);
      }
      const activeXml = await activeResponse.text();
      const activeItems = parseMyeBaySellingXML(activeXml, 'Active');
      console.log(`✅ Fetched ${activeItems.length} active items`);
      
      // Parse orders for transaction data
      let transactionsByItemId = {};
      if (ordersResponse.ok) {
        const ordersXml = await ordersResponse.text();
        transactionsByItemId = parseOrdersToTransactions(ordersXml);
        console.log(`✅ Fetched transactions for ${Object.keys(transactionsByItemId).length} unique items`);
      }
      
      // Parse sold items with transaction data
      if (!sellerListResponse.ok) {
        throw new Error(`eBay API error: ${sellerListResponse.status}`);
      }
      const sellerListXml = await sellerListResponse.text();
      const soldItems = parseGetSellerListXML(sellerListXml, transactionsByItemId);
      console.log(`✅ Fetched ${soldItems.length} sold items`);
      
      // Debug: Log sample sold items to verify unique IDs
      if (soldItems.length > 0) {
        console.log('🔍 Sample sold item IDs:', soldItems.slice(0, 5).map(i => ({
          itemId: i.itemId,
          originalItemId: i.originalItemId,
          buyer: i.buyerUsername,
          saleNumber: i.saleNumber
        })));
      }
      
      // Combine active and sold items
      const allItems = [...activeItems, ...soldItems];
      console.log(`✅ Combined total: ${allItems.length} items (${activeItems.length} active + ${soldItems.length} sold)`);
      
      // Check which items are already imported
      const itemIds = allItems.map(item => item.itemId).filter(Boolean);
      
      if (itemIds.length > 0) {
        // For sold items with transaction IDs, extract original eBay item IDs
        const originalItemIds = itemIds.map(id => {
          if (id.includes('-txn-')) {
            return id.split('-txn-')[0];
          }
          return id;
        });

        const { data: importedItems } = await supabase
          .from('inventory_items')
          .select('ebay_item_id')
          .eq('user_id', userId)
          .in('ebay_item_id', originalItemIds);

        const importedItemIds = new Set(importedItems?.map(item => item.ebay_item_id) || []);

        // For sold items, also check if there's a sale record for this specific transaction
        let soldItemsMap = new Map(); // Map of transactionId -> { imported: true, saleId: 'xxx', inventoryId: 'yyy' }
        const transactionIds = allItems
          .filter(item => item.transactionId)
          .map(item => item.transactionId);

        if (transactionIds.length > 0) {
          const { data: salesRecords } = await supabase
            .from('sales')
            .select('id, ebay_transaction_id, inventory_id')
            .eq('user_id', userId)
            .in('ebay_transaction_id', transactionIds)
            .is('deleted_at', null); // Only get non-deleted sales

          // Map transaction IDs to sale data
          salesRecords?.forEach(sale => {
            if (sale.ebay_transaction_id) {
              soldItemsMap.set(sale.ebay_transaction_id, {
                imported: true,
                saleId: sale.id,
                inventoryId: sale.inventory_id,
              });
            }
          });
        }

        // Mark items as imported or not
        const listings = allItems.map(item => {
          // Extract original item ID if it's a transaction ID format
          const originalItemId = item.itemId.includes('-txn-') 
            ? item.itemId.split('-txn-')[0] 
            : item.itemId;

          // Check if imported: either inventory exists OR (for sold items) sale record exists
          let isImported = importedItemIds.has(originalItemId);
          let saleId = null;
          let inventoryId = null;
          
          // For sold items, also check if the specific transaction was imported
          if (item.status === 'Sold' && item.transactionId) {
            const saleData = soldItemsMap.get(item.transactionId);
            if (saleData) {
              isImported = isImported && saleData.imported;
              saleId = saleData.saleId;
              inventoryId = saleData.inventoryId;
            } else {
              isImported = false; // Transaction not imported
            }
          }

          return {
            ...item,
            imported: isImported,
            saleId: saleId,
            inventoryId: inventoryId,
          };
        });

        return res.status(200).json({
          listings,
          total: listings.length,
          active: activeItems.length,
          sold: soldItems.length,
        });
      }
      
      return res.status(200).json({ 
        listings: allItems.map(item => ({ ...item, imported: false })),
        total: allItems.length,
        active: activeItems.length,
        sold: soldItems.length,
      });
      
    } else if (status === 'Ended' || status === 'Sold') {
      // For sold items, fetch both GetSellerList (for items with images) 
      // AND GetOrders (for individual transaction details)
      // Make these calls in PARALLEL for better performance
      
      const createTimeFrom = getDateDaysAgo(90);
      const endTimeFrom = getDateDaysAgo(90);
      const endTimeTo = new Date().toISOString();
      
      const getOrdersRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${createTimeFrom}</CreateTimeFrom>
  <OrderRole>Seller</OrderRole>
  <Pagination>
    <EntriesPerPage>200</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetOrdersRequest>`;

      const getSellerListRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetSellerListRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <EndTimeFrom>${endTimeFrom}</EndTimeFrom>
  <EndTimeTo>${endTimeTo}</EndTimeTo>
  <IncludeWatchCount>false</IncludeWatchCount>
  <Pagination>
    <EntriesPerPage>${limit}</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetSellerListRequest>`;

      console.log('🚀 Fetching orders and seller list for sold items...');
      
      // Make 2 API calls in parallel using Promise.all (removing GetAccount)
      const [ordersResponse, sellerListResponse] = await Promise.all([
        fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': 'GetOrders',
          },
          body: getOrdersRequest,
        }),
        fetch(tradingUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/xml',
            'X-EBAY-API-SITEID': '0',
            'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
            'X-EBAY-API-CALL-NAME': 'GetSellerList',
          },
          body: getSellerListRequest,
        })
      ]);
      
      // Parse orders response
      let transactionsByItemId = {};
      if (ordersResponse.ok) {
        const ordersXml = await ordersResponse.text();
        transactionsByItemId = parseOrdersToTransactions(ordersXml);
        console.log(`✅ Fetched transactions for ${Object.keys(transactionsByItemId).length} unique items`);
      }
      
      // Build a flat list of all transactions we need to fetch
      const allTransactions = [];
      for (const itemId in transactionsByItemId) {
        transactionsByItemId[itemId].forEach(txn => {
          allTransactions.push({
            itemId,
            transactionId: txn.transactionId
          });
        });
      }
      
      console.log(`💰 Fetching detailed financial data for ${allTransactions.length} individual transactions...`);
      
      // Fetch GetItemTransactions for each specific transaction
      // Check cache first
      const cachedFees = getCachedTransactionData(userId, status);
      let feesByItemId = {};
      
      if (cachedFees && Object.keys(cachedFees).length > 0) {
        feesByItemId = cachedFees;
        console.log(`🚀 Using cached transaction data (age: ${Math.round((Date.now() - cachedFees.timestamp) / 1000)}s)`);
        console.log(`✅ Using cached fees for ${Object.keys(feesByItemId).length} items`);
      } else {
        if (cachedFees) {
          console.log(`⚠️ Cache exists but is empty, will fetch from API`);
        }
        // We'll do this in batches to avoid overwhelming the API
        const batchSize = 20;
        
        for (let i = 0; i < allTransactions.length; i += batchSize) {
          const batch = allTransactions.slice(i, i + batchSize);
          console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allTransactions.length / batchSize)} (${batch.length} transactions)...`);
          
          const batchPromises = batch.map(async ({ itemId, transactionId }) => {
          const getItemTransactionsRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <TransactionID>${transactionId}</TransactionID>
  <IncludeFinalValueFee>true</IncludeFinalValueFee>
</GetItemTransactionsRequest>`;

          try {
            const response = await fetch(tradingUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'text/xml',
                'X-EBAY-API-SITEID': '0',
                'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                'X-EBAY-API-CALL-NAME': 'GetItemTransactions',
              },
              body: getItemTransactionsRequest,
            });
            
            if (response.ok) {
              const xml = await response.text();
              return { itemId, transactionId, xml };
            } else {
              return { itemId, transactionId, xml: null };
            }
          } catch (error) {
            return { itemId, transactionId, xml: null };
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        
        // Parse each result
        for (const { itemId, transactionId, xml } of batchResults) {
          if (!xml) continue;
          
          // Parse transactions for this item
          const transactionsMatch = xml.match(/<TransactionArray>([\s\S]*?)<\/TransactionArray>/);
          if (!transactionsMatch) {
            continue; // eBay doesn't have transaction data for this item
          }
          
          const transactionRegex = /<Transaction>([\s\S]*?)<\/Transaction>/g;
          let txnMatch;
          
          while ((txnMatch = transactionRegex.exec(transactionsMatch[1])) !== null) {
            const txnXml = txnMatch[1];
            
            // Extract FinalValueFee
            const fvfMatch = txnXml.match(/<FinalValueFee[^>]*>([^<]+)<\/FinalValueFee>/);
            const finalValueFee = fvfMatch ? parseFloat(fvfMatch[1]) : 0;
            
            // Extract Taxes - try multiple patterns
            let salesTax = 0;
            const taxMatch1 = txnXml.match(/<SalesTax>[\s\S]*?<SalesTaxAmount[^>]*>([^<]+)<\/SalesTaxAmount>/);
            const taxMatch2 = txnXml.match(/<Taxes>[\s\S]*?<TotalTaxAmount[^>]*>([^<]+)<\/TotalTaxAmount>/);
            const taxMatch3 = txnXml.match(/<SalesTaxAmount[^>]*>([^<]+)<\/SalesTaxAmount>/);
            
            if (taxMatch1) salesTax = parseFloat(taxMatch1[1]);
            else if (taxMatch2) salesTax = parseFloat(taxMatch2[1]);
            else if (taxMatch3) salesTax = parseFloat(taxMatch3[1]);
            
            // Extract Shipping cost
            const shippingMatch = txnXml.match(/<ShippingServiceCost[^>]*>([^<]+)<\/ShippingServiceCost>/);
            const shippingCost = shippingMatch ? parseFloat(shippingMatch[1]) : 0;
            
            // Extract ActualShippingCost (what buyer actually paid)
            const actualShippingMatch = txnXml.match(/<ActualShippingCost[^>]*>([^<]+)<\/ActualShippingCost>/);
            const actualShippingCost = actualShippingMatch ? parseFloat(actualShippingMatch[1]) : shippingCost;
            
            // === NEW: Extract additional fields for Sales History ===
            
            // Shipping/Tracking Info (fully displayed)
            const shippingDetailsMatch = txnXml.match(/<ShippingDetails>([\s\S]*?)<\/ShippingDetails>/);
            let trackingNumber = null;
            let shippingCarrier = null;
            let deliveryDate = null;
            let shippedDate = null;
            
            if (shippingDetailsMatch) {
              const shippingXml = shippingDetailsMatch[1];
              const trackingMatch = shippingXml.match(/<ShipmentTrackingNumber>([^<]*)<\/ShipmentTrackingNumber>/);
              trackingNumber = trackingMatch ? trackingMatch[1] : null;
              
              const carrierMatch = shippingXml.match(/<ShippingCarrierUsed>([^<]*)<\/ShippingCarrierUsed>/);
              shippingCarrier = carrierMatch ? carrierMatch[1] : null;
              
              const deliveryMatch = shippingXml.match(/<ActualDeliveryTime>([^<]*)<\/ActualDeliveryTime>/);
              deliveryDate = deliveryMatch ? deliveryMatch[1] : null;
            }
            
            const shippedTimeMatch = txnXml.match(/<ShippedTime>([^<]*)<\/ShippedTime>/);
            shippedDate = shippedTimeMatch ? shippedTimeMatch[1] : null;
            
            // Item Condition (fully displayed)
            const itemMatch = txnXml.match(/<Item>([\s\S]*?)<\/Item>/);
            let itemCondition = null;
            if (itemMatch) {
              const itemXml = itemMatch[1];
              const conditionMatch = itemXml.match(/<ConditionDisplayName>([^<]*)<\/ConditionDisplayName>/);
              itemCondition = conditionMatch ? conditionMatch[1] : null;
            }
            
            // Buyer Address (hidden behind button)
            const buyerMatch = txnXml.match(/<Buyer>([\s\S]*?)<\/Buyer>/);
            let buyerAddress = null;
            if (buyerMatch) {
              const buyerXml = buyerMatch[1];
              const addressMatch = buyerXml.match(/<ShippingAddress>([\s\S]*?)<\/ShippingAddress>/);
              if (addressMatch) {
                const addrXml = addressMatch[1];
                const getName = (field) => {
                  const m = addrXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
                  return m ? m[1] : '';
                };
                
                buyerAddress = {
                  name: getName('Name'),
                  street1: getName('Street1'),
                  street2: getName('Street2'),
                  city: getName('CityName'),
                  state: getName('StateOrProvince'),
                  zip: getName('PostalCode'),
                  country: getName('CountryName'),
                  phone: getName('Phone'),
                };
              }
            }
            
            // Payment Info (hidden behind button)
            const monetaryDetailsMatch = txnXml.match(/<MonetaryDetails>([\s\S]*?)<\/MonetaryDetails>/);
            let paymentMethod = null;
            let paymentStatus = null;
            let paymentDate = null;
            
            if (monetaryDetailsMatch) {
              const monetaryXml = monetaryDetailsMatch[1];
              const paymentMatch = monetaryXml.match(/<Payment>([\s\S]*?)<\/Payment>/);
              if (paymentMatch) {
                const paymentXml = paymentMatch[1];
                const statusMatch = paymentXml.match(/<PaymentStatus>([^<]*)<\/PaymentStatus>/);
                paymentStatus = statusMatch ? statusMatch[1] : null;
                
                const timeMatch = paymentXml.match(/<PaymentTime>([^<]*)<\/PaymentTime>/);
                paymentDate = timeMatch ? timeMatch[1] : null;
              }
            }
            
            const paymentMethodMatch = txnXml.match(/<PaymentMethodUsed>([^<]*)<\/PaymentMethodUsed>/);
            paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : null;
            
            // Item Location (hidden behind button)
            let itemLocation = null;
            if (itemMatch) {
              const itemXml = itemMatch[1];
              const locationMatch = itemXml.match(/<Location>([^<]*)<\/Location>/);
              itemLocation = locationMatch ? locationMatch[1] : null;
            }
            
            // Buyer Notes/Messages (hidden behind button)
            const buyerMessageMatch = txnXml.match(/<BuyerCheckoutMessage>([^<]*)<\/BuyerCheckoutMessage>/);
            const buyerNotes = buyerMessageMatch ? buyerMessageMatch[1] : null;
            
            // Store all data by transaction ID
            if (!feesByItemId[itemId]) {
              feesByItemId[itemId] = {};
            }
            feesByItemId[itemId][transactionId] = {
              finalValueFee,
              salesTax,
              shippingCost: actualShippingCost,
              // Fully displayed fields
              trackingNumber,
              shippingCarrier,
              deliveryDate,
              shippedDate,
              itemCondition,
              // Hidden fields
              buyerAddress,
              paymentMethod,
              paymentStatus,
              paymentDate,
              itemLocation,
              buyerNotes,
            };
          }
        }
        
        // Add small delay between batches to avoid rate limiting (reduced from 500ms)
        if (i + batchSize < allTransactions.length) {
          await new Promise(resolve => setTimeout(resolve, 250));
        }
      }
      
      console.log(`💰 Fetched financial details for ${Object.keys(feesByItemId).length} items with fees`);
      
      // Cache the fee data for 5 minutes (only if not empty)
      if (Object.keys(feesByItemId).length > 0) {
        setCachedTransactionData(userId, status, feesByItemId);
        console.log(`💾 Cached transaction data for ${Object.keys(feesByItemId).length} items`);
      } else {
        console.log(`⚠️ No transaction data to cache (empty result)`);
      }
    }
      
      // Merge fee data into transactions by matching TransactionID
      let matchedCount = 0;
      let unmatchedCount = 0;
      
      for (const itemId in transactionsByItemId) {
        if (feesByItemId[itemId]) {
          transactionsByItemId[itemId].forEach(txn => {
            const fees = feesByItemId[itemId][txn.transactionId];
            if (fees) {
              // Financial data
              txn.finalValueFee = fees.finalValueFee;
              txn.salesTax = fees.salesTax;
              txn.shippingCost = fees.shippingCost;
              txn.totalSale = txn.price + fees.shippingCost + fees.salesTax;
              txn.netPayout = txn.price + fees.shippingCost - fees.finalValueFee;
              
              // Fully displayed fields
              txn.trackingNumber = fees.trackingNumber;
              txn.shippingCarrier = fees.shippingCarrier;
              txn.deliveryDate = fees.deliveryDate;
              txn.shippedDate = fees.shippedDate;
              txn.itemCondition = fees.itemCondition;
              
              // Hidden fields (for button details)
              txn.buyerAddress = fees.buyerAddress;
              txn.paymentMethod = fees.paymentMethod;
              txn.paymentStatus = fees.paymentStatus;
              txn.paymentDate = fees.paymentDate;
              txn.itemLocation = fees.itemLocation;
              txn.buyerNotes = fees.buyerNotes;
              
              matchedCount++;
              if (matchedCount <= 5) {
                console.log(`  ✅ Merged fees for item ${itemId}, txn ${txn.transactionId}: FVF=$${fees.finalValueFee}, Tax=$${fees.salesTax}, Ship=$${fees.shippingCost}`);
              }
            } else {
              unmatchedCount++;
              if (unmatchedCount <= 3) {
                console.log(`  ⚠️ No fees found for item ${itemId}, txn ${txn.transactionId}`);
              }
            }
          });
        } else {
          unmatchedCount += transactionsByItemId[itemId].length;
        }
      }
      
      console.log(`✅ Matched ${matchedCount} transactions with fees, ${unmatchedCount} unmatched`);
      
      // Check seller list response
      if (!sellerListResponse.ok) {
        throw new Error(`eBay API error: ${sellerListResponse.status}`);
      }
      
      // Parse seller list response with transaction data
      const sellerListXml = await sellerListResponse.text();
      const items = parseGetSellerListXML(sellerListXml, transactionsByItemId);
      
      console.log('✅ Parsed listings:', items.length);
      
      // Debug: Log sample items to verify unique IDs
      if (items.length > 0) {
        console.log('🔍 Sample item IDs:', items.slice(0, 5).map(i => ({
          itemId: i.itemId,
          originalItemId: i.originalItemId,
          buyer: i.buyerUsername,
          saleNumber: i.saleNumber
        })));
      }
      
      // Check which items are already imported
      const itemIds = items.map(item => item.itemId).filter(Boolean);
      
      if (itemIds.length > 0) {
        // For sold items with transaction IDs, extract original eBay item IDs
        const originalItemIds = itemIds.map(id => {
          if (id.includes('-txn-')) {
            return id.split('-txn-')[0];
          }
          return id;
        });

        const { data: importedItems } = await supabase
          .from('inventory_items')
          .select('ebay_item_id')
          .eq('user_id', userId)
          .in('ebay_item_id', originalItemIds);

        const importedItemIds = new Set(importedItems?.map(item => item.ebay_item_id) || []);

        // For sold items, also check if there's a sale record for this specific transaction
        let soldItemsMap = new Map(); // Map of transactionId -> { imported: true, saleId: 'xxx', inventoryId: 'yyy' }
        const transactionIds = items
          .filter(item => item.transactionId)
          .map(item => item.transactionId);

        if (transactionIds.length > 0) {
          const { data: salesRecords } = await supabase
            .from('sales')
            .select('id, ebay_transaction_id, inventory_id')
            .eq('user_id', userId)
            .in('ebay_transaction_id', transactionIds)
            .is('deleted_at', null); // Only get non-deleted sales

          // Map transaction IDs to sale data
          salesRecords?.forEach(sale => {
            if (sale.ebay_transaction_id) {
              soldItemsMap.set(sale.ebay_transaction_id, {
                imported: true,
                saleId: sale.id,
                inventoryId: sale.inventory_id,
              });
            }
          });
        }

        // Mark items as imported or not
        const listings = items.map(item => {
          // Extract original item ID if it's a transaction ID format
          const originalItemId = item.itemId.includes('-txn-') 
            ? item.itemId.split('-txn-')[0] 
            : item.itemId;

          // Check if imported: either inventory exists OR (for sold items) sale record exists
          let isImported = importedItemIds.has(originalItemId);
          let saleId = null;
          let inventoryId = null;
          
          // For sold items, also check if the specific transaction was imported
          if (item.transactionId) {
            const saleData = soldItemsMap.get(item.transactionId);
            if (saleData) {
              isImported = isImported && saleData.imported;
              saleId = saleData.saleId;
              inventoryId = saleData.inventoryId;
            } else {
              isImported = false; // Transaction not imported
            }
          }

          return {
            ...item,
            imported: isImported,
            saleId: saleId,
            inventoryId: inventoryId,
          };
        });

        return res.status(200).json({
          listings,
          total: listings.length,
        });
      }
      
      return res.status(200).json({ 
        listings: items.map(item => ({ ...item, imported: false })),
        total: items.length,
      });
      
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
        'X-EBAY-API-CALL-NAME': status === 'Sold' || status === 'Ended' ? 'GetSellerList' : 'GetMyeBaySelling',
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
    
    // Check for eBay API errors
    if (xmlText.includes('<Ack>Failure</Ack>')) {
      // Extract error details
      const shortMsgMatch = xmlText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
      const longMsgMatch = xmlText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
      const errorCodeMatch = xmlText.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
      
      const shortMessage = shortMsgMatch ? shortMsgMatch[1] : 'Unknown error';
      const longMessage = longMsgMatch ? longMsgMatch[1] : shortMessage;
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'unknown';
      
      console.error('❌ eBay API returned error:', { errorCode, shortMessage, longMessage });
      
      // Special handling for expired token (ErrorCode 932)
      if (errorCode === '932' || shortMessage.includes('token is hard expired')) {
        return res.status(401).json({
          error: 'eBay token expired',
          errorCode: 'TOKEN_EXPIRED',
          message: 'Your eBay connection has expired. Please reconnect your eBay account.',
          details: longMessage,
        });
      }
      
      // Generic error handling
      return res.status(400).json({
        error: 'eBay API error',
        errorCode,
        message: shortMessage,
        details: longMessage,
      });
    }
    
    // Log first 1000 chars if response is suspiciously short (likely an error)
    if (xmlText.length < 5000) {
      console.log('⚠️ Short XML response (likely error):');
      console.log(xmlText.substring(0, 1000));
    }
    
    console.log('🔍 Checking for list types in response...');
    console.log('  - Has ActiveList:', xmlText.includes('<ActiveList>'));
    console.log('  - Has SoldList:', xmlText.includes('<SoldList>'));
    console.log('  - Has UnsoldList:', xmlText.includes('<UnsoldList>'));
    console.log('  - Has ItemArray (GetSellerList):', xmlText.includes('<ItemArray>'));

    // Parse XML response - use different parser based on API call
    let items;
    if (status === 'Sold' || status === 'Ended') {
      items = parseGetSellerListXML(xmlText, req.transactionsByItemId || {});
    } else {
      items = parseMyeBaySellingXML(xmlText, status);
    }
    console.log('✅ Parsed listings:', items.length);
    console.log('📊 Status breakdown:', {
      active: items.filter(i => i.status === 'Active').length,
      ended: items.filter(i => i.status === 'Ended').length,
      sold: items.filter(i => i.status === 'Sold').length,
    });
    
    // Safeguard: Filter items by requested status to prevent mixing
    if (status === 'Active') {
      items = items.filter(item => item.status === 'Active');
      console.log(`🔒 Filtered to Active only: ${items.length} items`);
    } else if (status === 'Sold' || status === 'Ended') {
      items = items.filter(item => item.status === 'Sold' || item.status === 'Ended');
      console.log(`🔒 Filtered to Sold/Ended only: ${items.length} items`);
    }
    
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
      // For sold items with transaction IDs (format: "itemId-txn-transactionId"), 
      // extract the original eBay item IDs
      const originalItemIds = itemIds.map(id => {
        if (id.includes('-txn-')) {
          return id.split('-txn-')[0];
        }
        return id;
      });

      const { data: importedItems } = await supabase
        .from('inventory_items')
        .select('ebay_item_id')
        .eq('user_id', userId)
        .in('ebay_item_id', originalItemIds);

      const importedItemIds = new Set(importedItems?.map(item => item.ebay_item_id) || []);

      // For sold items, also check if there's a sale record for this specific transaction
      let soldItemsMap = new Map();
      if (status === 'Sold' || status === 'Ended') {
        // Get all transaction IDs from the items
        const transactionIds = items
          .filter(item => item.transactionId)
          .map(item => item.transactionId);

        if (transactionIds.length > 0) {
          const { data: salesRecords } = await supabase
            .from('sales')
            .select('ebay_transaction_id')
            .eq('user_id', userId)
            .in('ebay_transaction_id', transactionIds);

          // Map transaction IDs to sold status
          salesRecords?.forEach(sale => {
            if (sale.ebay_transaction_id) {
              soldItemsMap.set(sale.ebay_transaction_id, true);
            }
          });
        }
      }

      // Mark items as imported or not
      const listings = items.map(item => {
        // Extract original item ID if it's a transaction ID format
        const originalItemId = item.itemId.includes('-txn-') 
          ? item.itemId.split('-txn-')[0] 
          : item.itemId;

        // Check if imported: either inventory exists OR (for sold items) sale record exists
        let isImported = importedItemIds.has(originalItemId);
        
        // For sold items, also check if the specific transaction was imported
        if ((status === 'Sold' || status === 'Ended') && item.transactionId) {
          isImported = isImported && soldItemsMap.has(item.transactionId);
        }

        return {
          ...item,
          imported: isImported,
        };
      });

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

// Helper function to parse GetOrders and group transactions by item ID
function parseOrdersToTransactions(xml) {
  const transactionsByItemId = {};
  
  console.log('🔍 Parsing GetOrders for transaction details...');
  
  // Extract OrderArray section
  const orderArrayMatch = xml.match(/<OrderArray>([\s\S]*?)<\/OrderArray>/);
  if (!orderArrayMatch) {
    console.log('⚠️ No OrderArray found in GetOrders response');
    return transactionsByItemId;
  }
  
  // Match all Order elements
  const orderRegex = /<Order>([\s\S]*?)<\/Order>/g;
  let orderMatch;
  let totalOrders = 0;

  while ((orderMatch = orderRegex.exec(orderArrayMatch[1])) !== null) {
    totalOrders++;
    const orderXml = orderMatch[1];
    
    // Extract order-level fields
    const getField = (field) => {
      const match = orderXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
      return match ? match[1] : null;
    };
    
    const orderStatus = getField('OrderStatus');
    const orderId = getField('OrderID');
    const createdTime = getField('CreatedTime');
    
    // Get buyer info at order level (applies to all transactions in this order)
    const orderBuyerMatch = orderXml.match(/<BuyerUserID>([^<]*)<\/BuyerUserID>/);
    const orderBuyerUsername = orderBuyerMatch ? orderBuyerMatch[1] : null;
    
    // Skip cancelled orders
    if (orderStatus === 'Cancelled' || orderStatus === 'Canceled') {
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
      
      const itemId = getItemField('ItemID');
      if (!itemId) continue;
      
      // Get quantity from transaction level
      const quantityMatch = transactionXml.match(/<QuantityPurchased>([^<]*)<\/QuantityPurchased>/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      // Get price from transaction level
      const transPriceMatch = transactionXml.match(/<TransactionPrice[^>]*>([^<]+)<\/TransactionPrice>/);
      const transactionPrice = transPriceMatch ? parseFloat(transPriceMatch[1]) : 0;
      
      // Get transaction ID
      const transactionIdMatch = transactionXml.match(/<TransactionID>([^<]*)<\/TransactionID>/);
      const transactionId = transactionIdMatch ? transactionIdMatch[1] : null;
      
      // Extract additional order/transaction details
      const getTransactionField = (field) => {
        const match = transactionXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
        return match ? match[1] : null;
      };
      
      // Get shipping cost
      const shippingServiceMatch = transactionXml.match(/<ShippingServiceCost[^>]*>([^<]+)<\/ShippingServiceCost>/);
      const shippingCost = shippingServiceMatch ? parseFloat(shippingServiceMatch[1]) : 0;
      
      // Get sales tax
      const salesTaxMatch = transactionXml.match(/<SalesTax>([\s\S]*?)<\/SalesTax>/);
      let salesTax = 0;
      if (salesTaxMatch) {
        const taxAmountMatch = salesTaxMatch[1].match(/<SalesTaxAmount[^>]*>([^<]+)<\/SalesTaxAmount>/);
        salesTax = taxAmountMatch ? parseFloat(taxAmountMatch[1]) : 0;
      }
      
      // Get fees from FinalValueFee
      const feeMatch = transactionXml.match(/<FinalValueFee[^>]*>([^<]+)<\/FinalValueFee>/);
      const finalValueFee = feeMatch ? parseFloat(feeMatch[1]) : 0;
      
      // Get payment status
      const paidTimeMatch = transactionXml.match(/<PaidTime>([^<]*)<\/PaidTime>/);
      const paidTime = paidTimeMatch ? paidTimeMatch[1] : null;
      
      // Get funds/payout status - check multiple possible fields
      let fundsStatus = 'Unknown';
      const payoutStatusMatch = orderXml.match(/<SellerPaymentStatus>([^<]*)<\/SellerPaymentStatus>/);
      const monetaryDetailsMatch = orderXml.match(/<MonetaryDetails>([\s\S]*?)<\/MonetaryDetails>/);
      
      if (payoutStatusMatch) {
        // SellerPaymentStatus can be: 'PaidOut', 'FundsOnHold', 'Processing', etc.
        fundsStatus = payoutStatusMatch[1];
      } else if (monetaryDetailsMatch) {
        // Check if PaymentsReceived exists
        const paymentsReceivedMatch = monetaryDetailsMatch[1].match(/<TotalAmountPaid[^>]*>([^<]+)<\/TotalAmountPaid>/);
        if (paymentsReceivedMatch && parseFloat(paymentsReceivedMatch[1]) > 0) {
          fundsStatus = 'Paid';
        }
      } else if (paidTime) {
        // If we have a paid time but no explicit status, assume funds are available
        fundsStatus = 'Available';
      }
      
      // Calculate net payout (price + shipping - fees)
      const totalSale = transactionPrice + shippingCost;
      const netPayout = totalSale - finalValueFee;
      
      console.log(`  💰 Financial: Shipping=$${shippingCost}, Tax=$${salesTax}, Fee=$${finalValueFee}, Net=$${netPayout}, Paid=${paidTime ? 'Yes' : 'No'}, Funds=${fundsStatus}`);
      
      // Get buyer info - try transaction level first, then fall back to order level
      const buyerMatch = transactionXml.match(/<Buyer>([\s\S]*?)<\/Buyer>/);
      let buyerUsername = null;
      if (buyerMatch) {
        const userIdMatch = buyerMatch[1].match(/<UserID>([^<]*)<\/UserID>/);
        buyerUsername = userIdMatch ? userIdMatch[1] : null;
      }
      
      // Fallback to order-level buyer if transaction-level not found
      if (!buyerUsername) {
        buyerUsername = orderBuyerUsername;
      }
      
      console.log(`  👤 Item ${itemId}: Buyer = ${buyerUsername || 'NOT FOUND'}`);
      
      // Store transaction for this item
      if (!transactionsByItemId[itemId]) {
        transactionsByItemId[itemId] = [];
      }
      
      transactionsByItemId[itemId].push({
        orderId,
        transactionId,
        quantity,
        price: transactionPrice,
        dateSold: createdTime,
        buyerUsername,
        orderStatus,
        // Additional financial details
        shippingCost,
        salesTax,
        finalValueFee,
        totalSale,
        netPayout,
        paidTime,
        fundsStatus,
      });
    }
  }
  
  console.log(`📊 Processed ${totalOrders} orders, found transactions for ${Object.keys(transactionsByItemId).length} items`);
  
  return transactionsByItemId;
}

// Helper function to parse GetSellerList XML response (for sold items with pictures)
function parseGetSellerListXML(xml, transactionsByItemId = {}) {
  const items = [];
  
  console.log('🔍 Parser: Parsing GetSellerList response for sold items...');
  
  // Extract ItemArray section
  const itemArrayMatch = xml.match(/<ItemArray>([\s\S]*?)<\/ItemArray>/);
  if (!itemArrayMatch) {
    console.log('⚠️ No ItemArray found in GetSellerList response');
    return items;
  }
  
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
    
    // Get SellingStatus to determine if item was sold
    const sellingStatusMatch = itemXml.match(/<SellingStatus>([\s\S]*?)<\/SellingStatus>/);
    if (!sellingStatusMatch) continue;
    
    const quantitySoldMatch = sellingStatusMatch[1].match(/<QuantitySold>([^<]*)<\/QuantitySold>/);
    const quantitySold = quantitySoldMatch ? parseInt(quantitySoldMatch[1]) : 0;
    
    // Only include items that were actually sold (not just ended/expired)
    if (quantitySold === 0) {
      console.log(`  ⏭️ Skipping item ${getField('ItemID')} (not sold, just ended)`);
      continue;
    }
    
    // Extract PictureURL fields
    const pictureURLs = [];
    
    // Check for PictureDetails section first
    const pictureDetailsMatch = itemXml.match(/<PictureDetails>([\s\S]*?)<\/PictureDetails>/);
    if (pictureDetailsMatch) {
      const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
      let pictureMatch;
      while ((pictureMatch = pictureRegex.exec(pictureDetailsMatch[1])) !== null) {
        const url = pictureMatch[1];
        if (url && url.startsWith('http')) {
          pictureURLs.push(url);
        }
      }
      if (pictureURLs.length > 0) {
        console.log(`  ✅ Found ${pictureURLs.length} images in PictureDetails`);
      }
    }
    
    // Fallback: check for GalleryURL
    if (pictureURLs.length === 0) {
      const galleryURL = getField('GalleryURL');
      if (galleryURL && galleryURL.startsWith('http')) {
        pictureURLs.push(galleryURL);
        console.log(`  ✅ Found 1 image in GalleryURL`);
      }
    }
    
    // Another fallback: ListingDetails > GalleryURL
    if (pictureURLs.length === 0) {
      const listingDetailsMatch = itemXml.match(/<ListingDetails>([\s\S]*?)<\/ListingDetails>/);
      if (listingDetailsMatch) {
        const galleryMatch = listingDetailsMatch[1].match(/<GalleryURL>([^<]*)<\/GalleryURL>/);
        if (galleryMatch && galleryMatch[1].startsWith('http')) {
          pictureURLs.push(galleryMatch[1]);
          console.log(`  ✅ Found 1 image in ListingDetails > GalleryURL`);
        }
      }
    }
    
    if (pictureURLs.length === 0) {
      console.log(`  ⚠️ No images found for item ${getField('ItemID')}`);
    }

    const itemId = getField('ItemID');
    const title = decodeHtmlEntities(getField('Title'));
    
    // Get price from SellingStatus > CurrentPrice
    const currentPriceMatch = sellingStatusMatch[1].match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/);
    const currentPrice = currentPriceMatch ? currentPriceMatch[1] : null;
    
    const quantity = getField('Quantity');
    const listingType = getField('ListingType');
    const viewItemURL = getField('ViewItemURL');
    
    // Get dates from ListingDetails
    const listingDetailsMatch = itemXml.match(/<ListingDetails>([\s\S]*?)<\/ListingDetails>/);
    let startTime = null;
    let endTime = null;
    if (listingDetailsMatch) {
      const startMatch = listingDetailsMatch[1].match(/<StartTime>([^<]*)<\/StartTime>/);
      const endMatch = listingDetailsMatch[1].match(/<EndTime>([^<]*)<\/EndTime>/);
      startTime = startMatch ? startMatch[1] : null;
      endTime = endMatch ? endMatch[1] : null;
    }
    
    // Use endTime as startTime for display (shows "Date sold: [date]")
    const displayTime = endTime || startTime;
    
    console.log(`📊 Sold Item ${itemId} price: ${currentPrice}, qty sold: ${quantitySold}, ended: ${endTime}, images: ${pictureURLs.length}`);

    if (itemId && title) {
      // Check if we have transaction-level data for this item
      const transactions = transactionsByItemId[itemId] || [];
      
      if (transactions.length > 0) {
        // Create separate entries for each transaction with accurate sale dates
        console.log(`  🔄 Expanding item ${itemId} into ${transactions.length} individual sales`);
        transactions.forEach((txn, idx) => {
          console.log(`    Sale ${idx + 1}: Buyer = ${txn.buyerUsername || 'NOT FOUND'}, Date = ${txn.dateSold}, Price = ${txn.price}, OrderID = ${txn.orderId}, TransactionID = ${txn.transactionId}`);
          
          // Create a unique itemId for each transaction to prevent duplicates
          // Format: {itemId}-txn-{transactionId} or {itemId}-order-{orderId}-{idx}
          const uniqueItemId = txn.transactionId 
            ? `${itemId}-txn-${txn.transactionId}`
            : `${itemId}-order-${txn.orderId}-${idx}`;
          
          // Generate unique transaction URL for this specific sale
          let saleURL = viewItemURL; // Default to item URL
          
          if (txn.transactionId) {
            // Add transaction ID to make URL unique and link to specific sale
            const separator = viewItemURL.includes('?') ? '&' : '?';
            saleURL = `${viewItemURL}${separator}transid=${txn.transactionId}`;
          } else if (txn.orderId) {
            // Fallback to order details page
            saleURL = `https://www.ebay.com/sh/ord/details?orderid=${txn.orderId}`;
          }
          
          items.push({
            itemId: uniqueItemId, // Use unique ID for each transaction
            originalItemId: itemId, // Keep original item ID for reference
            title,
            price: txn.price,
            quantity: parseInt(quantity) || 0,
            quantitySold: txn.quantity,
            imageUrl: pictureURLs[0] || null,
            pictureURLs,
            listingType,
            viewItemURL: saleURL, // Use transaction-specific URL
            startTime: txn.dateSold, // Actual sale date from order
            endTime: txn.dateSold,
            status: 'Sold',
            description: '',
            condition: 'USED',
            // Transaction-specific fields
            orderId: txn.orderId,
            transactionId: txn.transactionId,
            buyerUsername: txn.buyerUsername,
            saleNumber: idx + 1, // For display: "Sale 1 of 3"
            totalSales: transactions.length,
            // Financial details
            shippingCost: txn.shippingCost || 0,
            salesTax: txn.salesTax || 0,
            finalValueFee: txn.finalValueFee || 0,
            totalSale: txn.totalSale || txn.price,
            netPayout: txn.netPayout || txn.price,
            paidTime: txn.paidTime,
          });
        });
      } else {
        // Fallback: No transaction data, use item-level data
        items.push({
          itemId,
          title,
          price: parseFloat(currentPrice) || 0,
          quantity: parseInt(quantity) || 0,
          quantitySold,
          imageUrl: pictureURLs[0] || null,
          pictureURLs,
          listingType,
          viewItemURL,
          startTime: displayTime,
          endTime,
          status: 'Sold',
          description: '',
          condition: 'USED',
        });
      }
    }
  }
  
  console.log(`✅ Parsed ${items.length} sold items from GetSellerList (${itemCount} items processed)`);
  return items;
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
      
      // Extract PictureURL fields from Item > PictureDetails
      const pictureURLs = [];
      
      // Check for PictureDetails section first
      const pictureDetailsMatch = itemXml.match(/<PictureDetails>([\s\S]*?)<\/PictureDetails>/);
      if (pictureDetailsMatch) {
        const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
        let pictureMatch;
        while ((pictureMatch = pictureRegex.exec(pictureDetailsMatch[1])) !== null) {
          const url = pictureMatch[1];
          if (url && url.startsWith('http')) {
            pictureURLs.push(url);
          }
        }
        if (pictureURLs.length > 0) {
          console.log(`  ✅ Found ${pictureURLs.length} images in PictureDetails`);
        }
      }
      
      // Fallback: check for GalleryURL
      if (pictureURLs.length === 0) {
        const galleryURL = getItemField('GalleryURL');
        if (galleryURL && galleryURL.startsWith('http')) {
          pictureURLs.push(galleryURL);
          console.log(`  ✅ Found 1 image in GalleryURL`);
        }
      }
      
      // Another fallback: ListingDetails > GalleryURL
      if (pictureURLs.length === 0) {
        const listingDetailsMatch = itemXml.match(/<ListingDetails>([\s\S]*?)<\/ListingDetails>/);
        if (listingDetailsMatch) {
          const galleryMatch = listingDetailsMatch[1].match(/<GalleryURL>([^<]*)<\/GalleryURL>/);
          if (galleryMatch && galleryMatch[1].startsWith('http')) {
            pictureURLs.push(galleryMatch[1]);
            console.log(`  ✅ Found 1 image in ListingDetails > GalleryURL`);
          }
        }
      }
      
      if (pictureURLs.length === 0) {
        console.log(`  ⚠️ No images found for item ${getItemField('ItemID')}`);
      }

      const itemId = getItemField('ItemID');
      const title = decodeHtmlEntities(getItemField('Title'));
      
      // Get price from TransactionPrice
      const transPriceMatch = transactionXml.match(/<TransactionPrice[^>]*>([^<]+)<\/TransactionPrice>/);
      const transactionPrice = transPriceMatch ? transPriceMatch[1] : null;
      
      const listingType = getItemField('ListingType');
      const viewItemURL = getItemField('ViewItemURL');
      
      // For sold items, use the CreatedTime (date sold) as both startTime and endTime
      // Active listings show "Posted: startTime", sold items can show "Sold: createdTime"
      const startTime = createdTime; // Use order created time as the listing time
      
      console.log(`📊 Sold Item ${itemId} price: ${transactionPrice}, qty: ${quantity}, sold: ${createdTime}, images: ${pictureURLs.length}, title: ${title?.substring(0, 30)}`);

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
        
        // Debug: Log first 1000 chars of the full orderXml to see the structure
        if (itemCount === 1) {
          console.log(`  🔍 DEBUG: First OrderTransaction XML (first 2000 chars):`);
          console.log(orderXml.substring(0, 2000));
        }
        
        // Parse the item (same logic as below but within Transaction)
        const getField = (field) => {
          const match = itemXml.match(new RegExp(`<${field}>([^<]*)`, 'i'));
          return match ? match[1] : null;
        };

        // Extract PictureURL fields - try multiple locations
        const pictureURLs = [];
        
        // Strategy 1: Check for PictureDetails in Item
        const pictureDetailsMatch = itemXml.match(/<PictureDetails>([\s\S]*?)<\/PictureDetails>/);
        if (pictureDetailsMatch) {
          console.log(`  🔍 Found PictureDetails in Item (length: ${pictureDetailsMatch[1].length})`);
          const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
          let pictureMatch;
          while ((pictureMatch = pictureRegex.exec(pictureDetailsMatch[1])) !== null) {
            const url = pictureMatch[1];
            if (url && url.startsWith('http')) {
              pictureURLs.push(url);
            }
          }
          console.log(`  📸 Extracted ${pictureURLs.length} images from PictureDetails`);
        } else {
          console.log(`  ⚠️ No PictureDetails found in Item XML`);
        }
        
        // Strategy 2: Fallback to GalleryURL at item level
        if (pictureURLs.length === 0) {
          const galleryURL = getField('GalleryURL');
          if (galleryURL) {
            console.log(`  🔍 Found GalleryURL: ${galleryURL}`);
            if (galleryURL.startsWith('http')) {
              pictureURLs.push(galleryURL);
            }
          }
        }
        
        // Strategy 3: ListingDetails > GalleryURL
        if (pictureURLs.length === 0) {
          const listingDetailsMatch = itemXml.match(/<ListingDetails>([\s\S]*?)<\/ListingDetails>/);
          if (listingDetailsMatch) {
            console.log(`  🔍 Found ListingDetails (length: ${listingDetailsMatch[1].length})`);
            const galleryMatch = listingDetailsMatch[1].match(/<GalleryURL>([^<]*)<\/GalleryURL>/);
            if (galleryMatch) {
              console.log(`  🔍 Found GalleryURL in ListingDetails: ${galleryMatch[1]}`);
              if (galleryMatch[1].startsWith('http')) {
                pictureURLs.push(galleryMatch[1]);
              }
            }
          }
        }
        
        // Strategy 4: Check the entire orderXml (Transaction level) for picture URLs
        if (pictureURLs.length === 0) {
          console.log(`  🔍 Searching entire orderXml for picture URLs...`);
          const orderPictureRegex = /<(?:PictureURL|GalleryURL)>([^<]*)<\/(?:PictureURL|GalleryURL)>/g;
          let orderPictureMatch;
          while ((orderPictureMatch = orderPictureRegex.exec(orderXml)) !== null) {
            const url = orderPictureMatch[1];
            if (url && url.startsWith('http')) {
              pictureURLs.push(url);
              console.log(`  ✅ Found picture URL in orderXml: ${url}`);
            }
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
        
        // For sold items, get EndTime from Transaction level (date sold)
        const endTimeMatch = orderXml.match(/<EndTime>([^<]*)<\/EndTime>/);
        const endTime = endTimeMatch ? endTimeMatch[1] : null;
        
        // Use endTime as startTime for display (shows "Date sold: [date]")
        const startTime = endTime;
        
        console.log(`📊 Sold Item ${itemId} price: ${currentPrice}, sold: ${endTime}, images: ${pictureURLs.length}`);

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
