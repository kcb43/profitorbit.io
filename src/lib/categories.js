/**
 * Orben Product Categories — Single Source of Truth
 *
 * Based on Mercari's 17 top-level categories. Imported by:
 *   - AddInventoryItem.jsx
 *   - AddSale.jsx
 *   - SalesHistory.jsx
 *   - CrosslistComposer.jsx
 *   - categoryMapper.js (server-side copy)
 */

export const CATEGORIES = [
  'Women',
  'Men',
  'Kids',
  'Home',
  'Vintage & Collectibles',
  'Beauty',
  'Electronics',
  'Sports & Outdoors',
  'Handmade',
  'Other',
  'Arts & Crafts',
  'Books',
  'Pet Supplies',
  'Toys & Collectibles',
  'Garden & Outdoor',
  'Office',
  'Tools',
];

export const UNCATEGORIZED = 'Uncategorized';

/**
 * Map old Orben categories → new Mercari-based categories.
 * Used for migrating existing inventory items.
 */
export const LEGACY_CATEGORY_MAP = {
  'Antiques': 'Vintage & Collectibles',
  'Books, Movies & Music': 'Books',
  'Clothing & Apparel': 'Women',
  'Collectibles': 'Vintage & Collectibles',
  'Electronics': 'Electronics',
  'Gym/Workout': 'Sports & Outdoors',
  'Health & Beauty': 'Beauty',
  'Home & Garden': 'Home',
  'Jewelry & Watches': 'Women',
  'Kitchen': 'Home',
  'Makeup': 'Beauty',
  'Mic/Audio Equipment': 'Electronics',
  'Motorcycle': 'Other',
  'Motorcycle Accessories': 'Other',
  'Pets': 'Pet Supplies',
  'Pool Equipment': 'Garden & Outdoor',
  'Shoes/Sneakers': 'Men',
  'Sporting Goods': 'Sports & Outdoors',
  'Stereos & Speakers': 'Electronics',
  'Tools': 'Tools',
  'Toys & Hobbies': 'Toys & Collectibles',
  'Yoga': 'Sports & Outdoors',
};

/**
 * Convert an old Orben category to the new Mercari-based system.
 * Returns UNCATEGORIZED if no mapping exists.
 */
export function migrateLegacyCategory(oldCategory) {
  if (!oldCategory) return UNCATEGORIZED;
  // Already a new category?
  if (CATEGORIES.includes(oldCategory)) return oldCategory;
  return LEGACY_CATEGORY_MAP[oldCategory] || UNCATEGORIZED;
}

/**
 * Client-side keyword matcher: guess a category from a product title.
 * Returns { category, confidence } or null.
 */
const CATEGORY_KEYWORDS = [
  { keywords: ['phone', 'iphone', 'samsung', 'tablet', 'ipad', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'headphone', 'earbuds', 'airpods', 'speaker', 'camera', 'tv', 'television', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'switch', 'gpu', 'cpu', 'motherboard', 'ssd', 'hard drive', 'charger', 'cable', 'adapter', 'router', 'modem', 'printer', 'drone'], category: 'Electronics' },
  { keywords: ['dress', 'blouse', 'skirt', 'legging', 'bra', 'lingerie', 'purse', 'handbag', 'womens', "women's", 'bikini', 'romper', 'jumpsuit', 'cardigan', 'tunic', 'sundress', 'heels', 'sandals'], category: 'Women' },
  { keywords: ['mens', "men's", 'polo', 'blazer', 'suit', 'tie', 'cufflink', 'boxer'], category: 'Men' },
  { keywords: ['baby', 'toddler', 'infant', 'kids', 'children', 'boys', 'girls', 'onesie', 'stroller', 'car seat', 'diaper'], category: 'Kids' },
  { keywords: ['couch', 'sofa', 'table', 'chair', 'lamp', 'rug', 'curtain', 'pillow', 'blanket', 'vase', 'decor', 'furniture', 'shelf', 'cabinet', 'mirror', 'candle', 'frame', 'kitchen', 'cookware', 'pan', 'pot', 'knife', 'blender', 'mixer', 'utensil', 'plate', 'bowl', 'mug', 'cup'], category: 'Home' },
  { keywords: ['vintage', 'antique', 'collectible', 'rare', 'retro', 'memorabilia', 'coin', 'stamp', 'figurine', 'statue'], category: 'Vintage & Collectibles' },
  { keywords: ['makeup', 'lipstick', 'mascara', 'foundation', 'concealer', 'eyeshadow', 'palette', 'skincare', 'serum', 'moisturizer', 'perfume', 'cologne', 'fragrance', 'lotion', 'shampoo', 'conditioner', 'hair', 'nail polish', 'beauty'], category: 'Beauty' },
  { keywords: ['nike', 'adidas', 'puma', 'under armour', 'gym', 'workout', 'yoga', 'fitness', 'dumbell', 'barbell', 'bicycle', 'bike', 'tennis', 'basketball', 'football', 'soccer', 'baseball', 'golf', 'fishing', 'camping', 'hiking', 'kayak', 'surfboard', 'skateboard', 'snowboard', 'ski'], category: 'Sports & Outdoors' },
  { keywords: ['handmade', 'handcrafted', 'custom made', 'hand knit', 'crochet', 'macrame', 'hand sewn', 'hand painted'], category: 'Handmade' },
  { keywords: ['yarn', 'fabric', 'sewing', 'knitting', 'embroidery', 'craft', 'scrapbook', 'bead', 'paint', 'canvas', 'art supply', 'glue gun', 'stencil'], category: 'Arts & Crafts' },
  { keywords: ['book', 'novel', 'textbook', 'manga', 'comic', 'dvd', 'blu-ray', 'vinyl', 'record', 'cd', 'magazine'], category: 'Books' },
  { keywords: ['dog', 'cat', 'pet', 'puppy', 'kitten', 'fish tank', 'aquarium', 'bird', 'hamster', 'leash', 'collar', 'pet food', 'litter'], category: 'Pet Supplies' },
  { keywords: ['toy', 'lego', 'action figure', 'doll', 'barbie', 'hot wheels', 'nerf', 'puzzle', 'board game', 'card game', 'pokemon', 'funko', 'anime figure', 'plush', 'stuffed animal'], category: 'Toys & Collectibles' },
  { keywords: ['garden', 'plant', 'planter', 'pot', 'lawn', 'mower', 'hose', 'sprinkler', 'patio', 'grill', 'bbq', 'outdoor furniture', 'umbrella', 'pool', 'hot tub'], category: 'Garden & Outdoor' },
  { keywords: ['desk', 'office chair', 'stapler', 'binder', 'notebook', 'pen', 'pencil', 'calculator', 'whiteboard', 'filing', 'organizer', 'planner'], category: 'Office' },
  { keywords: ['drill', 'saw', 'wrench', 'screwdriver', 'hammer', 'plier', 'socket', 'tool set', 'tool box', 'tape measure', 'level', 'clamp', 'sander', 'grinder', 'welder', 'compressor'], category: 'Tools' },
  { keywords: ['sneaker', 'shoe', 'boot', 'jordan', 'yeezy', 'new balance', 'converse', 'vans', 'air max', 'air force'], category: 'Men' },
  { keywords: ['shirt', 'hoodie', 'jacket', 'jeans', 'pants', 'shorts', 'sweater', 'coat', 'hat', 'cap', 'beanie', 'gloves', 'scarf', 'belt', 'wallet', 'backpack', 'watch', 'sunglasses', 'jewelry', 'necklace', 'bracelet', 'ring', 'earring'], category: 'Women' },
];

export function suggestCategoryFromTitle(title) {
  if (!title || title.length < 3) return null;
  const lower = title.toLowerCase();
  let bestMatch = null;
  let bestScore = 0;

  for (const entry of CATEGORY_KEYWORDS) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (lower.includes(kw)) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = entry.category;
    }
  }

  if (bestScore === 0) return null;
  const confidence = Math.min(0.5 + bestScore * 0.15, 0.95);
  return { category: bestMatch, confidence };
}
