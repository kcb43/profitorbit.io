/**
 * Import eBay items into user's inventory
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

// Fetch detailed item info from eBay Trading API
async function getItemDetails(itemId, accessToken) {
  const ebayEnv = process.env.EBAY_ENV || 'production';
  const tradingUrl = ebayEnv === 'production'
    ? 'https://api.ebay.com/ws/api.dll'
    : 'https://api.sandbox.ebay.com/ws/api.dll';

  // Build XML request for GetItem
  const xmlRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${itemId}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
</GetItemRequest>`;

  const response = await fetch(tradingUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml',
      'X-EBAY-API-SITEID': '0',
      'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
      'X-EBAY-API-CALL-NAME': 'GetItem',
    },
    body: xmlRequest,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Failed to fetch item ${itemId}:`, errorText);
    throw new Error(`Failed to fetch item ${itemId}`);
  }

  const xmlText = await response.text();
  return parseItemXML(xmlText);
}

// Parse GetItem XML response
function parseItemXML(xml) {
  const getField = (field) => {
    const match = xml.match(new RegExp(`<${field}>([^<]*)<\/${field}>`));
    return match ? match[1] : null;
  };

  // Helper to decode HTML entities
  const decodeHtmlEntities = (text) => {
    if (!text) return '';
    
    // IMPORTANT: Decode &amp; FIRST, then other entities
    // Because other entities might contain &amp; (e.g., &amp;lt; -> &lt; -> <)
    let decoded = text;
    
    // First pass: decode &amp; to &
    decoded = decoded.replace(/&amp;/g, '&');
    
    // Second pass: decode remaining entities
    const entities = {
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#39;': "'",
      '&apos;': "'",
      '&nbsp;': ' ',
      '&#160;': ' ',
    };
    
    for (const [entity, char] of Object.entries(entities)) {
      decoded = decoded.replace(new RegExp(entity, 'g'), char);
    }
    
    return decoded;
  };

  // Helper to strip HTML tags and format as plain text
  const stripHtmlTags = (html) => {
    if (!html) return '';
    
    // Decode HTML entities first
    let text = decodeHtmlEntities(html);
    
    // Replace common block elements with line breaks
    text = text.replace(/<\/?(p|div|br|h[1-6]|li)>/gi, '\n');
    
    // Remove all other HTML tags
    text = text.replace(/<[^>]+>/g, '');
    
    // Clean up multiple line breaks and trim
    text = text.replace(/\n\s*\n/g, '\n\n').trim();
    
    return text;
  };

  // Extract price with attribute handling
  const currentPriceMatch = xml.match(/<CurrentPrice[^>]*>([^<]+)<\/CurrentPrice>/);
  const startPriceMatch = xml.match(/<StartPrice[^>]*>([^<]+)<\/StartPrice>/);
  const price = parseFloat(currentPriceMatch?.[1] || startPriceMatch?.[1]) || 0;

  // Extract PictureURL fields
  const pictureURLs = [];
  const pictureRegex = /<PictureURL>([^<]*)<\/PictureURL>/g;
  let pictureMatch;
  while ((pictureMatch = pictureRegex.exec(xml)) !== null) {
    if (pictureMatch[1] && pictureMatch[1].startsWith('http')) {
      pictureURLs.push(pictureMatch[1]);
    }
  }

  // Extract description (handle CDATA and HTML)
  let description = '';
  const descMatch = xml.match(/<Description>(<!\[CDATA\[)?([\s\S]*?)(\]\]>)?<\/Description>/);
  if (descMatch) {
    const rawDescription = descMatch[2] || '';
    // Convert HTML to plain text
    description = stripHtmlTags(rawDescription);
  }

  // Extract primary category
  let categoryName = '';
  let categoryId = '';
  const primaryCategoryMatch = xml.match(/<PrimaryCategory>([\s\S]*?)<\/PrimaryCategory>/);
  if (primaryCategoryMatch) {
    const categoryXml = primaryCategoryMatch[1];
    const catNameMatch = categoryXml.match(/<CategoryName>([^<]*)<\/CategoryName>/);
    const catIdMatch = categoryXml.match(/<CategoryID>([^<]*)<\/CategoryID>/);
    categoryName = catNameMatch ? catNameMatch[1] : '';
    categoryId = catIdMatch ? catIdMatch[1] : '';
  }

  console.log(`📦 Parsed item:`, {
    itemId: getField('ItemID'),
    price,
    category: categoryName,
    hasDescription: description.length > 0,
    descriptionLength: description.length,
    imageCount: pictureURLs.length,
  });

  return {
    itemId: getField('ItemID'),
    title: getField('Title'),
    description,
    price,
    condition: getField('ConditionDisplayName') || 'USED',
    images: pictureURLs,
    quantity: parseInt(getField('Quantity')) || 1,
    sku: getField('SKU'),
    categoryName,
    categoryId,
  };
}

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id, X-User-Token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const accessToken = getEbayToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'eBay not connected. Please connect your eBay account first.' });
    }

    const { itemIds, itemsData } = req.body;

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ error: 'itemIds array is required' });
    }

    // itemsData is optional - contains full item details from my-listings endpoint (for sold items)
    const itemsDataMap = {};
    if (itemsData && Array.isArray(itemsData)) {
      console.log(`📦 Building itemsDataMap from ${itemsData.length} items...`);
      itemsData.forEach(item => {
        itemsDataMap[item.itemId] = item;
        console.log(`  Mapped: ${item.itemId} → ${item.title?.substring(0, 50)}`);
      });
      console.log(`✅ Built itemsDataMap with ${Object.keys(itemsDataMap).length} entries`);
    } else {
      console.log(`⚠️ No itemsData provided in request`);
    }

    let imported = 0;
    let failed = 0;
    const errors = [];
    const importedItems = []; // Track imported items with their IDs

    for (const itemId of itemIds) {
      try {
        console.log(`🔄 Importing item ${itemId}...`);
        
        // Check if we have full item data from my-listings (for sold items)
        let fullItemData = itemsDataMap[itemId];
        console.log(`🔍 Looking for itemId "${itemId}" in map:`, {
          found: !!fullItemData,
          mapKeys: Object.keys(itemsDataMap).slice(0, 5),
          totalMapEntries: Object.keys(itemsDataMap).length
        });
        
        const isSoldItem = fullItemData && fullItemData.status === 'Sold';
        console.log(`📊 Item status check:`, {
          hasFullItemData: !!fullItemData,
          status: fullItemData?.status,
          isSoldItem
        });
        
        // For sold items, fetch fresh transaction details directly from eBay API
        if (isSoldItem && fullItemData) {
          const originalItemId = fullItemData.originalItemId || fullItemData.itemId.split('-txn-')[0];
          const transactionId = fullItemData.transactionId;
          
          console.log(`🔄 Fetching transaction details for ${originalItemId}, txn ${transactionId}...`);
          
          try {
            const ebayEnv = process.env.EBAY_ENV || 'production';
            const tradingUrl = ebayEnv === 'production'
              ? 'https://api.ebay.com/ws/api.dll'
              : 'https://api.sandbox.ebay.com/ws/api.dll';
              
            const getItemTransactionsRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetItemTransactionsRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <ItemID>${originalItemId}</ItemID>
  <TransactionID>${transactionId}</TransactionID>
  <IncludeFinalValueFee>true</IncludeFinalValueFee>
</GetItemTransactionsRequest>`;

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
              console.log(`📄 GetItemTransactions XML response (first 2000 chars):`, xml.substring(0, 2000));
              
              // Parse Item block (at top level, NOT in Transaction)
              const itemMatch = xml.match(/<Item>([\s\S]*?)<\/Item>/);
              if (itemMatch) {
                const itemXml = itemMatch[1];
                const conditionMatch = itemXml.match(/<ConditionDisplayName>([^<]*)<\/ConditionDisplayName>/);
                fullItemData.itemCondition = conditionMatch ? conditionMatch[1] : null;
                console.log(`🏷️ Condition: ${fullItemData.itemCondition || 'NOT FOUND'}`);
                
                const locationMatch = itemXml.match(/<Location>([^<]*)<\/Location>/);
                fullItemData.itemLocation = locationMatch ? locationMatch[1] : null;
                console.log(`📍 Location: ${fullItemData.itemLocation || 'NOT FOUND'}`);
              } else {
                console.log(`⚠️ NO Item block found in XML response`);
              }
              
              // Parse Transaction block
              const txnMatch = xml.match(/<Transaction>([\s\S]*?)<\/Transaction>/);
              if (txnMatch) {
                const txnXml = txnMatch[1];
                console.log(`🔍 Found Transaction block, length: ${txnXml.length} chars`);
                
                // Parse quantity purchased
                const quantityMatch = txnXml.match(/<QuantityPurchased>([^<]*)<\/QuantityPurchased>/);
                fullItemData.quantitySold = quantityMatch ? parseInt(quantityMatch[1]) : (fullItemData.quantitySold || 1);
                console.log(`📊 Quantity Sold: ${fullItemData.quantitySold}`);
                
                // Shipping/Tracking Info
                const shippingDetailsMatch = txnXml.match(/<ShippingDetails>([\s\S]*?)<\/ShippingDetails>/);
                if (shippingDetailsMatch) {
                  const shippingXml = shippingDetailsMatch[1];
                  console.log(`🚚 Found ShippingDetails block, length: ${shippingXml.length} chars`);
                  
                  const trackingMatch = shippingXml.match(/<ShipmentTrackingNumber>([^<]*)<\/ShipmentTrackingNumber>/);
                  fullItemData.trackingNumber = trackingMatch ? trackingMatch[1] : null;
                  console.log(`📦 Tracking: ${fullItemData.trackingNumber || 'NOT FOUND'}`);
                  
                  const carrierMatch = shippingXml.match(/<ShippingCarrierUsed>([^<]*)<\/ShippingCarrierUsed>/);
                  fullItemData.shippingCarrier = carrierMatch ? carrierMatch[1] : null;
                  console.log(`🚢 Carrier: ${fullItemData.shippingCarrier || 'NOT FOUND'}`);
                  
                  // Try multiple delivery date fields
                  let deliveryMatch = shippingXml.match(/<ActualDeliveryTime>([^<]*)<\/ActualDeliveryTime>/);
                  if (!deliveryMatch) {
                    deliveryMatch = shippingXml.match(/<DeliveryDate>([^<]*)<\/DeliveryDate>/);
                  }
                  if (!deliveryMatch) {
                    // Check outside ShippingDetails in Status/ShipmentTracking
                    const shipTrackingMatch = txnXml.match(/<ShipmentTrackingDetails>([\s\S]*?)<\/ShipmentTrackingDetails>/);
                    if (shipTrackingMatch) {
                      deliveryMatch = shipTrackingMatch[1].match(/<ShipmentDeliveryDate>([^<]*)<\/ShipmentDeliveryDate>/);
                      if (!deliveryMatch) {
                        deliveryMatch = shipTrackingMatch[1].match(/<DeliveryDate>([^<]*)<\/DeliveryDate>/);
                      }
                    }
                  }
                  fullItemData.deliveryDate = deliveryMatch ? deliveryMatch[1] : null;
                  console.log(`📅 Delivery: ${fullItemData.deliveryDate || '(Not yet delivered)'}`);
                } else {
                  console.log(`⚠️ NO ShippingDetails block found in transaction XML`);
                }
                
                const shippedTimeMatch = txnXml.match(/<ShippedTime>([^<]*)<\/ShippedTime>/);
                fullItemData.shippedDate = shippedTimeMatch ? shippedTimeMatch[1] : null;
                console.log(`📅 Shipped: ${fullItemData.shippedDate || 'NOT FOUND'}`);
                
                // Buyer Address
                const buyerMatch = txnXml.match(/<Buyer>([\s\S]*?)<\/Buyer>/);
                if (buyerMatch) {
                  const buyerXml = buyerMatch[1];
                  const addressMatch = buyerXml.match(/<ShippingAddress>([\s\S]*?)<\/ShippingAddress>/);
                  if (addressMatch) {
                    const addrXml = addressMatch[1];
                    const getName = (field) => {
                      const m = addrXml.match(new RegExp(`<${field}>([^<]*)<\\/${field}>`));
                      return m ? m[1] : '';
                    };
                    
                    fullItemData.buyerAddress = {
                      name: getName('Name'),
                      street1: getName('Street1'),
                      street2: getName('Street2'),
                      city: getName('CityName'),
                      state: getName('StateOrProvince'),
                      zip: getName('PostalCode'),
                      country: getName('CountryName'),
                      phone: getName('Phone'),
                    };
                    console.log(`👤 Buyer Address: ${fullItemData.buyerAddress.name}, ${fullItemData.buyerAddress.city}`);
                  } else {
                    console.log(`⚠️ NO ShippingAddress found in Buyer block`);
                  }
                } else {
                  console.log(`⚠️ NO Buyer block found in transaction XML`);
                }
                
                // Payment Info - check multiple possible locations
                const statusMatch = txnXml.match(/<Status>([\s\S]*?)<\/Status>/);
                if (statusMatch) {
                  const statusXml = statusMatch[1];
                  const paymentStatusMatch = statusXml.match(/<eBayPaymentStatus>([^<]*)<\/eBayPaymentStatus>/);
                  fullItemData.paymentStatus = paymentStatusMatch ? paymentStatusMatch[1] : null;
                  console.log(`💳 Payment Status: ${fullItemData.paymentStatus || 'NOT FOUND'}`);
                }
                
                // Payment method can be in multiple places
                let paymentMethodMatch = txnXml.match(/<PaymentMethod>([^<]*)<\/PaymentMethod>/);
                if (!paymentMethodMatch) {
                  // Try ExternalTransaction block
                  const extTxnMatch = txnXml.match(/<ExternalTransaction>([\s\S]*?)<\/ExternalTransaction>/);
                  if (extTxnMatch) {
                    paymentMethodMatch = extTxnMatch[1].match(/<PaymentOrRefundMethod>([^<]*)<\/PaymentOrRefundMethod>/);
                  }
                }
                fullItemData.paymentMethod = paymentMethodMatch ? paymentMethodMatch[1] : null;
                console.log(`💳 Payment Method: ${fullItemData.paymentMethod || 'NOT FOUND'}`);
                
                // Try multiple date fields
                let paidTimeMatch = txnXml.match(/<PaidTime>([^<]*)<\/PaidTime>/);
                if (!paidTimeMatch) {
                  paidTimeMatch = txnXml.match(/<PaymentTime>([^<]*)<\/PaymentTime>/);
                }
                if (!paidTimeMatch) {
                  paidTimeMatch = txnXml.match(/<CreatedDate>([^<]*)<\/CreatedDate>/);
                }
                fullItemData.paymentDate = paidTimeMatch ? paidTimeMatch[1] : null;
                console.log(`💳 Payment Date: ${fullItemData.paymentDate || 'NOT FOUND'}`);
                
                // Buyer Notes
                const buyerNotesMatch = txnXml.match(/<BuyerCheckoutMessage>([^<]*)<\/BuyerCheckoutMessage>/);
                fullItemData.buyerNotes = buyerNotesMatch ? buyerNotesMatch[1] : null;
                console.log(`📝 Buyer Notes: ${fullItemData.buyerNotes || 'NONE'}`);
                
                console.log(`✅ Fetched transaction details for ${originalItemId}`);
                console.log(`🔍 Final fullItemData fields:`, {
                  trackingNumber: fullItemData.trackingNumber,
                  shippingCarrier: fullItemData.shippingCarrier,
                  deliveryDate: fullItemData.deliveryDate,
                  shippedDate: fullItemData.shippedDate,
                  itemCondition: fullItemData.itemCondition,
                  buyerAddress: !!fullItemData.buyerAddress,
                  itemLocation: fullItemData.itemLocation,
                  paymentMethod: fullItemData.paymentMethod,
                  paymentStatus: fullItemData.paymentStatus,
                  paymentDate: fullItemData.paymentDate,
                  buyerNotes: fullItemData.buyerNotes,
                });
              } else {
                console.log(`⚠️ NO Transaction block found in XML response`);
              }
            } else {
              console.warn(`⚠️ GetItemTransactions API returned ${response.status}`);
            }
            
            // ALSO fetch order-level details (delivery date, funds status, payment method)
            if (fullItemData.orderId) {
              console.log(`🔄 Fetching order details for order ${fullItemData.orderId}...`);
              
              const getOrdersRequest = `<?xml version="1.0" encoding="utf-8"?>
<GetOrdersRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${accessToken}</eBayAuthToken>
  </RequesterCredentials>
  <OrderIDArray>
    <OrderID>${fullItemData.orderId}</OrderID>
  </OrderIDArray>
  <IncludeFinalValueFee>true</IncludeFinalValueFee>
</GetOrdersRequest>`;

              const orderResponse = await fetch(tradingUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'text/xml',
                  'X-EBAY-API-SITEID': '0',
                  'X-EBAY-API-COMPATIBILITY-LEVEL': '967',
                  'X-EBAY-API-CALL-NAME': 'GetOrders',
                },
                body: getOrdersRequest,
              });
              
              if (orderResponse.ok) {
                const orderXml = await orderResponse.text();
                console.log(`📄 GetOrders XML response (first 5000 chars):`, orderXml.substring(0, 5000));
                
                // Parse order-level data
                const orderMatch = orderXml.match(/<Order>([\s\S]*?)<\/Order>/);
                if (orderMatch) {
                  const orderBlock = orderMatch[1];
                  console.log(`🔍 Found Order block, length: ${orderBlock.length} chars`);
                  
                  // Delivery Date - multiple possible locations
                  let deliveryMatch = orderBlock.match(/<DeliveredDate>([^<]*)<\/DeliveredDate>/);
                  if (!deliveryMatch) {
                    deliveryMatch = orderBlock.match(/<ActualDeliveryTime>([^<]*)<\/ActualDeliveryTime>/);
                  }
                  if (!deliveryMatch) {
                    const shipmentMatch = orderBlock.match(/<ShippingDetails>([\s\S]*?)<\/ShippingDetails>/);
                    if (shipmentMatch) {
                      const shipmentXml = shipmentMatch[1];
                      deliveryMatch = shipmentXml.match(/<DeliveryDate>([^<]*)<\/DeliveryDate>/);
                      if (!deliveryMatch) {
                        const trackingMatch = shipmentXml.match(/<ShipmentTrackingDetails>([\s\S]*?)<\/ShipmentTrackingDetails>/);
                        if (trackingMatch) {
                          deliveryMatch = trackingMatch[1].match(/<ShipmentDeliveryDate>([^<]*)<\/ShipmentDeliveryDate>/);
                        }
                      }
                    }
                  }
                  if (deliveryMatch) {
                    fullItemData.deliveryDate = deliveryMatch[1];
                    console.log(`✅ Delivery Date: ${fullItemData.deliveryDate}`);
                  } else {
                    console.log(`⚠️ Delivery Date: NOT FOUND`);
                  }
                  
                  // CheckoutStatus block - has payment info AND status
                  const checkoutMatch = orderBlock.match(/<CheckoutStatus>([\s\S]*?)<\/CheckoutStatus>/);
                  if (checkoutMatch) {
                    const checkoutXml = checkoutMatch[1];
                    console.log(`🔍 Found CheckoutStatus block: ${checkoutXml.substring(0, 500)}`);
                    
                    // Payment Method from CheckoutStatus
                    const methodMatch = checkoutXml.match(/<PaymentMethod>([^<]*)<\/PaymentMethod>/);
                    if (methodMatch) {
                      fullItemData.paymentMethod = methodMatch[1];
                      console.log(`✅ Payment Method: ${fullItemData.paymentMethod}`);
                    }
                    
                    // Payment Status (eBayPaymentStatus) from CheckoutStatus
                    const paymentStatusMatch = checkoutXml.match(/<eBayPaymentStatus>([^<]*)<\/eBayPaymentStatus>/);
                    if (paymentStatusMatch) {
                      // Map eBay status to user-friendly name
                      const statusMap = {
                        'NoPaymentFailure': 'Paid',
                        'PaymentFailed': 'Failed',
                        'BuyerECheckBounced': 'Bounced',
                        'BuyerFailedPaymentReportedBySeller': 'Failed',
                        'PayPalPaymentInProcess': 'Processing'
                      };
                      fullItemData.paymentStatus = statusMap[paymentStatusMatch[1]] || paymentStatusMatch[1];
                      console.log(`✅ Payment Status: ${fullItemData.paymentStatus} (raw: ${paymentStatusMatch[1]})`);
                    }
                    
                    // Order Status (Complete, Cancelled, etc) - use this as "Funds Status"
                    const orderStatusMatch = checkoutXml.match(/<Status>([^<]*)<\/Status>/);
                    if (orderStatusMatch) {
                      fullItemData.fundsStatus = orderStatusMatch[1];
                      console.log(`✅ Funds Status (Order Status): ${fullItemData.fundsStatus}`);
                    }
                  } else {
                    console.log(`⚠️ NO CheckoutStatus block found`);
                  }
                  
                  // Also check for MonetaryDetails (payout info)
                  const monetaryMatch = orderBlock.match(/<MonetaryDetails>([\s\S]*?)<\/MonetaryDetails>/);
                  if (monetaryMatch) {
                    console.log(`💰 Found MonetaryDetails block: ${monetaryMatch[1].substring(0, 500)}`);
                    // Could parse payout status here if needed
                  }
                  
                  console.log(`✅ Fetched order-level details for ${fullItemData.orderId}`);
                } else {
                  console.log(`⚠️ NO Order block found in GetOrders response`);
                }
              } else {
                console.warn(`⚠️ GetOrders API returned ${orderResponse.status}`);
              }
            }
          } catch (fetchError) {
            console.error(`⚠️ Failed to fetch transaction/order details:`, fetchError);
          }
        }
        
        let itemDetails;
        
        if (isSoldItem && fullItemData) {
          // For sold items, we already have the data - no need to call eBay API
          // Use originalItemId for the actual eBay item ID
          const actualEbayItemId = fullItemData.originalItemId || fullItemData.itemId;
          
          console.log(`📦 Using cached sold item data for ${actualEbayItemId} (transaction ${fullItemData.transactionId})`);
          console.log(`📦 Full item data:`, {
            originalItemId: fullItemData.originalItemId,
            itemId: fullItemData.itemId,
            title: fullItemData.title?.substring(0, 50),
            hasImages: !!fullItemData.images,
            imagesType: Array.isArray(fullItemData.images) ? 'array' : typeof fullItemData.images,
            pictureURLs: fullItemData.pictureURLs,
          });
          
          // Use pictureURLs if images is not an array
          const itemImages = Array.isArray(fullItemData.images) 
            ? fullItemData.images 
            : (fullItemData.pictureURLs || []);
          
          itemDetails = {
            itemId: actualEbayItemId,
            title: fullItemData.title,
            description: fullItemData.description || '',
            price: fullItemData.price,
            condition: fullItemData.itemCondition || fullItemData.condition,
            images: itemImages,
            quantity: 1,
            sku: fullItemData.sku || null,
          };
          
          console.log(`✅ Built itemDetails:`, {
            itemId: itemDetails.itemId,
            title: itemDetails.title?.substring(0, 50),
            imagesCount: itemDetails.images?.length || 0,
          });
        } else {
          // For active items, fetch from eBay API
          itemDetails = await getItemDetails(itemId, accessToken);
        }

        if (!itemDetails || !itemDetails.itemId) {
          const error = 'Failed to parse item data';
          failed++;
          errors.push({ itemId, error });
          console.error(`❌ ${itemId}: ${error}`);
          continue;
        }

        console.log(`💾 Checking for existing inventory item...`);
        console.log(`🔍 Item details:`, {
          itemId: itemDetails.itemId,
          title: itemDetails.title,
          isSoldItem,
        });

        // Check if inventory item already exists (by eBay item ID)
        let inventoryId = null;
        let isExistingItem = false;
        
        const { data: existingItem, error: searchError } = await supabase
          .from('inventory_items')
          .select('id, item_name, status')
          .eq('user_id', userId)
          .eq('ebay_item_id', itemDetails.itemId)
          .is('deleted_at', null)
          .maybeSingle();
        
        if (searchError) {
          console.error(`❌ Error searching for existing inventory:`, searchError);
        }
        
        if (existingItem) {
          inventoryId = existingItem.id;
          isExistingItem = true;
          console.log(`✅ Found existing inventory item: ${existingItem.item_name} (ID: ${inventoryId})`);
          
          // If it's a sold item, update the inventory status to 'sold'
          if (isSoldItem && existingItem.status !== 'sold') {
            const { error: updateError } = await supabase
              .from('inventory_items')
              .update({ status: 'sold' })
              .eq('id', inventoryId);
            
            if (updateError) {
              console.error(`⚠️ Failed to update inventory status to sold:`, updateError);
            } else {
              console.log(`✅ Updated inventory item status to 'sold'`);
            }
          }
        } else {
          // Create new inventory item
          console.log(`💾 Creating new inventory item...`);
          
          const { data: insertData, error: insertError } = await supabase
            .from('inventory_items')
            .insert({
              user_id: userId,
              item_name: itemDetails.title,
              description: itemDetails.description,
              purchase_price: itemDetails.price,
              listing_price: itemDetails.price,
              status: isSoldItem ? 'sold' : 'listed',
              source: 'eBay',
              images: itemDetails.images,
              image_url: itemDetails.images[0] || null,
              sku: itemDetails.sku,
              ebay_item_id: itemDetails.itemId,
              condition: itemDetails.condition,
              purchase_date: new Date().toISOString(),
              quantity: itemDetails.quantity || 1,
              notes: null,
            })
            .select('id')
            .single();

          if (insertError) {
            failed++;
            const errorMsg = insertError.message;
            errors.push({ itemId, error: errorMsg });
            console.error(`❌ Failed to import item ${itemId}:`, insertError);
            continue;
          }
          
          inventoryId = insertData.id;
          console.log(`✅ Created new inventory item with ID ${inventoryId}`);
        }

        imported++;
        const importResult = {
          itemId,
          inventoryId,
          isExistingItem, // Flag to show if it was a duplicate
        };
        
        // If this is a sold item, also create a sale record
        if (isSoldItem && fullItemData) {
          try {
            console.log(`📊 Creating sale record for sold item ${itemId}...`);
            console.log(`🔍 eBay fields being saved:`, {
              trackingNumber: fullItemData.trackingNumber,
              shippingCarrier: fullItemData.shippingCarrier,
              deliveryDate: fullItemData.deliveryDate,
              shippedDate: fullItemData.shippedDate,
              itemCondition: fullItemData.itemCondition,
              buyerAddress: fullItemData.buyerAddress,
              paymentMethod: fullItemData.paymentMethod,
              orderId: fullItemData.orderId,
              transactionId: fullItemData.transactionId,
              quantitySold: fullItemData.quantitySold,
            });
            
            // Check for existing sales of this inventory item to create/use sale group
            let saleGroupId = null;
            if (inventoryId) {
              const { data: existingSales } = await supabase
                .from('sales')
                .select('sale_group_id')
                .eq('inventory_id', inventoryId)
                .not('sale_group_id', 'is', null)
                .limit(1);
              
              if (existingSales && existingSales.length > 0) {
                saleGroupId = existingSales[0].sale_group_id;
                console.log(`🔗 Linking sale to existing group: ${saleGroupId}`);
              } else {
                // Check if there are any sales for this inventory item (to create a new group)
                const { data: allSales } = await supabase
                  .from('sales')
                  .select('id')
                  .eq('inventory_id', inventoryId);
                
                if (allSales && allSales.length > 0) {
                  // Generate a new group ID for all sales of this item
                  const { data: newGroup } = await supabase.rpc('gen_random_uuid');
                  saleGroupId = newGroup;
                  console.log(`🆕 Creating new sale group: ${saleGroupId} (${allSales.length} existing sales)`);
                  
                  // Update existing sales to use this group
                  await supabase
                    .from('sales')
                    .update({ sale_group_id: saleGroupId })
                    .eq('inventory_id', inventoryId);
                  
                  console.log(`✅ Updated ${allSales.length} existing sales with group ID`);
                }
              }
            }
            
            const { data: saleData, error: saleError } = await supabase
              .from('sales')
              .insert({
                user_id: userId,
                inventory_id: inventoryId,
                item_name: fullItemData.title || itemDetails.title,
                sale_price: fullItemData.price,
                sale_date: fullItemData.dateSold || new Date().toISOString(),
                platform: 'ebay', // Lowercase to match platformOptions
                shipping_cost: fullItemData.shippingCost || 0,
                platform_fees: fullItemData.finalValueFee || 0,
                vat_fees: fullItemData.salesTax || 0,
                profit: fullItemData.netPayout || (fullItemData.price - (fullItemData.finalValueFee || 0)),
                image_url: fullItemData.images?.[0] || itemDetails.images?.[0] || null,
                quantity_sold: fullItemData.quantitySold || 1,
                sale_group_id: saleGroupId,
                // Fully displayed fields
                tracking_number: fullItemData.trackingNumber,
                shipping_carrier: fullItemData.shippingCarrier,
                delivery_date: fullItemData.deliveryDate,
                shipped_date: fullItemData.shippedDate,
                item_condition: fullItemData.itemCondition || itemDetails.condition,
                funds_status: fullItemData.fundsStatus,
                // Hidden fields
                buyer_address: fullItemData.buyerAddress,
                payment_method: fullItemData.paymentMethod,
                payment_status: fullItemData.paymentStatus,
                payment_date: fullItemData.paymentDate,
                item_location: fullItemData.itemLocation,
                buyer_notes: fullItemData.buyerNotes,
                // eBay identifiers
                ebay_order_id: fullItemData.orderId,
                ebay_transaction_id: fullItemData.transactionId,
                ebay_buyer_username: fullItemData.buyerUsername,
              })
              .select('id')
              .single();
            
            if (saleError) {
              console.error(`⚠️ Failed to create sale record for ${itemId}:`, saleError);
            } else {
              console.log(`✅ Created sale record for ${itemId} with ID ${saleData.id}`);
              importResult.saleId = saleData.id; // Add sale ID to result
            }
          } catch (saleErr) {
            console.error(`⚠️ Error creating sale record for ${itemId}:`, saleErr);
          }
        }
        
        importedItems.push(importResult);
        console.log(`✅ Successfully imported item ${itemId} with inventory ID ${inventoryId}${isExistingItem ? ' (linked to existing inventory)' : ''}`);
      } catch (error) {
        failed++;
        const errorMsg = error.message;
        errors.push({ itemId, error: errorMsg });
        console.error(`❌ Error importing item ${itemId}:`, error);
      }
    }

    console.log(`📊 Import summary: ${imported} imported, ${failed} failed`);
    
    // Count duplicates
    const duplicateCount = importedItems.filter(item => item.isExistingItem).length;

    // Check for potential duplicates for newly imported items
    console.log(`🔍 Checking for potential duplicates across ${importedItems.length} imported items...`);
    const duplicateMatches = {};
    
    for (const importedItem of importedItems) {
      // Only check for duplicates if this was a new import (not existing)
      if (!importedItem.isExistingItem && importedItem.inventoryId) {
        try {
          console.log(`  🔍 Fetching imported item ${importedItem.inventoryId} for duplicate check...`);
          const { data: inventoryItem, error: fetchError } = await supabase
            .from('inventory_items')
            .select('item_name, ebay_item_id, purchase_price, purchase_date, image_url, images')
            .eq('id', importedItem.inventoryId)
            .single();
          
          if (fetchError) {
            console.error(`  ❌ Error fetching imported item:`, fetchError);
            continue;
          }
          
          if (!inventoryItem) {
            console.warn(`  ⚠️ Imported item not found in database: ${importedItem.inventoryId}`);
            continue;
          }
          
          console.log(`  ✅ Found imported item: "${inventoryItem.item_name}"`);
          
          // Check for existing links to this item (to avoid duplicate detection on already-linked items)
          const { data: existingLinks, error: linkError } = await supabase
            .from('item_links')
            .select('linked_item_id')
            .eq('user_id', userId)
            .eq('primary_item_id', importedItem.inventoryId);
          
          const linkedItemIds = new Set(existingLinks?.map(link => link.linked_item_id) || []);
          console.log(`  🔗 Found ${linkedItemIds.size} already-linked items (will skip these in duplicate detection)`);
          
          // Check for duplicates
          // NOTE: facebook_item_id and mercari_item_id might not exist if migration hasn't run
          // Use basic fields that always exist for duplicate detection
          const { data: potentialDuplicates, error: dupQueryError } = await supabase
            .from('inventory_items')
            .select('id, item_name, purchase_price, purchase_date, status, source, image_url, images, ebay_item_id, quantity, created_at, description, brand, size, condition')
            .eq('user_id', userId)
            .neq('id', importedItem.inventoryId)
            .is('deleted_at', null);
          
          if (dupQueryError) {
            console.error(`  ❌ Error querying for duplicates:`, dupQueryError);
            continue;
          }
          
          // Filter out already-linked items
          const unlinkedDuplicates = potentialDuplicates?.filter(dup => !linkedItemIds.has(dup.id)) || [];
          
          console.log(`  🔍 Found ${potentialDuplicates?.length || 0} existing items (${unlinkedDuplicates.length} unlinked) to compare against`);
          
          if (unlinkedDuplicates && unlinkedDuplicates.length > 0) {
            const importedTitle = inventoryItem.item_name.toLowerCase();
            const importedWords = importedTitle.split(/\s+/).filter(w => w.length > 2);
            
            console.log(`  📝 Imported title: "${inventoryItem.item_name}" (${importedWords.length} words: ${importedWords.join(', ')})`);
            
            const matches = unlinkedDuplicates
              .map(dup => {
                const dupTitle = dup.item_name.toLowerCase();
                const dupWords = dupTitle.split(/\s+/).filter(w => w.length > 2);
                
                // Calculate word overlap (key words that match)
                const importedSet = new Set(importedWords);
                const dupSet = new Set(dupWords);
                const commonWords = [...importedSet].filter(w => dupSet.has(w));
                
                // Calculate similarity percentage
                const maxWords = Math.max(importedSet.size, dupSet.size);
                const similarity = maxWords > 0 ? (commonWords.length / maxWords) * 100 : 0;
                
                console.log(`  📊 Comparing vs "${dup.item_name}": ${similarity.toFixed(1)}% similarity (${commonWords.length}/${maxWords} words: [${commonWords.join(', ')}])`);
                
                return { ...dup, similarity };
              })
              .filter(dup => dup.similarity >= 40) // Lower threshold: 40% similarity
              .sort((a, b) => b.similarity - a.similarity)
              .slice(0, 5); // Top 5 matches
            
            console.log(`  🎯 Matches above 40% threshold: ${matches.length}`);
            
            if (matches.length > 0) {
              // Include the imported item details for the dialog
              duplicateMatches[importedItem.inventoryId] = {
                importedItem: {
                  id: importedItem.inventoryId,
                  item_name: inventoryItem.item_name,
                  purchase_price: inventoryItem.purchase_price,
                  purchase_date: inventoryItem.purchase_date,
                  image_url: inventoryItem.image_url,
                  images: inventoryItem.images,
                  source: 'eBay',
                  ebay_item_id: inventoryItem.ebay_item_id,
                },
                matches: matches,
              };
              console.log(`  ✅ Found ${matches.length} potential duplicates for "${inventoryItem.item_name}"`);
              console.log(`     Top match: "${matches[0].item_name}" (${matches[0].similarity.toFixed(1)}% similar)`);
            } else {
              console.log(`  ℹ️ No duplicates found above 40% threshold for "${inventoryItem.item_name}"`);
            }
          } else {
            console.log(`  ℹ️ No existing items in inventory to compare against`);
          }
        } catch (dupError) {
          console.error(`⚠️ Error checking duplicates for item ${importedItem.inventoryId}:`, dupError);
        }
      } else {
        console.log(`  ⏭️ Skipping duplicate check for item ${importedItem.itemId} (isExisting: ${importedItem.isExistingItem})`);
      }
    }

    return res.status(200).json({
      imported,
      failed,
      duplicates: duplicateCount,
      errors: failed > 0 ? errors : undefined,
      importedItems, // Return the mapping of itemId to inventoryId (includes isExistingItem flag)
      potentialDuplicates: Object.keys(duplicateMatches).length > 0 ? duplicateMatches : undefined,
    });

  } catch (error) {
    console.error('Error importing eBay items:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to import eBay items' 
    });
  }
}
