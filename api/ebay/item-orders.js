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

    // Use GetItemTransactions API to get individual sales for this specific item
    // This is more reliable than GetOrders for item-level transaction data
    const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <NumberOfDays>90</NumberOfDays>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemTransactionsRequest>`;

    const response = await fetch(tradingUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml',
        'X-EBAY-API-SITEID': '0',
        'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
        'X-EBAY-API-CALL-NAME': 'GetItemTransactions',
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
    
    console.log('📡 Raw XML response length:', xmlText.length);
    
    // Log the actual XML to see what eBay is returning
    if (xmlText.length < 2000) {
      console.log('📄 Full XML response:', xmlText);
    } else {
      console.log('📄 XML response preview (first 1500 chars):', xmlText.substring(0, 1500));
    }
    
    // Check for eBay API errors
    if (xmlText.includes('<Ack>Failure</Ack>') || xmlText.includes('<Ack>Warning</Ack>')) {
      const errorCodeMatch = xmlText.match(/<ErrorCode>([^<]+)<\/ErrorCode>/);
      const shortMsgMatch = xmlText.match(/<ShortMessage>([^<]+)<\/ShortMessage>/);
      const longMsgMatch = xmlText.match(/<LongMessage>([^<]+)<\/LongMessage>/);
      
      const errorCode = errorCodeMatch ? errorCodeMatch[1] : 'unknown';
      const shortMessage = shortMsgMatch ? shortMsgMatch[1] : 'Unknown error';
      const longMessage = longMsgMatch ? longMsgMatch[1] : shortMessage;
      
      console.error('⚠️ eBay API returned error/warning:', { errorCode, shortMessage, longMessage });
      
      if (errorCode === '932') {
        return res.status(401).json({
          error: 'eBay token expired',
          errorCode: 'TOKEN_EXPIRED',
          message: 'Your eBay connection has expired. Please reconnect your eBay account.',
        });
      }
      
      // Return the error to frontend so user sees what eBay said
      return res.status(400).json({
        error: `eBay API error: ${shortMessage}`,
        errorCode,
        message: longMessage,
        details: 'eBay could not return transaction data for this item',
      });
    }

    // Parse XML to get transactions for this item
    const transactions = parseItemTransactions(xmlText, itemId);
    
    console.log(`✅ Found ${transactions.length} transactions for item ${itemId}`);

    return res.status(200).json({
      orders: transactions,
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

// Parse GetItemTransactions XML response
function parseItemTransactions(xml, targetItemId) {
  const transactions = [];
  
  console.log(`🔍 Parsing transactions for item: ${targetItemId}`);
  
  // Extract TransactionArray section
  const transactionArrayMatch = xml.match(/<TransactionArray>([\s\S]*?)<\/TransactionArray>/);
  if (!transactionArrayMatch) {
    console.log('⚠️ No TransactionArray found in response');
    // Check for pagination info to see if there are just no transactions
    const paginationMatch = xml.match(/<PaginationResult>([\s\S]*?)<\/PaginationResult>/);
    if (paginationMatch) {
      console.log('📊 Pagination info:', paginationMatch[1].substring(0, 200));
    }
    return transactions;
  }
  
  console.log('✅ TransactionArray found, parsing transactions...');
  
  // Match all Transaction elements
  const transactionRegex = /<Transaction>([\s\S]*?)<\/Transaction>/g;
  let transactionMatch;
  let transactionCount = 0;

  while ((transactionMatch = transactionRegex.exec(transactionArrayMatch[1])) !== null) {
    transactionCount++;
    const transactionXml = transactionMatch[1];
    
    // Extract fields with regex
    const getField = (field) => {
      const match = transactionXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
      return match ? match[1] : null;
    };
    
    // Get transaction-level fields
    const transactionId = getField('TransactionID');
    const createdDate = getField('CreatedDate');
    const quantityPurchased = getField('QuantityPurchased');
    
    // Get price from TransactionPrice
    const transPriceMatch = transactionXml.match(/<TransactionPrice[^>]*>([^<]+)<\/TransactionPrice>/);
    const transactionPrice = transPriceMatch ? parseFloat(transPriceMatch[1]) : 0;
    
    // Get buyer info
    const buyerMatch = transactionXml.match(/<Buyer>([\s\S]*?)<\/Buyer>/);
    let buyerUsername = null;
    if (buyerMatch) {
      const userIdMatch = buyerMatch[1].match(/<UserID>([^<]*)<\/UserID>/);
      buyerUsername = userIdMatch ? userIdMatch[1] : null;
    }
    
    // Get order ID if available (transactions may be part of an order)
    const containingOrderMatch = transactionXml.match(/<ContainingOrder>([\s\S]*?)<\/ContainingOrder>/);
    let orderId = null;
    if (containingOrderMatch) {
      const orderIdMatch = containingOrderMatch[1].match(/<OrderID>([^<]*)<\/OrderID>/);
      orderId = orderIdMatch ? orderIdMatch[1] : null;
    }
    
    // Get status
    const statusMatch = transactionXml.match(/<Status>([\s\S]*?)<\/Status>/);
    let status = 'Complete';
    if (statusMatch) {
      const completeMatch = statusMatch[1].match(/<eBayPaymentStatus>([^<]*)<\/eBayPaymentStatus>/);
      status = completeMatch ? completeMatch[1] : 'Complete';
    }
    
    console.log(`  📦 Transaction ${transactionCount}: ID=${transactionId}, Date=${createdDate}, Qty=${quantityPurchased}, Price=$${transactionPrice}, Buyer=${buyerUsername}`);
    
    transactions.push({
      orderId: orderId || `TXN-${transactionId}`,
      transactionId,
      itemId: targetItemId,
      title: '', // We don't need title since it's the same item
      quantity: parseInt(quantityPurchased) || 1,
      price: transactionPrice,
      dateSold: createdDate,
      buyerUsername,
      orderStatus: status,
      // Link to eBay order details page (if we have an order ID)
      orderUrl: orderId 
        ? `https://www.ebay.com/sh/ord/?orderid=${orderId}`
        : `https://www.ebay.com/sh/fin/transactions`, // Fallback to transactions page
    });
  }
  
  console.log(`📊 Parsed ${transactionCount} transactions`);
  
  // Sort by date sold (newest first)
  transactions.sort((a, b) => new Date(b.dateSold) - new Date(a.dateSold));
  
  return transactions;
}
