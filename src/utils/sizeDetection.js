/**
 * Size Field Detection Utility
 * Detects when size fields should be shown based on title/category keywords
 */

// Keyword groups for different size categories
const SIZE_KEYWORDS = {
  shoes: [
    'shoe', 'shoes', 'sneaker', 'sneakers', 'trainer', 'trainers', 'boot', 'boots',
    'heel', 'heels', 'loafer', 'loafers', 'sandal', 'sandals', 'slide', 'slides',
    'clog', 'clogs', 'mule', 'mules', 'cleat', 'cleats', 'spike', 'spikes',
    'slipper', 'slippers', 'moccasin', 'moccasins', 'oxford', 'oxfords', 'flat', 'flats',
    'platform', 'wedge', 'wedges', 'espadrille', 'croc', 'crocs', 'footwear',
    'running shoe', 'basketball shoe', 'tennis shoe', 'skate shoe', 'work boot',
    'hiking boot', 'rain boot'
  ],
  
  tops: [
    'shirt', 'shirts', 'tee', 'tees', 't-shirt', 'tshirt', 'top', 'tops',
    'hoodie', 'hoodies', 'sweatshirt', 'sweater', 'crewneck', 'pullover',
    'jacket', 'jackets', 'coat', 'coats', 'parka', 'windbreaker', 'vest',
    'blazer', 'suit', 'tuxedo', 'cardigan', 'flannel', 'polo', 'jersey', 'uniform'
  ],
  
  bottoms: [
    'pants', 'pant', 'jeans', 'jean', 'denim', 'trousers', 'joggers', 'sweatpants',
    'leggings', 'cargos', 'cargo', 'chinos', 'slacks', 'shorts', 'boardshorts',
    'jogger', 'biker shorts', 'track pants'
  ],
  
  dresses: [
    'dress', 'dresses', 'gown', 'gowns', 'maxi dress', 'mini dress', 'midi dress',
    'cocktail dress', 'wedding dress', 'prom dress', 'romper', 'rompers',
    'jumpsuit', 'jumpsuits', 'bodysuit', 'bodysuits'
  ],
  
  outerwear: [
    'jacket', 'coat', 'puffer', 'parka', 'raincoat', 'trench coat', 'bomber',
    'windbreaker', 'fleece', 'sherpa', 'anorak'
  ],
  
  accessories: [
    'belt', 'belts', 'scarf', 'scarves', 'glove', 'gloves', 'mitten', 'mittens',
    'sock', 'socks', 'tie', 'ties', 'bowtie', 'bag', 'purse', 'backpack', 'tote', 'wallet'
  ],
  
  intimates: [
    'underwear', 'underwears', 'bra', 'bras', 'bralette', 'panties', 'boxers',
    'briefs', 'lingerie'
  ],
  
  swimwear: [
    'swimsuit', 'swimwear', 'bikini', 'bikinis', 'trunks'
  ]
};

/**
 * Detect if size field should be shown based on title or category
 * @param {string} title - Item title
 * @param {string} category - Item category
 * @returns {Object} { showSize: boolean, sizeType: string|null }
 */
export function shouldShowSizeField(title = '', category = '') {
  const lowerTitle = (title || '').toLowerCase();
  const lowerCategory = (category || '').toLowerCase();
  const combinedText = `${lowerTitle} ${lowerCategory}`;
  
  // Check each keyword group
  for (const [sizeType, keywords] of Object.entries(SIZE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (combinedText.includes(keyword.toLowerCase())) {
        return { showSize: true, sizeType };
      }
    }
  }
  
  // Also check if category explicitly contains sizing keywords
  const sizingCategories = ['clothing', 'apparel', 'fashion', 'footwear', 'shoes', 'accessories'];
  if (sizingCategories.some(cat => lowerCategory.includes(cat))) {
    return { showSize: true, sizeType: 'general' };
  }
  
  return { showSize: false, sizeType: null };
}

/**
 * Get appropriate size placeholder based on detected type
 * @param {string} sizeType
 * @returns {string}
 */
export function getSizePlaceholder(sizeType) {
  const placeholders = {
    shoes: 'e.g., 9, 10.5, 42 EU',
    tops: 'e.g., S, M, L, XL',
    bottoms: 'e.g., 32x30, 34W',
    dresses: 'e.g., 2, 4, 6, 8',
    outerwear: 'e.g., S, M, L, XL',
    accessories: 'e.g., OS (One Size)',
    intimates: 'e.g., 32B, 34C, M',
    swimwear: 'e.g., S, M, L',
    general: 'Enter size'
  };
  
  return placeholders[sizeType] || placeholders.general;
}

/**
 * Map Mercari category to our inventory category
 * @param {string} mercariCategory - Category from Mercari
 * @returns {string} Mapped category or custom category
 */
export function mapMercariCategory(mercariCategory) {
  if (!mercariCategory) return null;
  
  const categoryMap = {
    // Mercari -> Inventory mapping
    'Shoes': 'Shoes',
    'Sneakers': 'Shoes',
    'Boots': 'Shoes',
    'Sandals': 'Shoes',
    'Women\'s Shoes': 'Shoes',
    'Men\'s Shoes': 'Shoes',
    'Tops': 'Clothing',
    'Shirts': 'Clothing',
    'Sweaters': 'Clothing',
    'Jackets & Coats': 'Clothing',
    'Dresses': 'Clothing',
    'Pants': 'Clothing',
    'Jeans': 'Clothing',
    'Shorts': 'Clothing',
    'Skirts': 'Clothing',
    'Bags': 'Accessories',
    'Handbags': 'Accessories',
    'Backpacks': 'Accessories',
    'Jewelry': 'Accessories',
    'Watches': 'Accessories',
    'Sunglasses': 'Accessories',
    'Electronics': 'Electronics',
    'Toys': 'Toys',
    'Home': 'Home',
    'Beauty': 'Beauty',
    'Sports': 'Sports',
    'Books': 'Books',
  };
  
  // Try exact match first
  if (categoryMap[mercariCategory]) {
    return categoryMap[mercariCategory];
  }
  
  // Try partial match
  for (const [key, value] of Object.entries(categoryMap)) {
    if (mercariCategory.includes(key) || key.includes(mercariCategory)) {
      return value;
    }
  }
  
  // Return as custom category if no match
  return mercariCategory;
}
