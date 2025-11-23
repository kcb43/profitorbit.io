/**
 * eBay API Helper Functions
 * 
 * Utility functions for converting eBay API data to inventory item format
 * and other common operations.
 */

/**
 * Convert eBay item summary to inventory item format
 * 
 * @param {Object} ebayItem - eBay item summary object from Browse API
 * @returns {Object} Inventory item data
 */
export function ebayItemToInventory(ebayItem) {
  if (!ebayItem) return null;

  return {
    item_name: ebayItem.title || '',
    purchase_price: ebayItem.price?.value?.toString() || '0',
    image_url: ebayItem.image?.imageUrl || '',
    category: mapEbayCategoryToInventory(ebayItem.categoryPath || []),
    source: 'eBay',
    status: 'available',
    // Don't include notes when converting eBay item to inventory
  };
}

/**
 * Convert eBay detailed item to inventory item format
 * 
 * @param {Object} ebayItem - eBay detailed item object from Browse API
 * @returns {Object} Inventory item data
 */
export function ebayDetailedItemToInventory(ebayItem) {
  if (!ebayItem) return null;

  const baseData = {
    item_name: ebayItem.title || '',
    purchase_price: ebayItem.price?.value?.toString() || '0',
    image_url: getBestImageUrl(ebayItem),
    category: mapEbayCategoryToInventory(ebayItem.categoryPath || []),
    source: 'eBay',
    status: 'available',
    notes: formatDetailedEbayNotes(ebayItem),
  };

  // Add additional details if available
  if (ebayItem.shortDescription) {
    baseData.notes = (baseData.notes ? baseData.notes + '\n\n' : '') + ebayItem.shortDescription;
  }

  return baseData;
}

/**
 * Get the best available image URL from eBay item
 * 
 * @param {Object} ebayItem - eBay item object
 * @returns {string} Image URL
 */
export function getBestImageUrl(ebayItem) {
  // Try detailed images first
  if (ebayItem.image?.imageUrl) {
    return ebayItem.image.imageUrl;
  }
  
  // Try thumbnail
  if (ebayItem.thumbnailImages?.[0]?.imageUrl) {
    return ebayItem.thumbnailImages[0].imageUrl;
  }
  
  // Try itemGroupImages
  if (ebayItem.itemGroupImages?.[0]?.imageUrl) {
    return ebayItem.itemGroupImages[0].imageUrl;
  }
  
  return '';
}

/**
 * Map eBay category path to inventory category
 * 
 * @param {Array} categoryPath - Array of category names from eBay
 * @returns {string} Inventory category name
 */
export function mapEbayCategoryToInventory(categoryPath) {
  if (!Array.isArray(categoryPath) || categoryPath.length === 0) {
    return '';
  }

  // Common eBay to inventory category mappings
  const categoryMap = {
    'Electronics': 'Electronics',
    'Cell Phones & Accessories': 'Electronics',
    'Computers/Tablets & Networking': 'Electronics',
    'Video Games & Consoles': 'Toys & Hobbies',
    'Toys & Hobbies': 'Toys & Hobbies',
    'Clothing, Shoes & Accessories': 'Clothing & Apparel',
    'Health & Beauty': 'Health & Beauty',
    'Home & Garden': 'Home & Garden',
    'Jewelry & Watches': 'Jewelry & Watches',
    'Sports & Outdoors': 'Sporting Goods',
    'Books, Movies & Music': 'Books, Movies & Music',
    'Collectibles & Art': 'Collectibles',
    'Antiques': 'Antiques',
    'Motorcycles & Parts': 'Motorcycle Accessories',
    'Pet Supplies': 'Pets',
    'Tools & Workshop Equipment': 'Tools',
  };

  // Use the last category in the path (most specific)
  const lastCategory = categoryPath[categoryPath.length - 1];
  
  // Try exact match first
  if (categoryMap[lastCategory]) {
    return categoryMap[lastCategory];
  }

  // Try partial match
  for (const [ebayCategory, inventoryCategory] of Object.entries(categoryMap)) {
    if (lastCategory.includes(ebayCategory) || ebayCategory.includes(lastCategory)) {
      return inventoryCategory;
    }
  }

  // Return the eBay category name if no mapping found
  return lastCategory || '';
}

/**
 * Format eBay item notes from summary data
 * Only returns the eBay item URL as a clickable link
 * 
 * @param {Object} ebayItem - eBay item summary
 * @returns {string} eBay item URL
 */
export function formatEbayNotes(ebayItem) {
  if (!ebayItem) return '';
  
  // Get the eBay item URL using the helper function to ensure we get a production URL
  const ebayUrl = getEbayItemUrl(ebayItem.itemId, ebayItem.itemWebUrl);
  
  // Return only the URL - plain URLs are clickable in most text fields and notes viewers
  return ebayUrl;
}

/**
 * Format eBay item notes from detailed item data
 * 
 * @param {Object} ebayItem - eBay detailed item
 * @returns {string} Formatted notes
 */
export function formatDetailedEbayNotes(ebayItem) {
  const notes = [];
  
  if (ebayItem.itemId) {
    notes.push(`eBay Item ID: ${ebayItem.itemId}`);
  }
  
  if (ebayItem.condition) {
    notes.push(`Condition: ${ebayItem.condition}`);
  }
  
  if (ebayItem.seller?.username) {
    notes.push(`Seller: ${ebayItem.seller.username}`);
  }
  
  if (ebayItem.buyingOptions?.includes('FIXED_PRICE')) {
    notes.push('Buy It Now');
  } else if (ebayItem.buyingOptions?.includes('AUCTION')) {
    notes.push('Auction');
    if (ebayItem.priceDisplayCondition) {
      notes.push(`Price Display: ${ebayItem.priceDisplayCondition}`);
    }
  }
  
  if (ebayItem.shippingOptions?.length > 0) {
    const shipping = ebayItem.shippingOptions[0];
    if (shipping.shippingCost?.value) {
      notes.push(`Shipping: $${shipping.shippingCost.value}`);
    }
    if (shipping.maxEstimatedDeliveryDate) {
      notes.push(`Est. Delivery: ${shipping.maxEstimatedDeliveryDate}`);
    }
  }
  
  if (ebayItem.itemLocation?.city && ebayItem.itemLocation.stateOrProvince) {
    notes.push(`Location: ${ebayItem.itemLocation.city}, ${ebayItem.itemLocation.stateOrProvince}`);
  }
  
  if (ebayItem.itemWebUrl) {
    notes.push(`eBay URL: ${ebayItem.itemWebUrl}`);
  }
  
  return notes.join('\n');
}

/**
 * Format price for display
 * 
 * @param {Object} price - eBay price object
 * @returns {string} Formatted price string
 */
export function formatEbayPrice(price) {
  if (!price?.value) return 'N/A';
  const currency = price.currency || 'USD';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(price.value);
}

/**
 * Format condition for display
 * 
 * @param {string} condition - eBay condition string
 * @returns {string} Formatted condition
 */
export function formatEbayCondition(condition) {
  if (!condition) return 'Unknown';
  
  const conditionMap = {
    'NEW': 'New',
    'NEW_OTHER': 'New Other',
    'NEW_WITH_DEFECTS': 'New With Defects',
    'CERTIFIED_REFURBISHED': 'Certified Refurbished',
    'EXCELLENT_REFURBISHED': 'Excellent Refurbished',
    'VERY_GOOD_REFURBISHED': 'Very Good Refurbished',
    'GOOD_REFURBISHED': 'Good Refurbished',
    'SELLER_REFURBISHED': 'Seller Refurbished',
    'LIKE_NEW': 'Like New',
    'USED': 'Used',
    'VERY_GOOD': 'Very Good',
    'GOOD': 'Good',
    'ACCEPTABLE': 'Acceptable',
    'FOR_PARTS_OR_NOT_WORKING': 'For Parts or Not Working',
  };
  
  return conditionMap[condition] || condition.replace(/_/g, ' ');
}

/**
 * Get eBay item URL (always uses production eBay, even for sandbox items)
 * 
 * @param {string} itemId - eBay item ID
 * @param {string} itemWebUrl - eBay web URL (if available)
 * @returns {string} Item URL (always production eBay URL)
 */
export function getEbayItemUrl(itemId, itemWebUrl) {
  // Always construct production eBay URL from item ID
  // Sandbox items won't exist on production eBay, but at least the URL will be valid
  // Format: https://www.ebay.com/itm/{itemId}
  // For RESTful IDs like "v1|123456789012|0", extract the middle number
  
  if (!itemId) {
    // Fallback if no itemId provided
    return 'https://www.ebay.com';
  }
  
  // Extract numeric ID from RESTful format
  let extractedId = itemId;
  const idMatch = itemId?.match(/\|(\d+)\|/);
  if (idMatch) {
    extractedId = idMatch[1];
  } else if (itemId.includes('|')) {
    // Handle other pipe-separated formats
    const parts = itemId.split('|');
    extractedId = parts.find(p => /^\d+$/.test(p)) || extractedId;
  }
  
  // Ensure we have a valid numeric ID
  if (!/^\d+$/.test(extractedId)) {
    // If ID is not numeric, try to extract from itemWebUrl if provided
    if (itemWebUrl && !itemWebUrl.includes('sandbox')) {
      const urlMatch = itemWebUrl.match(/\/itm\/(\d+)/);
      if (urlMatch) {
        extractedId = urlMatch[1];
      }
    }
  }
  
  // Always use production eBay URL - never use sandbox URLs
  // Note: Sandbox items won't exist on production eBay, but the URL will at least work
  return `https://www.ebay.com/itm/${extractedId}`;
}

/**
 * Check if item is still available (not ended)
 * 
 * @param {Object} ebayItem - eBay item object
 * @returns {boolean} True if item is available
 */
export function isEbayItemAvailable(ebayItem) {
  // Check if item has ended
  if (ebayItem.itemEndDate) {
    const endDate = new Date(ebayItem.itemEndDate);
    const now = new Date();
    if (endDate < now) {
      return false;
    }
  }
  
  // Check estimated availability status
  if (ebayItem.estimatedAvailabilityStatus === 'OUT_OF_STOCK') {
    return false;
  }
  
  return true;
}

/**
 * Format buying option for display badge
 * 
 * @param {Array} buyingOptions - Array of buying options from eBay item
 * @returns {Object} Badge text and variant
 */
export function formatEbayBuyingOption(buyingOptions) {
  if (!buyingOptions || !Array.isArray(buyingOptions) || buyingOptions.length === 0) {
    return { text: 'Unknown', variant: 'outline' };
  }
  
  const hasFixedPrice = buyingOptions.includes('FIXED_PRICE');
  const hasAuction = buyingOptions.includes('AUCTION');
  
  if (hasFixedPrice && hasAuction) {
    return { text: 'Buy It Now & Auction', variant: 'default' };
  } else if (hasFixedPrice) {
    return { text: 'Buy It Now', variant: 'default' };
  } else if (hasAuction) {
    return { text: 'Auction', variant: 'secondary' };
  }
  
  return { text: 'Unknown', variant: 'outline' };
}

