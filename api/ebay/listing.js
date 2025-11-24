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

/**
 * Get user token for Trading API
 * Trading API requires a user token (OAuth user authorization), not an app token
 * The user token can be:
 * 1. Passed in the request body (userToken parameter)
 * 2. Stored in environment variable (EBAY_USER_TOKEN)
 * 3. Retrieved from OAuth flow (not implemented yet)
 */
async function getUserToken(userTokenFromRequest) {
  // Priority 1: Use token from request if provided
  if (userTokenFromRequest) {
    return userTokenFromRequest;
  }

  // Priority 2: Check environment variable
  const envToken = process.env.VITE_EBAY_USER_TOKEN || process.env.EBAY_USER_TOKEN;
  if (envToken) {
    return envToken;
  }

  // If no user token is available, throw error
  throw new Error('User token is required for Trading API operations. Please provide EBAY_USER_TOKEN in environment variables or pass userToken in the request body.');
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
    const { operation, listingData, userToken } = req.body;

    if (!operation) {
      return res.status(400).json({ error: 'Operation parameter is required (AddFixedPriceItem, ReviseItem, EndItem, GetItem)' });
    }

    // Determine environment
    const clientId = process.env.VITE_EBAY_CLIENT_ID || process.env.EBAY_CLIENT_ID;
    const devId = process.env.VITE_EBAY_DEV_ID || process.env.EBAY_DEV_ID;
    const clientSecret = process.env.VITE_EBAY_CLIENT_SECRET || process.env.EBAY_CLIENT_SECRET;
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

    // Get user token (required for Trading API)
    let token;
    try {
      token = await getUserToken(userToken);
    } catch (tokenError) {
      return res.status(401).json({
        error: 'User token required',
        details: tokenError.message,
        hint: 'Trading API requires a user token. Provide EBAY_USER_TOKEN in environment variables or pass userToken in the request body.',
      });
    }

    // Validate required credentials
    if (!devId) {
      return res.status(400).json({
        error: 'Dev ID required',
        details: 'EBAY_DEV_ID is required for Trading API calls',
      });
    }

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
          'X-EBAY-API-SITEID': '0', // 0 = US, see https://developer.ebay.com/DevZone/guides/ebayfeatures/Development/InternationalSites.html
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1193', // API version - update to latest as needed
          'X-EBAY-API-DEV-NAME': devId,
          'X-EBAY-API-APP-NAME': clientId || '',
          'X-EBAY-API-CERT-NAME': clientSecret || '',
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

    } else if (operation === 'GetCategoryFeatures') {
      // Get category features to check if Item Specifics are enabled
      const { categoryId } = req.body;

      if (!categoryId) {
        return res.status(400).json({ error: 'categoryId is required for GetCategoryFeatures' });
      }

      // Build XML request for GetCategoryFeatures
      const xml = buildGetCategoryFeaturesXML(categoryId, token);

      console.log('eBay Trading API request (GetCategoryFeatures):', {
        baseUrl,
        categoryId,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-CALL-NAME': 'GetCategoryFeatures',
          'X-EBAY-API-SITEID': '0', // 0 = US
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1193',
          'X-EBAY-API-DEV-NAME': devId,
          'X-EBAY-API-APP-NAME': clientId || '',
          'X-EBAY-API-CERT-NAME': clientSecret || '',
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
        });
      }

      const result = parseTradingAPIResponse(responseText);

      console.log('eBay Trading API success (GetCategoryFeatures):', {
        categoryId,
        itemSpecificsEnabled: result.Category?.ItemSpecificsEnabled,
      });

      return res.status(200).json(result);

    } else if (operation === 'GetItem') {
      const { itemId, includeItemCompatibilityList, includeItemSpecifics } = req.body;

      if (!itemId) {
        return res.status(400).json({ error: 'itemId is required for GetItem' });
      }

      // Build XML request for GetItem
      const xml = buildGetItemXML(itemId, token, {
        includeItemCompatibilityList: includeItemCompatibilityList === true,
        includeItemSpecifics: includeItemSpecifics === true,
      });

      console.log('eBay Trading API request (GetItem):', {
        baseUrl,
        itemId,
        includeItemCompatibilityList,
        includeItemSpecifics,
      });

      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'X-EBAY-API-CALL-NAME': 'GetItem',
          'X-EBAY-API-SITEID': '0', // 0 = US
          'X-EBAY-API-COMPATIBILITY-LEVEL': '1193', // API version
          'X-EBAY-API-DEV-NAME': devId,
          'X-EBAY-API-APP-NAME': clientId || '',
          'X-EBAY-API-CERT-NAME': clientSecret || '',
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
      const result = parseGetItemResponse(responseText);

      console.log('eBay Trading API success (GetItem):', {
        itemId: result.ItemID,
        title: result.Title,
      });

      return res.status(200).json(result);

    } else {
      return res.status(400).json({ error: `Unknown operation: ${operation}. Supported operations: AddFixedPriceItem, GetItem` });
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
    itemTypeAspectName = 'Model',
    shippingMethod,
    shippingCostType,
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
    packageWeight,
    postalCode,
    sku,
    locationDescriptions,
    shippingLocation,
  } = listingData;

  // Build photo URLs
  const pictureUrls = photos.map(p => p.preview || p).filter(Boolean);

  // Build condition ID (eBay condition codes)
  // Map our condition values to eBay condition IDs
  const conditionMap = {
    'New': '1000',
    'Open Box': '1500',
    'Used': '3000',
    'For parts or not working': '7000',
    // Fallback mappings for general form conditions
    'New With Tags/Box': '1000',
    'New Without Tags/Box': '1500',
    'Pre - Owned - Good': '3000',
    'Poor (Major flaws)': '3000',
  };
  const conditionId = conditionMap[condition] || conditionMap[condition?.trim()] || '1000';

  // Build listing type
  const listingType = 'FixedPriceItem';
  const listingDuration = duration === "Good 'Til Canceled" ? 'GTC' : duration === "30 Days" ? 'Days_30' : 'Days_7';

  // Map human-readable shipping service names to eBay service codes
  const shippingServiceMap = {
    'Standard Shipping (3 to 5 business days)': 'USPSPriority',
    'Expedited Shipping (1 to 3 business days)': 'USPSPriorityMailExpress',
    'USPS Priority Mail': 'USPSPriority',
    'USPS Priority Mail Express': 'USPSPriorityMailExpress',
    'USPS First Class': 'USPSFirstClass',
    'USPS Parcel Select': 'USPSParcel',
    'FedEx Ground': 'FedExGround',
    'FedEx Home Delivery': 'FedExHomeDelivery',
    'FedEx Standard Overnight': 'FedExStandardOvernight',
  };
  
  // Get eBay shipping service code
  const getEbayShippingServiceCode = (serviceName) => {
    if (!serviceName) return 'USPSPriority'; // Default
    // Check exact match first
    if (shippingServiceMap[serviceName]) {
      return shippingServiceMap[serviceName];
    }
    // Check partial matches
    const serviceLower = serviceName.toLowerCase();
    if (serviceLower.includes('priority')) {
      return 'USPSPriority';
    }
    if (serviceLower.includes('express') || serviceLower.includes('expedited')) {
      return 'USPSPriorityMailExpress';
    }
    if (serviceLower.includes('first class')) {
      return 'USPSFirstClass';
    }
    // Default fallback
    return 'USPSPriority';
  };

  // Build shipping details
  // Determine shipping type from shippingCostType
  const isFlat = shippingCostType && shippingCostType.includes('Flat');
  const isCalculated = shippingCostType && shippingCostType.includes('Calculated');
  const isLocalPickup = shippingMethod && shippingMethod.includes('Local pickup');
  
  // Parse handling time (format: "1 day", "2 days", etc.)
  const handlingDays = handlingTime ? parseInt(handlingTime.split(' ')[0]) || 1 : 1;
  
  let shippingXML = '';
  
  if (isLocalPickup) {
    // Local pickup only
    shippingXML = `
      <ShippingDetails>
        <ShippingType>LocalPickup</ShippingType>
        <ShippingServiceOptions>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ShippingService>Pickup</ShippingService>
          <ShippingServiceCost>0.0</ShippingServiceCost>
        </ShippingServiceOptions>
      </ShippingDetails>`;
  } else if (isFlat && shippingCost) {
    // Flat rate shipping
    const ebayServiceCode = getEbayShippingServiceCode(shippingService);
    shippingXML = `
      <ShippingDetails>
        <ShippingType>Flat</ShippingType>
        <ShippingServiceOptions>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ShippingService>${escapeXML(ebayServiceCode)}</ShippingService>
          <ShippingServiceCost>${escapeXML(shippingCost)}</ShippingServiceCost>
        </ShippingServiceOptions>
      </ShippingDetails>`;
  } else {
    // Calculated shipping (default)
    const ebayServiceCode = getEbayShippingServiceCode(shippingService);
    shippingXML = `
      <ShippingDetails>
        <ShippingType>Calculated</ShippingType>
        <ShippingServiceOptions>
          <ShippingServicePriority>1</ShippingServicePriority>
          <ShippingService>${escapeXML(ebayServiceCode)}</ShippingService>
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

  // Build location details
  let locationXML = '';
  if (shippingLocation) {
    locationXML = `<Location>${escapeXML(shippingLocation)}</Location>`;
  }
  if (locationDescriptions) {
    // Location descriptions can be added as SellerProvidedTitle or in description
    // For now, we'll include it in the Location field if provided
  }

  // Build item specifics XML (brand, type, etc.)
  let itemSpecificsXML = '';
  const itemSpecifics = [];
  if (brand) {
    itemSpecifics.push(`<NameValueList><Name>Brand</Name><Value>${escapeXML(brand)}</Value></NameValueList>`);
  }
  if (itemType) {
    // Use the actual aspect name from eBay (could be "Model", "Type", etc.)
    itemSpecifics.push(`<NameValueList><Name>${escapeXML(itemTypeAspectName)}</Name><Value>${escapeXML(itemType)}</Value></NameValueList>`);
  }
  if (itemSpecifics.length > 0) {
    itemSpecificsXML = `<ItemSpecifics>${itemSpecifics.join('')}</ItemSpecifics>`;
  }

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
    <DispatchTimeMax>${handlingDays}</DispatchTimeMax>
    ${locationXML}
    ${postalCode ? `<PostalCode>${escapeXML(postalCode)}</PostalCode>` : ''}
    ${packageWeight ? `<ShippingPackageDetails><WeightMajor unit="lbs">${escapeXML(parseFloat(packageWeight).toString())}</WeightMajor></ShippingPackageDetails>` : ''}
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
 * Build XML request for GetCategoryFeatures
 */
function buildGetCategoryFeaturesXML(categoryId, token) {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetCategoryFeaturesRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${escapeXML(token || '')}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <CategoryID>${escapeXML(categoryId)}</CategoryID>
  <FeatureID>ItemSpecificsEnabled</FeatureID>
  <AllFeaturesForCategory>true</AllFeaturesForCategory>
</GetCategoryFeaturesRequest>`;

  return xml;
}

/**
 * Build XML request for GetItem
 */
function buildGetItemXML(itemId, token, options = {}) {
  const { includeItemCompatibilityList = false, includeItemSpecifics = false } = options;

  let includeOptions = '';
  if (includeItemCompatibilityList) {
    includeOptions += '<IncludeItemCompatibilityList>true</IncludeItemCompatibilityList>';
  }
  if (includeItemSpecifics) {
    includeOptions += '<IncludeItemSpecifics>true</IncludeItemSpecifics>';
  }

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<GetItemRequest xmlns="urn:ebay:apis:eBLBaseComponents">
  <RequesterCredentials>
    <eBayAuthToken>${escapeXML(token || '')}</eBayAuthToken>
  </RequesterCredentials>
  <ErrorLanguage>en_US</ErrorLanguage>
  <WarningLevel>High</WarningLevel>
  <ItemID>${escapeXML(itemId)}</ItemID>
  <DetailLevel>ReturnAll</DetailLevel>
  ${includeOptions}
</GetItemRequest>`;

  return xml;
}

/**
 * Parse Trading API XML response for AddFixedPriceItem
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
 * Parse Trading API XML response for GetItem
 */
function parseGetItemResponse(xmlText) {
  // Basic XML parsing - in production, use a proper XML parser
  try {
    const ackMatch = xmlText.match(/<Ack>(.*?)<\/Ack>/);
    const ack = ackMatch ? ackMatch[1] : null;

    // Extract item ID
    const itemIdMatch = xmlText.match(/<ItemID>(.*?)<\/ItemID>/);
    const itemId = itemIdMatch ? itemIdMatch[1] : null;

    // Extract title
    const titleMatch = xmlText.match(/<Title>(.*?)<\/Title>/);
    const title = titleMatch ? titleMatch[1] : null;

    // Extract description
    const descriptionMatch = xmlText.match(/<Description><!\[CDATA\[(.*?)\]\]><\/Description>/s);
    const description = descriptionMatch ? descriptionMatch[1] : null;

    // Extract listing type
    const listingTypeMatch = xmlText.match(/<ListingType>(.*?)<\/ListingType>/);
    const listingType = listingTypeMatch ? listingTypeMatch[1] : null;

    // Extract start price
    const startPriceMatch = xmlText.match(/<StartPrice currencyID="USD">(.*?)<\/StartPrice>/);
    const startPrice = startPriceMatch ? startPriceMatch[1] : null;

    // Extract quantity
    const quantityMatch = xmlText.match(/<Quantity>(.*?)<\/Quantity>/);
    const quantity = quantityMatch ? quantityMatch[1] : null;

    // Extract condition
    const conditionIdMatch = xmlText.match(/<ConditionID>(.*?)<\/ConditionID>/);
    const conditionId = conditionIdMatch ? conditionIdMatch[1] : null;
    const conditionDisplayNameMatch = xmlText.match(/<ConditionDisplayName>(.*?)<\/ConditionDisplayName>/);
    const conditionDisplayName = conditionDisplayNameMatch ? conditionDisplayNameMatch[1] : null;

    // Extract category
    const categoryIdMatch = xmlText.match(/<CategoryID>(.*?)<\/CategoryID>/);
    const categoryId = categoryIdMatch ? categoryIdMatch[1] : null;
    const categoryNameMatch = xmlText.match(/<CategoryName>(.*?)<\/CategoryName>/);
    const categoryName = categoryNameMatch ? categoryNameMatch[1] : null;

    // Extract item specifics
    const itemSpecifics = [];
    const nameValueMatches = xmlText.matchAll(/<NameValueList><Name>(.*?)<\/Name>(.*?)<\/NameValueList>/gs);
    for (const match of nameValueMatches) {
      const name = match[1];
      const valueContent = match[2];
      const values = [];
      const valueMatches = valueContent.matchAll(/<Value>(.*?)<\/Value>/g);
      for (const valueMatch of valueMatches) {
        values.push(valueMatch[1]);
      }
      if (name && values.length > 0) {
        itemSpecifics.push({ name, values });
      }
    }

    // Extract pictures
    const pictures = [];
    const pictureMatches = xmlText.matchAll(/<PictureURL>(.*?)<\/PictureURL>/g);
    for (const match of pictureMatches) {
      pictures.push(match[1]);
    }

    // Extract seller information
    const sellerUserIdMatch = xmlText.match(/<UserID>(.*?)<\/UserID>/);
    const sellerUserId = sellerUserIdMatch ? sellerUserIdMatch[1] : null;

    // Extract shipping details
    const shippingTypeMatch = xmlText.match(/<ShippingType>(.*?)<\/ShippingType>/);
    const shippingType = shippingTypeMatch ? shippingTypeMatch[1] : null;

    // Extract return policy
    const returnsAcceptedMatch = xmlText.match(/<ReturnsAcceptedOption>(.*?)<\/ReturnsAcceptedOption>/);
    const returnsAccepted = returnsAcceptedMatch ? returnsAcceptedMatch[1] : null;

    // Extract errors
    const errors = [];
    const errorMatches = xmlText.matchAll(/<ShortMessage>(.*?)<\/ShortMessage>/g);
    for (const match of errorMatches) {
      errors.push(match[1]);
    }

    return {
      Ack: ack,
      ItemID: itemId,
      Title: title,
      Description: description,
      ListingType: listingType,
      StartPrice: startPrice ? parseFloat(startPrice) : null,
      Quantity: quantity ? parseInt(quantity) : null,
      ConditionID: conditionId,
      ConditionDisplayName: conditionDisplayName,
      CategoryID: categoryId,
      CategoryName: categoryName,
      ItemSpecifics: itemSpecifics.length > 0 ? itemSpecifics : undefined,
      Pictures: pictures.length > 0 ? pictures : undefined,
      SellerUserID: sellerUserId,
      ShippingType: shippingType,
      ReturnsAccepted: returnsAccepted,
      Errors: errors.length > 0 ? errors : undefined,
      raw: xmlText,
    };
  } catch (error) {
    console.error('Error parsing GetItem response:', error);
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

