# InventoryItem Schema Update: Adding Images Array Support

## Problem
Multiple images are being sent to the backend but not saving because the `images` field isn't defined in the InventoryItem schema.

## Solution: Add Images Field to InventoryItem Schema

### Step 1: Update InventoryItem Entity in Base44

Go to your Base44 dashboard and add this field to the `InventoryItem` entity schema:

```json
"images": {
  "type": "array",
  "description": "Array of image objects for the item",
  "items": {
    "type": "object",
    "properties": {
      "id": {
        "type": "string",
        "description": "Unique identifier for the image"
      },
      "imageUrl": {
        "type": "string",
        "description": "URL of the image"
      },
      "url": {
        "type": "string",
        "description": "Alternative URL field (for compatibility)"
      },
      "isMain": {
        "type": "boolean",
        "description": "Whether this is the main/primary image",
        "default": false
      }
    }
  },
  "default": []
}
```

### Complete Updated InventoryItem Schema

Add this field alongside your existing fields. Here's the complete schema with the new field:

```json
{
  "name": "InventoryItem",
  "type": "object",
  "properties": {
    "item_name": {
      "type": "string",
      "description": "Name of the item"
    },
    "purchase_price": {
      "type": "number",
      "description": "How much you paid for the item"
    },
    "purchase_date": {
      "type": "string",
      "format": "date",
      "description": "Date you acquired the item"
    },
    "source": {
      "type": "string",
      "description": "Where you got the item from (e.g., Goodwill, Garage Sale)"
    },
    "status": {
      "type": "string",
      "enum": ["available", "listed", "sold"],
      "default": "available",
      "description": "Current status of the item"
    },
    "category": {
      "type": "string",
      "description": "Item category"
    },
    "notes": {
      "type": "string",
      "description": "Additional notes about the item"
    },
    "image_url": {
      "type": "string",
      "description": "URL of the main/primary image (for backwards compatibility)"
    },
    "images": {
      "type": "array",
      "description": "Array of image objects for the item",
      "items": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Unique identifier for the image"
          },
          "imageUrl": {
            "type": "string",
            "description": "URL of the image"
          },
          "url": {
            "type": "string",
            "description": "Alternative URL field (for compatibility)"
          },
          "isMain": {
            "type": "boolean",
            "description": "Whether this is the main/primary image",
            "default": false
          }
        }
      },
      "default": []
    },
    "quantity": {
      "type": "number",
      "default": 1,
      "description": "Total number of identical items purchased"
    },
    "quantity_sold": {
      "type": "number",
      "default": 0,
      "description": "Number of items sold from this batch"
    },
    "return_deadline": {
      "type": "string",
      "format": "date",
      "description": "The last day the item can be returned"
    },
    "deleted_at": {
      "type": "string",
      "format": "date-time",
      "description": "Timestamp when the item was soft deleted (null if not deleted)"
    }
  },
  "required": ["item_name", "purchase_price"]
}
```

## Step 2: Verification

After updating the schema:

1. Test creating a new inventory item with multiple images
2. Test updating an existing inventory item's images
3. Verify images array is returned when fetching items
4. Check that the image carousel displays correctly

## Implementation Notes

- The code already sends `images` in the payload (see `buildInventoryPayload` in AddInventoryItem.jsx)
- The frontend loads images correctly from the `images` field
- Once the schema is updated, everything should work seamlessly
- `image_url` field is kept for backwards compatibility and as the primary image reference

