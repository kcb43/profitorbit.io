/**
 * Intelligent category mapping between Facebook Marketplace and Orben categories
 * Maps Facebook categories to the closest matching Orben product categories.
 */

// Orben's predefined categories (must match src/lib/categories.js)
const ORBEN_CATEGORIES = [
  'Shoes & Sneakers',
  'Clothing & Apparel',
  'Electronics',
  'Computer Parts',
  'Apple Products',
  'Bags & Accessories',
  'Jewelry & Watches',
  'Home & Kitchen',
  'Sports & Outdoors',
  'Gym Equipment',
  'Toys & Games',
  'Trading Cards',
  'Pokemon',
  'Anime & Manga',
  'Figurines',
  'Books & Media',
  'Hair Care',
  'Skin Care',
  'Beauty & Health',
  'Vintage & Collectibles',
  'Tools & Hardware',
  'Pet Food',
  'Pet Care',
  'Arts & Crafts',
  'Kids & Baby',
  'Garden & Outdoor',
  'Solar & Generators',
  'Office Supplies',
  'Auto & Motorcycle',
  'Handmade',
  'Other',
];

/**
 * Facebook category ID to human-readable name mapping
 */
const FACEBOOK_CATEGORY_NAMES = {
  "1604770196468207": "Men's Shoes",
  "525682224128160": "Women's Shoes",
  "1076604869111426": "Clothing & Accessories",
  "525761377512281": "Men's Clothing",
  "878108625597868": "Women's Clothing",
  "2237891319806197": "Kids' Clothing",
  "1490597741229197": "Electronics",
  "223883494628906": "Cell Phones & Accessories",
  "387142348135224": "Computers & Laptops",
  "365710473965910": "Cameras & Photography",
  "1670493229902393": "Home Improvement & Tools",
  "192053204646664": "Furniture",
  "199000960859097": "Home & Garden",
  "1613103348968109": "Kitchen & Dining",
  "288572841866817": "Sporting Goods & Outdoor",
  "198272377051429": "Exercise Equipment",
  "532006713496115": "Bicycles",
  "389274338149571": "Collectibles",
  "455588161162389": "Antiques",
  "380484265637924": "Toys & Games",
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
  // Shoes & Sneakers
  ["shoe", "Shoes & Sneakers", 10],
  ["sneaker", "Shoes & Sneakers", 10],
  ["boot", "Shoes & Sneakers", 9],
  ["sandal", "Shoes & Sneakers", 9],
  ["jordan", "Shoes & Sneakers", 10],
  ["yeezy", "Shoes & Sneakers", 10],

  // Clothing & Apparel
  ["clothing", "Clothing & Apparel", 8],
  ["shirt", "Clothing & Apparel", 8],
  ["pants", "Clothing & Apparel", 8],
  ["dress", "Clothing & Apparel", 8],
  ["jacket", "Clothing & Apparel", 8],
  ["coat", "Clothing & Apparel", 8],
  ["hoodie", "Clothing & Apparel", 8],

  // Electronics
  ["phone", "Electronics", 9],
  ["computer", "Electronics", 9],
  ["laptop", "Electronics", 9],
  ["tablet", "Electronics", 9],
  ["camera", "Electronics", 8],
  ["electronic", "Electronics", 7],

  // Computer Parts
  ["gpu", "Computer Parts", 10],
  ["cpu", "Computer Parts", 10],
  ["motherboard", "Computer Parts", 10],
  ["graphics card", "Computer Parts", 10],
  ["ram", "Computer Parts", 9],
  ["ssd", "Computer Parts", 9],
  ["power supply", "Computer Parts", 9],

  // Apple Products
  ["iphone", "Apple Products", 10],
  ["ipad", "Apple Products", 10],
  ["macbook", "Apple Products", 10],
  ["airpods", "Apple Products", 10],
  ["apple watch", "Apple Products", 10],

  // Tools & Hardware
  ["tool", "Tools & Hardware", 10],
  ["drill", "Tools & Hardware", 9],
  ["saw", "Tools & Hardware", 9],
  ["hammer", "Tools & Hardware", 9],
  ["home improvement", "Tools & Hardware", 8],

  // Home & Kitchen
  ["furniture", "Home & Kitchen", 9],
  ["kitchen", "Home & Kitchen", 9],
  ["dining", "Home & Kitchen", 8],
  ["cookware", "Home & Kitchen", 9],

  // Garden & Outdoor
  ["garden", "Garden & Outdoor", 9],

  // Sports & Outdoors
  ["sporting", "Sports & Outdoors", 9],
  ["sport", "Sports & Outdoors", 8],
  ["outdoor", "Sports & Outdoors", 7],

  // Gym Equipment
  ["exercise", "Gym Equipment", 10],
  ["gym", "Gym Equipment", 10],
  ["workout", "Gym Equipment", 10],
  ["fitness", "Gym Equipment", 9],

  // Solar & Generators
  ["solar", "Solar & Generators", 10],
  ["generator", "Solar & Generators", 10],

  // Pokemon
  ["pokemon", "Pokemon", 10],
  ["pokémon", "Pokemon", 10],

  // Trading Cards
  ["trading card", "Trading Cards", 10],
  ["tcg", "Trading Cards", 10],
  ["graded card", "Trading Cards", 10],
  ["yugioh", "Trading Cards", 10],
  ["magic the gathering", "Trading Cards", 10],

  // Anime & Manga
  ["anime", "Anime & Manga", 10],
  ["manga", "Anime & Manga", 10],

  // Figurines
  ["figurine", "Figurines", 10],
  ["figure", "Figurines", 8],
  ["funko", "Figurines", 10],
  ["action figure", "Figurines", 10],

  // Vintage & Collectibles
  ["collectible", "Vintage & Collectibles", 10],
  ["antique", "Vintage & Collectibles", 10],
  ["vintage", "Vintage & Collectibles", 7],

  // Toys & Games
  ["toy", "Toys & Games", 10],
  ["game", "Toys & Games", 8],
  ["lego", "Toys & Games", 10],

  // Books & Media
  ["book", "Books & Media", 9],
  ["movie", "Books & Media", 9],
  ["music", "Books & Media", 9],
  ["dvd", "Books & Media", 9],
  ["cd", "Books & Media", 9],
  ["vinyl", "Books & Media", 9],

  // Bags & Accessories
  ["purse", "Bags & Accessories", 10],
  ["handbag", "Bags & Accessories", 10],
  ["backpack", "Bags & Accessories", 10],
  ["wallet", "Bags & Accessories", 9],

  // Jewelry & Watches
  ["jewelry", "Jewelry & Watches", 10],
  ["watch", "Jewelry & Watches", 10],
  ["necklace", "Jewelry & Watches", 9],
  ["ring", "Jewelry & Watches", 9],

  // Hair Care
  ["hair", "Hair Care", 8],
  ["shampoo", "Hair Care", 10],
  ["conditioner", "Hair Care", 10],

  // Skin Care
  ["skincare", "Skin Care", 10],
  ["skin care", "Skin Care", 10],
  ["moisturizer", "Skin Care", 10],

  // Beauty & Health
  ["health", "Beauty & Health", 8],
  ["beauty", "Beauty & Health", 8],
  ["cosmetic", "Beauty & Health", 9],
  ["makeup", "Beauty & Health", 10],
  ["perfume", "Beauty & Health", 9],

  // Pet Food
  ["pet food", "Pet Food", 10],
  ["dog food", "Pet Food", 10],
  ["cat food", "Pet Food", 10],

  // Pet Care
  ["pet", "Pet Care", 9],
  ["dog", "Pet Care", 8],
  ["cat", "Pet Care", 8],

  // Kids & Baby
  ["baby", "Kids & Baby", 10],
  ["kids", "Kids & Baby", 9],
  ["toddler", "Kids & Baby", 10],

  // Auto & Motorcycle
  ["motorcycle", "Auto & Motorcycle", 10],
  ["automotive", "Auto & Motorcycle", 9],

  // Office Supplies
  ["office", "Office Supplies", 8],

  // Musical Instruments → Electronics
  ["musical instrument", "Electronics", 8],
  ["audio", "Electronics", 7],
  ["microphone", "Electronics", 8],
  ["speaker", "Electronics", 8],
  ["stereo", "Electronics", 8],
];

/**
 * Map Facebook category ID to human-readable name
 */
export function resolveFacebookCategoryName(categoryId) {
  return FACEBOOK_CATEGORY_NAMES[categoryId] || null;
}

/**
 * Map Facebook category to Orben category using intelligent matching
 */
export function mapFacebookToOrbenCategory(facebookCategory, facebookCategoryId = null, itemTitle = null) {
  let categoryText = facebookCategory;
  if (facebookCategoryId && !categoryText) {
    categoryText = resolveFacebookCategoryName(facebookCategoryId);
  }

  if (!categoryText && !itemTitle) {
    return null;
  }

  const searchText = [categoryText, itemTitle].filter(Boolean).join(' ').toLowerCase();

  // Try direct match first
  const directMatch = ORBEN_CATEGORIES.find(cat =>
    searchText.includes(cat.toLowerCase())
  );
  if (directMatch) {
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
    return bestMatch;
  }

  return null;
}

/**
 * Ensure a category name matches an existing Orben category
 */
export function ensureCategory(categoryName) {
  if (!categoryName) return null;

  const exactMatch = ORBEN_CATEGORIES.find(cat =>
    cat.toLowerCase() === categoryName.toLowerCase()
  );
  if (exactMatch) {
    return exactMatch;
  }

  return categoryName;
}
