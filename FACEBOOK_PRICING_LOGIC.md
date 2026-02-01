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

### Typical Use Case: Reference Pricing
```
1. Import item from Facebook ($45)
   ↓ This is what someone else is asking for a similar item
2. Leave purchase price blank in inventory
3. Crosslist → Price auto-fills to $45
4. Adjust price as needed based on your item's condition/features
5. List across marketplaces
```

**Note**: The $45 is just a **reference price** from Facebook - what someone else is listing their item for. It's not a recommendation or profit calculation. You should adjust based on your item's actual condition, market demand, and your costs.

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

1. **Reference Pricing** - Use Facebook prices as market reference, not recommendations
2. **Flexible Workflow** - Can add purchase cost later when known
3. **Quick Import** - Facebook price auto-fills in crosslist form for convenience
4. **Clear UX** - Helper text explains the difference
5. **Consistent Logic** - Same behavior for Facebook and Mercari imports

**Important**: Facebook prices are reference data only. Future AI features may provide smart pricing suggestions based on real-time market data.

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

- [ ] **AI-powered pricing assistant** - Analyze current market prices and suggest optimal listing prices
- [ ] Profit margin calculator (when purchase cost is known)
- [ ] Historical pricing data for similar items
- [ ] Real-time market analysis for pricing recommendations
- [ ] Competitive pricing alerts
