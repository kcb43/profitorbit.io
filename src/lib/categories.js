/**
 * Orben Product Categories — Single Source of Truth
 *
 * Product-type categories for resellers. Imported by:
 *   - AddInventoryItem.jsx
 *   - AddSale.jsx
 *   - SalesHistory.jsx
 *   - CrosslistComposer.jsx
 *   - categoryMapper.js (server-side copy)
 */

export const CATEGORIES = [
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

export const UNCATEGORIZED = 'Uncategorized';

/**
 * Map old categories → new Orben categories.
 * Covers both original Orben categories and the intermediate Mercari-based set.
 */
export const LEGACY_CATEGORY_MAP = {
  // Original Orben categories
  'Antiques': 'Vintage & Collectibles',
  'Books, Movies & Music': 'Books & Media',
  'Clothing & Apparel': 'Clothing & Apparel',
  'Collectibles': 'Vintage & Collectibles',
  'Electronics': 'Electronics',
  'Gym/Workout': 'Gym Equipment',
  'Health & Beauty': 'Beauty & Health',
  'Home & Garden': 'Home & Kitchen',
  'Jewelry & Watches': 'Jewelry & Watches',
  'Kitchen': 'Home & Kitchen',
  'Makeup': 'Beauty & Health',
  'Mic/Audio Equipment': 'Electronics',
  'Motorcycle': 'Auto & Motorcycle',
  'Motorcycle Accessories': 'Auto & Motorcycle',
  'Pets': 'Pet Care',
  'Pool Equipment': 'Garden & Outdoor',
  'Shoes/Sneakers': 'Shoes & Sneakers',
  'Sporting Goods': 'Sports & Outdoors',
  'Stereos & Speakers': 'Electronics',
  'Tools': 'Tools & Hardware',
  'Toys & Hobbies': 'Toys & Games',
  'Yoga': 'Gym Equipment',
  // Mercari-based categories (intermediate migration)
  'Women': 'Clothing & Apparel',
  'Men': 'Clothing & Apparel',
  'Kids': 'Kids & Baby',
  'Home': 'Home & Kitchen',
  'Beauty': 'Beauty & Health',
  'Books': 'Books & Media',
  'Pet Supplies': 'Pet Care',
  'Toys & Collectibles': 'Toys & Games',
  'Office': 'Office Supplies',
};

/**
 * Convert an old category to the current system.
 * Returns UNCATEGORIZED if no mapping exists.
 */
export function migrateLegacyCategory(oldCategory) {
  if (!oldCategory) return UNCATEGORIZED;
  if (CATEGORIES.includes(oldCategory)) return oldCategory;
  return LEGACY_CATEGORY_MAP[oldCategory] || UNCATEGORIZED;
}

/**
 * Client-side keyword matcher: guess a category from a product title.
 * Returns { category, confidence } or null.
 *
 * More specific categories are listed first so they match before generic ones.
 */
const CATEGORY_KEYWORDS = [
  // Specific categories first (higher priority)
  { keywords: ['sneaker', 'shoe', 'boot', 'jordan', 'yeezy', 'new balance', 'converse', 'vans', 'air max', 'air force', 'dunks', 'dunk low', 'dunk high', 'crocs', 'slides', 'heels', 'sandals', 'loafer', 'slipper', 'cleat', 'timberland'], category: 'Shoes & Sneakers' },
  { keywords: ['pokemon', 'pikachu', 'charizard', 'pokémon', 'poke ball', 'tcg pokemon'], category: 'Pokemon' },
  { keywords: ['trading card', 'tcg', 'booster pack', 'booster box', 'graded card', 'psa', 'bgs', 'cgc', 'sports card', 'baseball card', 'football card', 'basketball card', 'yugioh', 'yu-gi-oh', 'magic the gathering', 'mtg', 'one piece card', 'digimon card'], category: 'Trading Cards' },
  { keywords: ['anime figure', 'anime figurine', 'manga figure', 'banpresto', 'bandai', 'nendoroid', 'figma', 'prize figure', 'scale figure', 'anime statue', 'anime poster', 'anime plush', 'anime dvd', 'anime blu-ray', 'manga', 'manga set', 'light novel', 'weeb', 'otaku', 'demon slayer', 'one piece', 'naruto', 'dragon ball', 'my hero academia', 'jujutsu kaisen', 'attack on titan', 'sailor moon', 'studio ghibli'], category: 'Anime & Manga' },
  { keywords: ['figurine', 'figure', 'statue', 'funko', 'funko pop', 'action figure', 'hot toys', 'sideshow', 'collectible figure', 'vinyl figure', 'bobblehead', 'amiibo'], category: 'Figurines' },
  { keywords: ['apple', 'iphone', 'ipad', 'macbook', 'imac', 'mac mini', 'mac pro', 'apple watch', 'airpods', 'apple tv', 'magsafe', 'lightning cable', 'apple pencil', 'homepod'], category: 'Apple Products' },
  { keywords: ['gpu', 'cpu', 'motherboard', 'ram', 'ssd', 'hard drive', 'hdd', 'nvme', 'power supply', 'psu', 'graphics card', 'rtx', 'gtx', 'radeon', 'ryzen', 'intel core', 'pc case', 'computer case', 'pc fan', 'cooler', 'aio', 'thermal paste', 'pc build', 'computer part'], category: 'Computer Parts' },
  { keywords: ['solar panel', 'solar', 'generator', 'portable power', 'power station', 'inverter', 'battery bank', 'solar charger', 'ecoflow', 'jackery', 'bluetti', 'goal zero'], category: 'Solar & Generators' },
  { keywords: ['gym', 'workout', 'dumbbell', 'barbell', 'kettlebell', 'bench press', 'weight plate', 'resistance band', 'pull up bar', 'yoga mat', 'exercise bike', 'treadmill', 'elliptical', 'rowing machine', 'home gym', 'squat rack', 'power rack', 'fitness equipment', 'exercise'], category: 'Gym Equipment' },
  { keywords: ['shampoo', 'conditioner', 'hair dryer', 'hair straightener', 'curling iron', 'hair clip', 'hair product', 'hair oil', 'hair serum', 'hair spray', 'hair care', 'wig', 'hair extension', 'dyson airwrap', 'flat iron'], category: 'Hair Care' },
  { keywords: ['skincare', 'skin care', 'moisturizer', 'serum', 'cleanser', 'toner', 'sunscreen', 'spf', 'retinol', 'hyaluronic', 'face mask', 'face cream', 'acne', 'exfoliant', 'derma', 'cerave', 'the ordinary', 'drunk elephant'], category: 'Skin Care' },
  { keywords: ['dog food', 'cat food', 'pet food', 'kibble', 'wet food', 'treats', 'dog treats', 'cat treats', 'bird seed', 'fish food'], category: 'Pet Food' },
  { keywords: ['dog', 'cat', 'pet', 'puppy', 'kitten', 'fish tank', 'aquarium', 'bird', 'hamster', 'leash', 'collar', 'litter', 'pet bed', 'pet carrier', 'pet toy', 'pet crate', 'pet cage', 'grooming'], category: 'Pet Care' },
  // General categories
  { keywords: ['phone', 'samsung', 'tablet', 'laptop', 'computer', 'monitor', 'keyboard', 'mouse', 'headphone', 'earbuds', 'speaker', 'camera', 'tv', 'television', 'gaming', 'console', 'playstation', 'xbox', 'nintendo', 'switch', 'charger', 'cable', 'adapter', 'router', 'modem', 'printer', 'drone', 'projector', 'smart watch', 'fitbit', 'garmin', 'ring doorbell', 'nest', 'echo', 'alexa'], category: 'Electronics' },
  { keywords: ['shirt', 'hoodie', 'jacket', 'jeans', 'pants', 'shorts', 'sweater', 'coat', 'hat', 'cap', 'beanie', 'gloves', 'scarf', 'dress', 'blouse', 'skirt', 'legging', 'bra', 'lingerie', 'bikini', 'romper', 'jumpsuit', 'cardigan', 'tunic', 'sundress', 'polo', 'blazer', 'suit', 'tie', 'jersey', 'vest', 'flannel', 'tank top', 'sweatpants', 'joggers'], category: 'Clothing & Apparel' },
  { keywords: ['purse', 'handbag', 'backpack', 'wallet', 'belt', 'sunglasses', 'watch', 'bag', 'tote', 'clutch', 'fanny pack', 'crossbody', 'duffel', 'luggage', 'suitcase', 'briefcase', 'messenger bag', 'laptop bag'], category: 'Bags & Accessories' },
  { keywords: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'chain', 'gold', 'silver', 'diamond', 'rolex', 'casio', 'seiko', 'fossil', 'cufflink', 'brooch', 'anklet'], category: 'Jewelry & Watches' },
  { keywords: ['couch', 'sofa', 'table', 'chair', 'lamp', 'rug', 'curtain', 'pillow', 'blanket', 'vase', 'decor', 'furniture', 'shelf', 'cabinet', 'mirror', 'candle', 'frame', 'kitchen', 'cookware', 'pan', 'pot', 'knife', 'blender', 'mixer', 'utensil', 'plate', 'bowl', 'mug', 'cup', 'air fryer', 'instant pot', 'keurig', 'coffee maker'], category: 'Home & Kitchen' },
  { keywords: ['nike', 'adidas', 'puma', 'under armour', 'bicycle', 'bike', 'tennis', 'basketball', 'football', 'soccer', 'baseball', 'golf', 'fishing', 'camping', 'hiking', 'kayak', 'surfboard', 'skateboard', 'snowboard', 'ski', 'hunting', 'climbing', 'boxing'], category: 'Sports & Outdoors' },
  { keywords: ['vintage', 'antique', 'collectible', 'rare', 'retro', 'memorabilia', 'coin', 'stamp'], category: 'Vintage & Collectibles' },
  { keywords: ['makeup', 'lipstick', 'mascara', 'foundation', 'concealer', 'eyeshadow', 'palette', 'perfume', 'cologne', 'fragrance', 'lotion', 'nail polish', 'beauty', 'vitamin', 'supplement'], category: 'Beauty & Health' },
  { keywords: ['toy', 'lego', 'doll', 'barbie', 'hot wheels', 'nerf', 'puzzle', 'board game', 'card game', 'plush', 'stuffed animal', 'rc car', 'remote control'], category: 'Toys & Games' },
  { keywords: ['book', 'novel', 'textbook', 'comic', 'dvd', 'blu-ray', 'vinyl', 'record', 'cd', 'magazine', 'audiobook'], category: 'Books & Media' },
  { keywords: ['yarn', 'fabric', 'sewing', 'knitting', 'embroidery', 'craft', 'scrapbook', 'bead', 'paint', 'canvas', 'art supply', 'glue gun', 'stencil'], category: 'Arts & Crafts' },
  { keywords: ['baby', 'toddler', 'infant', 'kids', 'children', 'boys', 'girls', 'onesie', 'stroller', 'car seat', 'diaper', 'nursery', 'baby monitor', 'high chair', 'baby bottle'], category: 'Kids & Baby' },
  { keywords: ['garden', 'plant', 'planter', 'lawn', 'mower', 'hose', 'sprinkler', 'patio', 'grill', 'bbq', 'outdoor furniture', 'umbrella', 'pool', 'hot tub', 'landscaping'], category: 'Garden & Outdoor' },
  { keywords: ['desk', 'office chair', 'stapler', 'binder', 'notebook', 'pen', 'pencil', 'calculator', 'whiteboard', 'filing', 'organizer', 'planner', 'shredder', 'label maker'], category: 'Office Supplies' },
  { keywords: ['drill', 'saw', 'wrench', 'screwdriver', 'hammer', 'plier', 'socket', 'tool set', 'tool box', 'tape measure', 'level', 'clamp', 'sander', 'grinder', 'welder', 'compressor', 'nail gun'], category: 'Tools & Hardware' },
  { keywords: ['car', 'truck', 'motorcycle', 'motor', 'automotive', 'obd', 'dash cam', 'car stereo', 'exhaust', 'bumper', 'headlight', 'taillight', 'wheel', 'tire', 'rim', 'helmet'], category: 'Auto & Motorcycle' },
  { keywords: ['handmade', 'handcrafted', 'custom made', 'hand knit', 'crochet', 'macrame', 'hand sewn', 'hand painted'], category: 'Handmade' },
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
