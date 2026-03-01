/**
 * Size Field Detection Utility
 * Detects when size fields should be shown based on title/category keywords,
 * determines gender context, and provides type-appropriate size options.
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
    'hiking boot', 'rain boot', 'jordan', 'yeezy', 'air max', 'air force',
    'new balance', 'converse', 'vans', 'nike dunk',
  ],

  tops: [
    'shirt', 'shirts', 'tee', 'tees', 't-shirt', 'tshirt', 'top', 'tops',
    'hoodie', 'hoodies', 'sweatshirt', 'sweater', 'crewneck', 'pullover',
    'jacket', 'jackets', 'coat', 'coats', 'parka', 'windbreaker', 'vest',
    'blazer', 'suit', 'tuxedo', 'cardigan', 'flannel', 'polo', 'jersey', 'uniform',
    'blouse', 'tank top', 'crop top', 'tunic', 'henley',
  ],

  bottoms: [
    'pants', 'pant', 'jeans', 'jean', 'denim', 'trousers', 'joggers', 'sweatpants',
    'leggings', 'cargos', 'cargo', 'chinos', 'slacks', 'shorts', 'boardshorts',
    'jogger', 'biker shorts', 'track pants', 'khakis', 'culottes', 'capris',
    'skirt', 'skirts',
  ],

  dresses: [
    'dress', 'dresses', 'gown', 'gowns', 'maxi dress', 'mini dress', 'midi dress',
    'cocktail dress', 'wedding dress', 'prom dress', 'romper', 'rompers',
    'jumpsuit', 'jumpsuits', 'bodysuit', 'bodysuits', 'sundress',
  ],

  outerwear: [
    'puffer', 'parka', 'raincoat', 'trench coat', 'bomber',
    'fleece', 'sherpa', 'anorak', 'overcoat', 'peacoat',
  ],

  accessories: [
    'belt', 'belts', 'scarf', 'scarves', 'glove', 'gloves', 'mitten', 'mittens',
    'sock', 'socks', 'tie', 'ties', 'bowtie', 'bag', 'purse', 'backpack', 'tote', 'wallet',
    'hat', 'hats', 'beanie', 'cap', 'visor',
  ],

  intimates: [
    'underwear', 'underwears', 'bra', 'bras', 'bralette', 'panties', 'boxers',
    'briefs', 'lingerie', 'thong', 'shapewear',
  ],

  swimwear: [
    'swimsuit', 'swimwear', 'bikini', 'bikinis', 'trunks', 'swim trunks',
    'rash guard', 'board shorts', 'one piece',
  ],
};

// Gender detection keywords
const GENDER_KEYWORDS = {
  women: [
    'women', 'womens', "women's", 'woman', 'ladies', 'lady', 'girls', 'girl',
    'female', 'misses', 'miss', 'juniors', 'junior',
  ],
  men: [
    'men', 'mens', "men's", 'man', 'boys', 'boy', 'male', 'guys', 'guy',
  ],
};

// Size option arrays by type and gender
const SIZE_OPTIONS = {
  shoes_women: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '12'],
  shoes_men: ['6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14', '15'],
  shoes_unisex: ['5', '5.5', '6', '6.5', '7', '7.5', '8', '8.5', '9', '9.5', '10', '10.5', '11', '11.5', '12', '13', '14'],
  letter: ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'],
  dresses: ['0', '2', '4', '6', '8', '10', '12', '14', '16', '18', '20'],
  waist: ['26', '27', '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42'],
  inseam: ['28', '29', '30', '31', '32', '33', '34', '36'],
  band: ['28', '30', '32', '34', '36', '38', '40', '42', '44'],
  cup: ['A', 'B', 'C', 'D', 'DD', 'DDD'],
};

/**
 * Detect gender from title/description text.
 * @returns {'women' | 'men' | 'unisex'}
 */
export function detectGender(text = '') {
  const lower = text.toLowerCase();
  let womenScore = 0;
  let menScore = 0;

  for (const kw of GENDER_KEYWORDS.women) {
    if (lower.includes(kw)) womenScore++;
  }
  for (const kw of GENDER_KEYWORDS.men) {
    // Avoid false positives: "women" contains "men", so only match as whole word
    const regex = new RegExp(`\\b${kw}\\b`, 'i');
    if (regex.test(lower)) menScore++;
  }

  if (womenScore > menScore) return 'women';
  if (menScore > womenScore) return 'men';
  return 'unisex';
}

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

  for (const [sizeType, keywords] of Object.entries(SIZE_KEYWORDS)) {
    for (const keyword of keywords) {
      // Use word boundary check for short keywords to avoid false matches
      if (keyword.length <= 3) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (regex.test(combinedText)) {
          return { showSize: true, sizeType };
        }
      } else if (combinedText.includes(keyword.toLowerCase())) {
        return { showSize: true, sizeType };
      }
    }
  }

  // Also check if category explicitly contains sizing keywords
  const sizingCategories = ['clothing', 'apparel', 'fashion', 'footwear', 'shoes',
    'women', 'men', 'kids'];
  if (sizingCategories.some(cat => lowerCategory.includes(cat))) {
    return { showSize: true, sizeType: 'tops' };
  }

  return { showSize: false, sizeType: null };
}

/**
 * Get comprehensive size info for rendering the smart size picker.
 * @param {string} title
 * @param {string} description
 * @param {string} category
 * @returns {{ showSize: boolean, sizeType: string|null, gender: string, label: string, options: object, placeholder: string }}
 */
export function getSizeInfo(title = '', description = '', category = '') {
  const { showSize, sizeType } = shouldShowSizeField(title, category);

  if (!showSize) {
    return { showSize: false, sizeType: null, gender: 'unisex', label: '', options: null, placeholder: '' };
  }

  const combinedText = `${title} ${description}`;
  const gender = detectGender(combinedText);

  // Build label
  let label = 'Size';
  if (sizeType === 'shoes') {
    label = gender === 'women' ? "Women's Shoe Size"
      : gender === 'men' ? "Men's Shoe Size"
      : 'Shoe Size';
  } else if (sizeType === 'bottoms') {
    label = 'Waist × Inseam';
  } else if (sizeType === 'intimates') {
    label = 'Band × Cup';
  } else if (sizeType === 'dresses') {
    label = gender === 'women' ? "Women's Size" : 'Size';
  } else {
    label = gender === 'women' ? "Women's Size"
      : gender === 'men' ? "Men's Size"
      : 'Size';
  }

  // Build options
  let options;
  if (sizeType === 'shoes') {
    const shoeKey = `shoes_${gender}`;
    options = {
      type: 'single',
      values: SIZE_OPTIONS[shoeKey] || SIZE_OPTIONS.shoes_unisex,
    };
  } else if (sizeType === 'bottoms') {
    options = {
      type: 'dual',
      waist: SIZE_OPTIONS.waist,
      inseam: SIZE_OPTIONS.inseam,
      letterSizes: SIZE_OPTIONS.letter,
    };
  } else if (sizeType === 'intimates') {
    options = {
      type: 'dual',
      band: SIZE_OPTIONS.band,
      cup: SIZE_OPTIONS.cup,
      letterSizes: SIZE_OPTIONS.letter,
    };
  } else if (sizeType === 'dresses') {
    options = {
      type: 'single',
      values: [...SIZE_OPTIONS.dresses, ...SIZE_OPTIONS.letter],
    };
  } else if (sizeType === 'accessories') {
    options = {
      type: 'single',
      values: ['One Size', ...SIZE_OPTIONS.letter],
    };
  } else {
    // tops, outerwear, swimwear, general
    options = {
      type: 'single',
      values: SIZE_OPTIONS.letter,
    };
  }

  const placeholder = getSizePlaceholder(sizeType);

  return { showSize, sizeType, gender, label, options, placeholder };
}

/**
 * Get appropriate size placeholder based on detected type
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
    general: 'Enter size',
  };

  return placeholders[sizeType] || placeholders.general;
}
