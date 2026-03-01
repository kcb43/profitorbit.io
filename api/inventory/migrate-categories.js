import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

/**
 * Map of old category names → new Orben categories.
 * Covers both original Orben categories and intermediate Mercari-based ones.
 */
const CATEGORY_MAP = {
  // Original Orben categories
  'Antiques': 'Vintage & Collectibles',
  'Books, Movies & Music': 'Books & Media',
  'Clothing & Apparel': 'Clothing & Apparel',
  'Collectibles': 'Vintage & Collectibles',
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
  // Mercari-based categories
  'Women': 'Clothing & Apparel',
  'Men': 'Clothing & Apparel',
  'Kids': 'Kids & Baby',
  'Home': 'Home & Kitchen',
  'Beauty': 'Beauty & Health',
  'Books': 'Books & Media',
  'Pet Supplies': 'Pet Care',
  'Toys & Collectibles': 'Toys & Games',
  'Office': 'Office Supplies',
  'Handmade': 'Handmade',
};

/**
 * Keyword hints to refine generic mappings.
 * e.g. "Men" normally maps to "Clothing & Apparel",
 * but if the item title contains "sneaker" or "jordan", it should be "Shoes & Sneakers".
 */
const TITLE_OVERRIDES = [
  { keywords: ['sneaker', 'shoe', 'boot', 'jordan', 'yeezy', 'new balance', 'converse', 'vans', 'air max', 'air force', 'dunks', 'dunk low', 'dunk high', 'crocs', 'slides', 'sandal', 'heels', 'loafer', 'slipper', 'cleat', 'timberland'], category: 'Shoes & Sneakers' },
  { keywords: ['gpu', 'cpu', 'motherboard', 'ram', 'ssd', 'graphics card', 'rtx', 'gtx', 'radeon', 'ryzen', 'intel core', 'power supply', 'psu', 'pc case', 'nvme'], category: 'Computer Parts' },
  { keywords: ['iphone', 'ipad', 'macbook', 'imac', 'apple watch', 'airpods', 'apple tv', 'magsafe', 'apple pencil', 'homepod', 'mac mini'], category: 'Apple Products' },
  { keywords: ['pokemon', 'pikachu', 'charizard', 'pokémon'], category: 'Pokemon' },
  { keywords: ['trading card', 'tcg', 'booster pack', 'booster box', 'graded card', 'psa', 'bgs', 'cgc', 'sports card', 'yugioh', 'yu-gi-oh', 'magic the gathering', 'mtg'], category: 'Trading Cards' },
  { keywords: ['anime', 'manga', 'banpresto', 'bandai', 'nendoroid', 'figma', 'dragon ball', 'naruto', 'one piece', 'demon slayer', 'jujutsu kaisen', 'my hero academia', 'sailor moon', 'studio ghibli', 'attack on titan'], category: 'Anime & Manga' },
  { keywords: ['figurine', 'figure', 'funko', 'funko pop', 'action figure', 'hot toys', 'sideshow', 'amiibo', 'bobblehead', 'statue'], category: 'Figurines' },
  { keywords: ['solar panel', 'solar', 'generator', 'power station', 'ecoflow', 'jackery', 'bluetti', 'goal zero'], category: 'Solar & Generators' },
  { keywords: ['gym', 'workout', 'dumbbell', 'barbell', 'kettlebell', 'treadmill', 'elliptical', 'exercise bike', 'squat rack', 'weight plate', 'resistance band'], category: 'Gym Equipment' },
  { keywords: ['shampoo', 'conditioner', 'hair dryer', 'hair straightener', 'curling iron', 'wig', 'hair extension', 'dyson airwrap', 'flat iron'], category: 'Hair Care' },
  { keywords: ['skincare', 'skin care', 'moisturizer', 'serum', 'cleanser', 'sunscreen', 'retinol', 'cerave', 'the ordinary'], category: 'Skin Care' },
  { keywords: ['dog food', 'cat food', 'pet food', 'kibble', 'treats'], category: 'Pet Food' },
  { keywords: ['purse', 'handbag', 'backpack', 'wallet', 'tote', 'clutch', 'fanny pack', 'crossbody', 'duffel', 'luggage', 'suitcase', 'briefcase'], category: 'Bags & Accessories' },
  { keywords: ['jewelry', 'necklace', 'bracelet', 'ring', 'earring', 'pendant', 'chain', 'rolex', 'watch', 'cufflink', 'brooch'], category: 'Jewelry & Watches' },
];

/**
 * Given an old category and item title, determine the best new category.
 */
function resolveNewCategory(oldCategory, itemName) {
  if (!oldCategory) return null;

  // First check if title overrides apply (more specific than generic map)
  if (itemName) {
    const lower = itemName.toLowerCase();
    for (const rule of TITLE_OVERRIDES) {
      if (rule.keywords.some(kw => lower.includes(kw))) {
        return rule.category;
      }
    }
  }

  // Fall back to the static map
  return CATEGORY_MAP[oldCategory] || null;
}

// Current valid categories — anything already in this set is left alone
const VALID_CATEGORIES = new Set([
  'Shoes & Sneakers', 'Clothing & Apparel', 'Electronics', 'Computer Parts',
  'Apple Products', 'Bags & Accessories', 'Jewelry & Watches', 'Home & Kitchen',
  'Sports & Outdoors', 'Gym Equipment', 'Toys & Games', 'Trading Cards',
  'Pokemon', 'Anime & Manga', 'Figurines', 'Books & Media', 'Hair Care',
  'Skin Care', 'Beauty & Health', 'Vintage & Collectibles', 'Tools & Hardware',
  'Pet Food', 'Pet Care', 'Arts & Crafts', 'Kids & Baby', 'Garden & Outdoor',
  'Solar & Generators', 'Office Supplies', 'Auto & Motorcycle', 'Handmade', 'Other',
]);

/**
 * POST /api/inventory/migrate-categories
 *
 * One-time migration: updates all inventory_items and sales records
 * from old category names to the new Orben category system.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Auth
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = user.id;

    let invUpdated = 0;
    let salesUpdated = 0;
    const changes = [];

    // ── Migrate inventory_items ──────────────────────────────────────
    const { data: invItems, error: invErr } = await supabase
      .from('inventory_items')
      .select('id, item_name, category')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (invErr) throw invErr;

    for (const item of invItems) {
      if (!item.category || VALID_CATEGORIES.has(item.category)) continue;

      const newCat = resolveNewCategory(item.category, item.item_name);
      if (!newCat || newCat === item.category) continue;

      const { error } = await supabase
        .from('inventory_items')
        .update({ category: newCat })
        .eq('id', item.id);

      if (!error) {
        invUpdated++;
        changes.push({ type: 'inventory', name: item.item_name, from: item.category, to: newCat });
      }
    }

    // ── Migrate sales ────────────────────────────────────────────────
    const { data: salesItems, error: salesErr } = await supabase
      .from('sales')
      .select('id, item_name, category')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (salesErr) throw salesErr;

    for (const sale of salesItems) {
      if (!sale.category || VALID_CATEGORIES.has(sale.category)) continue;

      const newCat = resolveNewCategory(sale.category, sale.item_name);
      if (!newCat || newCat === sale.category) continue;

      const { error } = await supabase
        .from('sales')
        .update({ category: newCat })
        .eq('id', sale.id);

      if (!error) {
        salesUpdated++;
        changes.push({ type: 'sale', name: sale.item_name, from: sale.category, to: newCat });
      }
    }

    return res.status(200).json({
      success: true,
      inventoryUpdated: invUpdated,
      salesUpdated: salesUpdated,
      totalUpdated: invUpdated + salesUpdated,
      changes,
    });
  } catch (error) {
    console.error('Category migration error:', error);
    return res.status(500).json({ error: 'Migration failed', details: error.message });
  }
}
