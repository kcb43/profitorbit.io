# Facebook Import Pricing Logic

## Overview
Facebook Marketplace price represents what you want to **sell** the item for (listing price), not what you **paid** for it (purchase price).

## How It Works

### 1. Import from Facebook
When you import an item from Facebook:
```
Facebook Item: Adidas Shoes - $45
  ↓
Orben Inventory:
  - Purchase Price: (empty) ← You don't know what they originally paid
  - Listing Price: $45 ← This is what you want to sell it for
```

### 2. Inventory Details Page
After importing:
- **Purchase Price / Cost**: Optional field (no red asterisk)
- **Listing Price**: Hidden from UI, but stored in database ($45)
- **Helper Text**: "Leave blank if you don't know your cost yet. The listing price is already set from Facebook."

User can optionally add their actual purchase cost later if they know it.

### 3. Crosslist General Form
When crosslisting the item:
- **Cost**: (empty) - User's actual purchase cost (optional)
- **Price**: $45 ← Auto-filled from Facebook listing price

This $45 then propagates to all marketplace forms (eBay, Mercari, Facebook, Etsy).

## User Workflow

### Scenario 1: Reselling Your Own Items
```
1. Import item from Facebook ($45)
2. Add your actual cost in inventory ($20)
3. Crosslist → Price auto-fills to $45
4. Profit margin shown: $25
```

### Scenario 2: Importing for Reference
```
1. Import item from Facebook ($45)
2. Leave purchase price blank (don't know cost)
3. Crosslist → Price auto-fills to $45
4. List across marketplaces with suggested price
```

## Technical Implementation

### Facebook Import API (`api/facebook/import-items.js`)
```javascript
{
  purchase_price: null, // Don't assume - user will add later
  listing_price: item.price, // Facebook price = suggested listing price
}
```

### Inventory Form (`src/pages/AddInventoryItem.jsx`)
```javascript
<Input 
  id="purchase_price"
  placeholder="Optional - add your actual cost"
  required={formData.source !== 'Facebook' && formData.source !== 'Mercari'}
/>
```

### Crosslist Form (`src/pages/CrosslistComposer.jsx`)
```javascript
const general = {
  cost: item?.purchase_price || "", // Optional - user's actual cost
  price: item?.listing_price || "", // Auto-fills from Facebook price
}
```

## Benefits

1. **Accurate Profit Tracking** - Separates listing price from purchase cost
2. **Flexible Workflow** - Can add purchase cost later when known
3. **Smart Defaults** - Facebook price auto-fills in crosslist form
4. **Clear UX** - Helper text explains the difference
5. **Consistent Logic** - Same behavior for Facebook and Mercari imports

## Other Marketplaces

### Mercari
Same logic as Facebook:
- Purchase price: Optional (user adds later)
- Listing price: Set from Mercari price

### eBay, Amazon, Walmart (Direct Purchase Sources)
Different logic:
- Purchase price: **Required** (you know what you paid)
- Listing price: User calculates markup

### Manual Entry
Traditional logic:
- Purchase price: **Required**
- Listing price: User sets based on markup

## Future Enhancements

- [ ] Auto-calculate suggested markup based on category
- [ ] Profit margin calculator in crosslist form
- [ ] Historical pricing data for similar items
- [ ] Auto-suggest listing price based on market data
