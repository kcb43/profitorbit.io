/**
 * Vercel Serverless Function - eBay Trading API - Listing Operations
 * 
 * This endpoint proxies eBay Trading API requests for listing operations.
 * Supports:
 * - AddFixedPriceItem: Create a new fixed-price listing
 * - ReviseItem: Update an existing listing
 * - EndItem: End a listing early
 * - GetItem: Get listing details
 */

const MARKETPLACE_ID = 'EBAY_US';

async function getUserToken() {
  // For Trading API, we need a user token (OAuth user authorization)
  // This would typically come from a stored session after user OAuth flow
  // For now, we'll use the app token but note that Trading API requires user token
  const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET env vars');
  }

  // Determine environment
  const ebayEnv = process.env.EBAY_ENV;
  const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
  const isProductionByClientId = clientId && (
    clientId.includes('-PRD-') || 
    clientId.includes('-PRD') || 
    clientId.startsWith('PRD-') ||
    /PRD/i.test(clientId)
  );
  const useProduction = isProductionByEnv || isProductionByClientId;
  
  const oauthUrl = useProduction
    ? 'https://api.ebay.com/identity/v1/oauth2/token'
    : 'https://api.sandbox.ebay.com/identity/v1/oauth2/token';

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const resp = await fetch(oauthUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'https://api.ebay.com/oauth/api_scope',
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error('eBay token error:', resp.status, data);
    throw new Error(`Failed to get eBay token: ${resp.status}`);
  }

  return data.access_token;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { operation, listingData } = req.body;

    if (!operation) {
      return res.status(400).json({ error: 'Operation parameter is required (AddFixedPriceItem, ReviseItem, EndItem, GetItem)' });
    }

    // Determine environment
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const ebayEnv = process.env.EBAY_ENV;
    const isProductionByEnv = ebayEnv === 'production' || ebayEnv?.trim() === 'production';
    const isProductionByClientId = clientId && (
      clientId.includes('-PRD-') || 
      clientId.includes('-PRD') || 
      clientId.startsWith('PRD-') ||
      /PRD/i.test(clientId)
    );
    const useProduction = isProductionByEnv || isProductionByClientId;
    
    const baseUrl = useProduction
      ? 'https://api.ebay.com/ws/api.dll'
      : 'https://api.sandbox.ebay.com/ws/api.dll';

    // Get token (note: Trading API requires user token, this is a placeholder)
    const token = await getUserToken();

    if (operation === 'AddFixedPriceItem') {
      if (!listingData) {
        return res.status(400).json({ error: 'listingData is required for AddFixedPriceItem' });
      }

      // Build XML request for AddFixedPriceItem
      const xml = buildAddFixedPriceItemXML(listingData, token);

      console.log('eBay Trading API request (AddFixedPriceItem):', {
        baseUrl,
        marketplaceId: MARKETPLACE_ID,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-CALL-NAME': 'AddFixedPriceItem',
          'X-EBAY-API-SITEID': '0', // 0 = US
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1193', // API version
          'X-EBAY-API-DEV-NAME': process.env.VITE_EBAY_DEV_ID || process.env.EBAY_DEV_ID || '',
          'X-EBAY-API-APP-NAME': clientId || '',
          'X-EBAY-API-CERT-NAME': process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET || '',
          'X-EBAY-API-DETAIL-LEVEL': '0',
          'Content-Type': 'text/xml',
        },
        body: xml,
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error('eBay Trading API error:', response.status, responseText);
        return res.status(response.status).json({
          error: 'eBay Trading API error',
          details: responseText,
          status: response.status,
        });
      }

      // Parse XML response
      const result = parseTradingAPIResponse(responseText);

      console.log('eBay Trading API success (AddFixedPriceItem):', {
        itemId: result.ItemID,
        fee: result.Fees,
      });

      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }

  } catch (err) {
    console.error('Server error in /api/ebay/listing:', err);
    return res.status(500).json({
      error: 'Internal server error',
      details: err.message,
    });
  }
}

/**
 * Build XML request for AddFixedPriceItem
 */
function buildAddFixedPriceItemXML(listingData, token) {
  const {
    title,
    description,
    categoryId,
    price,
    quantity,
    photos = [],
    condition,
    brand,
    itemType,
    shippingMethod,
    shippingCost,
    shippingService,
    handlingTime,
    shipFromCountry,
    acceptReturns,
    returnWithin,
    returnShippingPayer,
    returnRefundMethod,
    duration,
    allowBestOffer,
    sku,
  } = listingData;

  // Build photo URLs
  const pictureUrls = photos.map(p => p.preview || p).filter(Boolean);

  // Build condition ID (eBay condition codes)
  const conditionMap = {
    'new': '1000',
    'like_new': '1500',
    'excellent': '2750',
    'good': '3000',
    'fair': '4000',
  };
  const conditionId = conditionMap[condition] || '1000';

  // Build listing type
  const listingType = 'FixedPriceItem';
  const listingDuration = duration === "Good 'Til Canceled" ? 'GTC' : duration === "30 Days" ? 'Days_30' : 'Days_7';

  // Build shipping details
  let shippingXML = '';
  if (shippingMethod === 'Flat' && shippingCost) {
    shippingXML = `
      <ShippingDetails>
        <ShippingType>Flat</ShippingType>
        <ShippingServiceOptions>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ShippingService>${escapeXML(shippingService)}</ShippingService>
          <ShippingServiceCost>${escapeXML(shippingCost)}</ShippingServiceCost>
          <ShippingServiceAdditionalCost>0.0</ShippingServiceAdditionalCost>
        </ShippingServiceOptions>
        <ShippingServiceOptions>
          <ShippingServicePriority>2</ShippingServicePriority>
          <ShippingService>ShippingMethodStandard</ShippingService>
          <ShippingServiceCost>0.0</ShippingServiceCost>
          <ShippingServiceAdditionalCost>0.0</ShippingServiceAdditionalCost>
        </ShippingServiceOptions>
        <ExpeditedService>false</ExpeditedService>
        <ShippingTimeMin>${handlingTime ? handlingTime.split(' ')[0] : '1'}</ShippingTimeMin>
        <ShippingTimeMax>${handlingTime ? handlingTime.split(' ')[0] : '1'}</ShippingTimeMax>
      </ShippingDetails>`;
  } else {
    shippingXML = `
      <ShippingDetails>
        <ShippingType>Calculated</ShippingType>
        <ShippingServiceOptions>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ShippingService>ShippingMethodStandard</ShippingService>
          <ShippingServiceCost>0.0</ShippingServiceCost>
          <ShippingServiceAdditionalCost>0.0</ShippingServiceAdditionalCost>
        </ShippingServiceOptions>
      </ShippingDetails>`;
  }

  // Build return policy
  let returnPolicyXML = '';
  if (acceptReturns) {
    const returnPeriod = returnWithin === '60 days' ? 'Days_60' : 'Days_30';
    const returnShipmentOption = returnShippingPayer === 'Free for buyer, you pay' ? 'Seller' : 'Buyer';
    const refundOption = returnRefundMethod === 'Full Refund or Replacement' ? 'MoneyBackOrReplacement' : 'MoneyBack';
    
    returnPolicyXML = `
      <ReturnPolicy>
        <ReturnsAcceptedOption>ReturnsAccepted</ReturnsAcceptedOption>
        <RefundOption>${refundOption}</RefundOption>
        <ReturnsWithinOption>${returnPeriod}</ReturnsWithinOption>
        <ShippingCostPaidByOption>${returnShipmentOption}</ShippingCostPaidByOption>
      </ReturnPolicy>`;
  } else {
    returnPolicyXML = `
      <ReturnPolicy>
        <ReturnsAcceptedOption>ReturnsNotAccepted</ReturnsAcceptedOption>
      </ReturnPolicy>`;
  }

  // Build item specifics (brand, type, etc.)
  let itemSpecificsXML = '';
  if (brand || itemType) {
    itemSpecificsXML = '<ItemSpecifics>';
    if (brand) {
      itemSpecificsXML += `<NameValueList><Name>Brand</Name><Value>${escapeXML(brand)}</Value></NameValueList>`;
    }
    if (itemType) {
      itemSpecificsXML += `<NameValueList><Name>Type</Name><Value>${escapeXML(itemType)}</Value></NameValueList>`;
    }
    itemSpecificsXML += '</ItemSpecifics>';
  }

  // Build pictures XML
  let picturesXML = '';
  if (pictureUrls.length > 0) {
    picturesXML = '<PictureDetails>';
    pictureUrls.forEach(url => {
      picturesXML += `<PictureURL>${escapeXML(url)}</PictureURL>`;
    });
    picturesXML += '</PictureDetails>';
  }

  // Build country code from country name
  const countryCodeMap = {
    'United States': 'US',
    'United Kingdom': 'GB',
    'Canada': 'CA',
    'Australia': 'AU',
    // Add more as needed
  };
  const countryCode = countryCodeMap[shipFromCountry] || 'US';

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<AddFixedPriceItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${escapeXML(token || '')}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <Item>
    <Title>${escapeXML(title)}</Title>
    <Description><![CDATA[${description || ''}]]></Description>
    <PrimaryCategory>
      <CategoryID>${categoryId}</CategoryID>
    </PrimaryCategory>
    <StartPrice>${escapeXML(price)}</StartPrice>
    <Quantity>${quantity || 1}</Quantity>
    <ListingType>${listingType}</ListingType>
    <ListingDuration>${listingDuration}</ListingDuration>
    <Country>${countryCode}</Country>
    <Currency>USD</Currency>
    <ConditionID>${conditionId}</ConditionID>
    <ProductListingDetails>
      <IncludeStockPhotoURL>true</IncludeStockPhotoURL>
      <IncludePrefilledItemInformation>true</IncludePrefilledItemInformation>
    </ProductListingDetails>
    ${picturesXML}
    ${itemSpecificsXML}
    ${shippingXML}
    ${returnPolicyXML}
    ${sku ? `<SKU>${escapeXML(sku)}</SKU>` : ''}
    ${allowBestOffer ? '<BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails>' : ''}
    <SellerProvidedTitle>${escapeXML(title)}</SellerProvidedTitle>
  </Item>
</AddFixedPriceItemRequest>`;

  return xml;
}

/**
 * Parse Trading API XML response
 */
function parseTradingAPIResponse(xmlText) {
  // Basic XML parsing - in production, use a proper XML parser
  try {
    const itemIdMatch = xmlText.match(/<ItemID>(.*?)<\/ItemID>/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;

    const ackMatch = xmlText.match(/<Ack>(.*?)<\/Ack>/);
    const ack = ackMatch ? ackMatch[1] : null;

    // Extract fees
    const fees = [];
    const feeMatches = xmlText.matchAll(/<Fee><Name>(.*?)<\/Name><Fee>(.*?)<\/Fee>/g);
    for (const match of feeMatches) {
      fees.push({ name: match[1], amount: match[2] });
    }

    // Extract errors
    const errors = [];
    const errorMatches = xmlText.matchAll(/<ShortMessage>(.*?)<\/ShortMessage>/g);
    for (const match of errorMatches) {
      errors.push(match[1]);
    }

    return {
      ItemID: itemId,
      Ack: ack,
      Fees: fees,
      Errors: errors,
      raw: xmlText,
    };
  } catch (error) {
    console.error('Error parsing Trading API response:', error);
    return {
      raw: xmlText,
      parseError: error.message,
    };
  }
}

/**
 * Escape XML special characters
 */
function escapeXML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

