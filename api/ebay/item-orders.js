/**
 * Fetch individual order/transaction details for a specific eBay item
 * Used when user wants to see breakdown of multiple sales for one item
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
    const userId = req.headers['x-user-id'] || null;
    const accessToken = req.headers['x-user-token'] || null;
    const itemId = req.query.itemId;
    
    if (!userId || !accessToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID required' });
    }

    console.log('🔍 Fetching order details for item:', itemId);

    // Determine which eBay API environment to use
    const ebayEnv = process.env.EBAY_ENV || 'production';
    const useProduction = ebayEnv === 'production';
    const tradingUrl = useProduction
      ? 'https://api.ebay.com/ws/api.dll'
      : 'https://api.sandbox.ebay.com/ws/api.dll';

    // Use GetOrders API filtered by item ID to get individual transactions
    const createTimeFrom = getDateDaysAgo(90);
    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <CreateTimeFrom>${createTimeFrom}</CreateTimeFrom>
  <OrderRole>Seller</OrderRole>
  <OrderStatus>Completed</OrderStatus>
  <Pagination>
    <EntriesPerPage>100</EntriesPerPage>
    <PageNumber>1</PageNumber>
  </Pagination>
  <DetailLevel>ReturnAll</DetailLevel>
</GetOrdersRequest>`;

    const response = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetOrders',
      },
      body: xmlRequest,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ eBay API error:', response.status, errorText);
      return res.status(response.status).json({ 
        error: 'Failed to fetch order details',
        details: errorText,
      });
    }

    const xmlText = await response.text();
    
    // Check for eBay API errors
    if (xmlText.includes('<Ack>Failure</Ack>')) {
      const errorCodeMatch = xmlText.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'unknown';
      
      if (errorCode === '932') {
        return res.status(401).json({
          error: 'eBay token expired',
          errorCode: 'TOKEN_EXPIRED',
          message: 'Your eBay connection has expired. Please reconnect your eBay account.',
        });
      }
    }

    // Parse XML and filter for this specific item ID
    const orders = parseOrdersForItem(xmlText, itemId);
    
    console.log(`✅ Found ${orders.length} orders for item ${itemId}`);

    return res.status(200).json({
      orders,
      itemId,
    });

  } catch (error) {
    console.error('❌ Error fetching item orders:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to fetch item orders',
      details: error.stack,
    });
  }
}

// Parse GetOrders XML response and filter for specific item ID
function parseOrdersForItem(xml, targetItemId) {
  const orders = [];
  
  // Extract OrderArray section
  const orderArrayMatch = xml.match(/<OrderArray>([\s\S]*?)<\/OrderArray>/);
  if (!orderArrayMatch) {
    return orders;
  }
  
  // Match all Order elements
  const orderRegex = /<Order>([\s\S]*?)<\/Order>/g;
  let orderMatch;

  while ((orderMatch = orderRegex.exec(orderArrayMatch[1])) !== null) {
    const orderXml = orderMatch[1];
    
    // Extract order-level fields
    const getField = (field) => {
      const match = orderXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
      return match ? match[1] : null;
    };
    
    const orderStatus = getField('OrderStatus');
    const orderId = getField('OrderID');
    const createdTime = getField('CreatedTime');
    const total = getField('Total');
    
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
      
      // Only include transactions for the target item
      if (itemId !== targetItemId) continue;
      
      const title = getItemField('Title');
      
      // Get quantity from transaction level
      const quantityMatch = transactionXml.match(/<QuantityPurchased>([^<]*)<\/QuantityPurchased>/);
      const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
      
      // Get price from transaction level
      const transPriceMatch = transactionXml.match(/<TransactionPrice[^>]*>([^<]+)<\/TransactionPrice>/);
      const transactionPrice = transPriceMatch ? parseFloat(transPriceMatch[1]) : 0;
      
      // Get transaction ID
      const transactionIdMatch = transactionXml.match(/<TransactionID>([^<]*)<\/TransactionID>/);
      const transactionId = transactionIdMatch ? transactionIdMatch[1] : null;
      
      // Get buyer info
      const buyerMatch = transactionXml.match(/<Buyer>([\s\S]*?)<\/Buyer>/);
      let buyerUsername = null;
      if (buyerMatch) {
        const userIdMatch = buyerMatch[1].match(/<UserID>([^<]*)<\/UserID>/);
        buyerUsername = userIdMatch ? userIdMatch[1] : null;
      }
      
      orders.push({
        orderId,
        transactionId,
        itemId,
        title,
        quantity,
        price: transactionPrice,
        dateSold: createdTime,
        buyerUsername,
        orderStatus,
        // Link to eBay order details page
        orderUrl: `https://www.ebay.com/sh/ord/?orderid=${orderId}`,
      });
    }
  }
  
  // Sort by date sold (newest first)
  orders.sort((a, b) => new Date(b.dateSold) - new Date(a.dateSold));
  
  return orders;
}
