# Crosslist General Form Auto-Population

## Overview
The Crosslist General Form automatically pre-fills with data from imported inventory items to speed up the listing process.

## Fields That Auto-Populate

### ✅ Basic Information
| Field | Source | Notes |
|-------|--------|-------|
| Title | `inventory_items.item_name` | Item title/name |
| Description | `inventory_items.description` | Full description (fallback: `notes`) |
| Photos | `inventory_items.images` | All uploaded images |

### ✅ Product Details
| Field | Source | Notes |
|-------|--------|-------|
| Brand | `inventory_items.brand` | From Facebook attributes or extracted from title |
| Condition | `inventory_items.condition` | From Facebook attributes (e.g., "New", "Used - Good") |
| Size | `inventory_items.size` | From Facebook attributes (e.g., "10.5", "M", "XL") |
| Category | `inventory_items.category` | Mapped from Facebook category |
| SKU | `inventory_items.sku` | User-defined SKU |

### ✅ Colors
| Field | Source | Notes |
|-------|--------|-------|
| Color 1 | `inventory_items.color1` | Primary color |
| Color 2 | `inventory_items.color2` | Secondary color |
| Color 3 | `inventory_items.color3` | Tertiary color |

### ✅ Pricing & Shipping
| Field | Source | Notes |
|-------|--------|-------|
| Price | `inventory_items.listing_price` | Suggested listing price |
| Cost | `inventory_items.purchase_price` | Your purchase cost |
| Quantity | `inventory_items.quantity` | Available quantity (default: 1) |
| Zip Code | `inventory_items.zip_code` | Shipping origin |

### ✅ Package Details
| Field | Source | Notes |
|-------|--------|-------|
| Package Weight | `inventory_items.package_weight` | Shipping weight |
| Package Length | `inventory_items.package_length` | Box length |
| Package Width | `inventory_items.package_width` | Box width |
| Package Height | `inventory_items.package_height` | Box height |
| Package Details | `inventory_items.package_details` | Additional notes |

### ✅ Other
| Field | Source | Notes |
|-------|--------|-------|
| Tags | `inventory_items.tags` | Search tags |
| Custom Labels | `inventory_items.custom_labels` | Internal labels |

## How It Works

### 1. Import from Facebook
When you import an item from Facebook:
```
Facebook Item
  ├─ Title: "Adidas Runfalcon Shoes Size 10.5"
  ├─ Description: (full 776-character description)
  ├─ Brand: "Adidas" (extracted from title)
  ├─ Condition: "New" (from FB attributes)
  ├─ Size: "10.5" (from FB attributes)
  ├─ Category: "Shoes/Sneakers" (mapped from "Men's Shoes")
  └─ Price: $45
```

### 2. Saved to Inventory
All this data is saved to `inventory_items` table:
```sql
{
  item_name: "Adidas Runfalcon Shoes Size 10.5",
  description: "(full 776-character description)",
  brand: "Adidas",
  condition: "New",
  size: "10.5",
  category: "Shoes/Sneakers",
  listing_price: 45,
  source: "Facebook"
}
```

### 3. Auto-Populates Crosslist Form
When you go to crosslist the item:

**General Form** (auto-filled):
- Title: ✅ "Adidas Runfalcon Shoes Size 10.5"
- Description: ✅ (full 776-character description)
- Brand: ✅ "Adidas"
- Condition: ✅ "New"
- Size: ✅ "10.5"
- Category: ✅ "Shoes/Sneakers"
- Price: ✅ $45

**Marketplace Forms** (inherit from General):
- eBay: ✅ All fields synced
- Mercari: ✅ All fields synced
- Facebook: ✅ All fields synced
- Etsy: ✅ All fields synced

## Benefits

1. **Speed** - No re-typing description, brand, condition, size
2. **Accuracy** - Data copied exactly as imported
3. **Consistency** - Same info across all marketplaces
4. **Smart Defaults** - Auto-calculates shipping based on price
5. **Time Saving** - List to multiple marketplaces in seconds

## Recent Fixes

- ✅ **2025-01-27**: Fixed description field to use `item.description` instead of `item.notes`
- ✅ **2025-01-27**: Added intelligent brand extraction from titles
- ✅ **2025-01-27**: Added size extraction for any "size" attribute (e.g., "Men's Shoe Size")
- ✅ **2025-01-27**: Added Facebook category mapping to Orben categories

## Future Enhancements

- [ ] AI-powered description enhancement for specific marketplaces
- [ ] Auto-suggest category for eBay based on Orben category
- [ ] Auto-suggest Mercari category based on Orben category
- [ ] Smart pricing suggestions based on marketplace
- [ ] Auto-detect missing fields and prompt user
