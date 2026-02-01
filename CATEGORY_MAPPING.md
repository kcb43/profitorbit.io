# Category Mapping System

## Overview
Intelligent category mapping between Facebook Marketplace and Orben's predefined categories.

## How It Works

### 1. Facebook Category ID Resolution
Facebook uses numeric category IDs (e.g., `1604770196468207`). The system first resolves these to human-readable names:

```javascript
"1604770196468207" → "Men's Shoes"
"1670493229902393" → "Home Improvement & Tools"
"1490597741229197" → "Electronics"
```

### 2. Category Mapping
The system then maps Facebook categories to Orben's predefined categories using:

**Direct Matching** (highest priority)
- Exact text match: "Shoes" → "Shoes/Sneakers"

**Keyword Matching** (with priority levels)
- "Men's Shoes" contains "shoe" → "Shoes/Sneakers" (priority: 10)
- "Home Improvement & Tools" contains "tool" → "Tools" (priority: 10)
- "Exercise Equipment" contains "exercise" → "Gym/Workout" (priority: 10)

**Context from Title** (fallback)
- Title: "Adidas Runfalcon Running Shoes" → "Shoes/Sneakers"
- Title: "KitchenAid Mixer" → "Kitchen"

### 3. Fallback Behavior
If no match is found:
- Uses the original Facebook category name
- User can manually change it later

## Supported Mappings

### Facebook → Orben Categories

| Facebook Category | Orben Category |
|------------------|----------------|
| Men's Shoes, Women's Shoes | Shoes/Sneakers |
| Men's Clothing, Women's Clothing, Kids' Clothing | Clothing & Apparel |
| Electronics, Cell Phones, Computers | Electronics |
| Home Improvement & Tools | Tools |
| Kitchen & Dining | Kitchen |
| Furniture, Home & Garden | Home & Garden |
| Sporting Goods & Outdoor | Sporting Goods |
| Exercise Equipment | Gym/Workout |
| Collectibles | Collectibles |
| Antiques | Antiques |
| Toys & Games | Toys & Hobbies |
| Musical Instruments | Mic/Audio Equipment |
| Pet Supplies | Pets |
| Books, Movies & Music | Books, Movies & Music |
| Health & Beauty | Health & Beauty |
| Jewelry & Watches | Jewelry & Watches |
| Motorcycle Parts & Accessories | Motorcycle Accessories |

## Adding New Mappings

### 1. Add Facebook Category ID
Edit `api/utils/categoryMapper.js`:

```javascript
const FACEBOOK_CATEGORY_NAMES = {
  "123456789": "New Category Name",
  // ... existing mappings
};
```

### 2. Add Keyword Mapping
```javascript
const CATEGORY_KEYWORDS = [
  ["keyword", "Target Orben Category", priority], // priority: 1-10
  // Example:
  ["gaming", "Electronics", 8],
];
```

### 3. Add Orben Category (if new)
Edit `src/pages/AddInventoryItem.jsx`:

```javascript
const PREDEFINED_CATEGORIES = [
  // ... existing categories
  "New Category",
];
```

## Testing

Import a Facebook item and check the console logs:

```
📂 Category mapping: FB "Men's Shoes" (ID: 1604770196468207) → Orben "Shoes/Sneakers"
✅ Keyword category match: "men's shoes" → "Shoes/Sneakers" (priority: 10)
```

## Benefits

1. **Automatic** - No manual category selection needed
2. **Intelligent** - Uses multiple strategies (ID, keywords, title)
3. **Flexible** - Falls back to original name if no match
4. **Extensible** - Easy to add new mappings
5. **Cross-platform Ready** - Can be extended to eBay, Mercari, etc.

## Future Enhancements

- [ ] AI-based category matching for ambiguous items
- [ ] Learn from user corrections to improve mappings
- [ ] Add mappings for eBay → Orben
- [ ] Add mappings for Mercari → Orben
- [ ] Category translation for cross-listing (Orben → Facebook, eBay, etc.)
