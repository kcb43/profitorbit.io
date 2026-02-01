/**
 * Intelligent category mapping between Facebook Marketplace and Orben categories
 * Maps Facebook categories to the closest matching Orben PREDEFINED_CATEGORIES
 */

// Orben's predefined categories (from AddInventoryItem.jsx)
const ORBEN_CATEGORIES = [
  "Antiques",
  "Books, Movies & Music",
  "Clothing & Apparel",
  "Collectibles",
  "Electronics",
  "Gym/Workout",
  "Health & Beauty",
  "Home & Garden",
  "Jewelry & Watches",
  "Kitchen",
  "Makeup",
  "Mic/Audio Equipment",
  "Motorcycle",
  "Motorcycle Accessories",
  "Pets",
  "Pool Equipment",
  "Shoes/Sneakers",
  "Sporting Goods",
  "Stereos & Speakers",
  "Tools",
  "Toys & Hobbies",
  "Yoga"
];

/**
 * Facebook category ID to human-readable name mapping
 * Based on common Facebook Marketplace category IDs
 */
const FACEBOOK_CATEGORY_NAMES = {
  // Clothing & Accessories
  "1604770196468207": "Men's Shoes",
  "525682224128160": "Women's Shoes",
  "1076604869111426": "Clothing & Accessories",
  "525761377512281": "Men's Clothing",
  "878108625597868": "Women's Clothing",
  "2237891319806197": "Kids' Clothing",
  
  // Electronics
  "1490597741229197": "Electronics",
  "223883494628906": "Cell Phones & Accessories",
  "387142348135224": "Computers & Laptops",
  "365710473965910": "Cameras & Photography",
  
  // Home & Living
  "1670493229902393": "Home Improvement & Tools",
  "192053204646664": "Furniture",
  "199000960859097": "Home & Garden",
  "1613103348968109": "Kitchen & Dining",
  
  // Sports & Outdoors
  "288572841866817": "Sporting Goods & Outdoor",
  "198272377051429": "Exercise Equipment",
  "532006713496115": "Bicycles",
  
  // Collectibles & Antiques
  "389274338149571": "Collectibles",
  "455588161162389": "Antiques",
  "380484265637924": "Toys & Games",
  
  // Other
  "264807083659324": "Musical Instruments",
  "274071439345988": "Pet Supplies",
  "219302225135147": "Baby & Kids",
  "526529210750366": "Books, Movies & Music",
  "434898036665067": "Health & Beauty",
  "146472262802339": "Jewelry & Watches",
  "345910918820735": "Motorcycle Parts & Accessories"
};

/**
 * Keyword-based mapping rules for intelligent category detection
 * Format: [keyword, targetCategory, priority]
 */
const CATEGORY_KEYWORDS = [
  // Shoes/Sneakers
  ["shoe", "Shoes/Sneakers", 10],
  ["sneaker", "Shoes/Sneakers", 10],
  ["boot", "Shoes/Sneakers", 9],
  ["sandal", "Shoes/Sneakers", 9],
  
  // Clothing & Apparel
  ["clothing", "Clothing & Apparel", 8],
  ["shirt", "Clothing & Apparel", 8],
  ["pants", "Clothing & Apparel", 8],
  ["dress", "Clothing & Apparel", 8],
  ["jacket", "Clothing & Apparel", 8],
  ["coat", "Clothing & Apparel", 8],
  
  // Electronics
  ["phone", "Electronics", 9],
  ["computer", "Electronics", 9],
  ["laptop", "Electronics", 9],
  ["tablet", "Electronics", 9],
  ["camera", "Electronics", 8],
  ["electronic", "Electronics", 7],
  
  // Tools
  ["tool", "Tools", 10],
  ["drill", "Tools", 9],
  ["saw", "Tools", 9],
  ["hammer", "Tools", 9],
  ["home improvement", "Tools", 8],
  
  // Kitchen
  ["kitchen", "Kitchen", 10],
  ["cookware", "Kitchen", 9],
  ["dining", "Kitchen", 8],
  
  // Home & Garden
  ["furniture", "Home & Garden", 9],
  ["garden", "Home & Garden", 9],
  ["home", "Home & Garden", 5],
  
  // Sporting Goods
  ["sporting", "Sporting Goods", 9],
  ["sport", "Sporting Goods", 8],
  ["outdoor", "Sporting Goods", 7],
  
  // Gym/Workout
  ["exercise", "Gym/Workout", 10],
  ["gym", "Gym/Workout", 10],
  ["workout", "Gym/Workout", 10],
  ["fitness", "Gym/Workout", 9],
  
  // Yoga
  ["yoga", "Yoga", 10],
  
  // Collectibles
  ["collectible", "Collectibles", 10],
  ["collection", "Collectibles", 8],
  
  // Antiques
  ["antique", "Antiques", 10],
  ["vintage", "Antiques", 7],
  
  // Toys & Hobbies
  ["toy", "Toys & Hobbies", 10],
  ["game", "Toys & Hobbies", 8],
  
  // Books, Movies & Music
  ["book", "Books, Movies & Music", 9],
  ["movie", "Books, Movies & Music", 9],
  ["music", "Books, Movies & Music", 9],
  ["dvd", "Books, Movies & Music", 9],
  ["cd", "Books, Movies & Music", 9],
  
  // Musical Equipment
  ["musical instrument", "Mic/Audio Equipment", 10],
  ["audio", "Mic/Audio Equipment", 8],
  ["microphone", "Mic/Audio Equipment", 10],
  ["speaker", "Stereos & Speakers", 10],
  ["stereo", "Stereos & Speakers", 10],
  
  // Jewelry & Watches
  ["jewelry", "Jewelry & Watches", 10],
  ["watch", "Jewelry & Watches", 10],
  ["necklace", "Jewelry & Watches", 9],
  ["ring", "Jewelry & Watches", 9],
  
  // Health & Beauty
  ["health", "Health & Beauty", 8],
  ["beauty", "Health & Beauty", 8],
  ["skincare", "Health & Beauty", 9],
  ["cosmetic", "Health & Beauty", 9],
  
  // Makeup
  ["makeup", "Makeup", 10],
  ["cosmetic", "Makeup", 8],
  
  // Pets
  ["pet", "Pets", 10],
  ["dog", "Pets", 9],
  ["cat", "Pets", 9],
  
  // Motorcycle
  ["motorcycle", "Motorcycle", 10],
  ["bike part", "Motorcycle Accessories", 8],
  
  // Pool Equipment
  ["pool", "Pool Equipment", 10]
];

/**
 * Map Facebook category ID to human-readable name
 * @param {string} categoryId - Facebook category ID
 * @returns {string|null} - Category name or null if not found
 */
export function resolveFacebookCategoryName(categoryId) {
  return FACEBOOK_CATEGORY_NAMES[categoryId] || null;
}

/**
 * Map Facebook category to Orben category using intelligent matching
 * @param {string} facebookCategory - Facebook category name or text
 * @param {string} facebookCategoryId - Facebook category ID (optional)
 * @param {string} itemTitle - Item title for additional context (optional)
 * @returns {string|null} - Matched Orben category or null
 */
export function mapFacebookToOrbenCategory(facebookCategory, facebookCategoryId = null, itemTitle = null) {
  // If we have a category ID, resolve it first
  let categoryText = facebookCategory;
  if (facebookCategoryId && !categoryText) {
    categoryText = resolveFacebookCategoryName(facebookCategoryId);
  }
  
  if (!categoryText && !itemTitle) {
    return null;
  }
  
  // Combine category text and title for better matching
  const searchText = [categoryText, itemTitle].filter(Boolean).join(' ').toLowerCase();
  
  // Try direct match first (case-insensitive)
  const directMatch = ORBEN_CATEGORIES.find(cat => 
    searchText.includes(cat.toLowerCase())
  );
  if (directMatch) {
    console.log(`✅ Direct category match: "${searchText}" → "${directMatch}"`);
    return directMatch;
  }
  
  // Try keyword-based matching
  let bestMatch = null;
  let highestPriority = 0;
  
  for (const [keyword, targetCategory, priority] of CATEGORY_KEYWORDS) {
    if (searchText.includes(keyword.toLowerCase())) {
      if (priority > highestPriority) {
        highestPriority = priority;
        bestMatch = targetCategory;
      }
    }
  }
  
  if (bestMatch) {
    console.log(`✅ Keyword category match: "${searchText}" → "${bestMatch}" (priority: ${highestPriority})`);
    return bestMatch;
  }
  
  console.log(`⚠️ No category match found for: "${searchText}"`);
  return null;
}

/**
 * Add a custom category if it doesn't exist in Orben's predefined list
 * @param {string} categoryName - Category name to add
 * @returns {string} - The category name (ensures it's always returned)
 */
export function ensureCategory(categoryName) {
  if (!categoryName) return null;
  
  // If it matches an existing Orben category, use that
  const exactMatch = ORBEN_CATEGORIES.find(cat => 
    cat.toLowerCase() === categoryName.toLowerCase()
  );
  if (exactMatch) {
    return exactMatch;
  }
  
  // Otherwise, return the original name (will be treated as custom)
  return categoryName;
}
