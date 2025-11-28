# ImageEditorTemplate Entity Schema for Base44

This document describes the Base44 entity schema needed for saving image editor templates.

> ✅ **Status**: Entity created in Base44 and ready for use.

## Entity: ImageEditorTemplate

### Required Fields

1. **name** (String, Required)
   - User-friendly name for the template
   - Example: "Bright & Vibrant", "High Contrast", "Vintage Look"

2. **settings** (Object/JSON, Required)
   - Contains all the image adjustment settings
   - Structure:
     ```json
     {
       "brightness": 100,    // 0-200, 100 = normal
       "contrast": 100,      // 0-200, 100 = normal
       "saturate": 100,      // 0-200, 100 = normal
       "shadows": 0,         // -100 to 100, 0 = normal
       "rotate": 0,          // Rotation in degrees
       "flip_x": 1,          // 1 or -1
       "flip_y": 1           // 1 or -1
     }
     ```

3. **deleted_at** (String/DateTime, Optional)
   - Timestamp when the template was soft deleted
   - Should be null if not deleted
   - Used for soft delete functionality (same pattern as InventoryItem and Sale)

### Recommended Schema Definition

```json
{
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true,
      "description": "User-friendly name for the template"
    },
    {
      "name": "settings",
      "type": "object",
      "required": true,
      "description": "JSON object containing all image adjustment settings"
    },
    {
      "name": "deleted_at",
      "type": "datetime",
      "required": false,
      "description": "Timestamp when the template was soft deleted (null if not deleted)"
    }
  ]
}
```

## Implementation Notes

1. **Soft Delete Support**: Templates should support soft deletion using `deleted_at` field, just like InventoryItem and Sale entities.

2. **User Association**: The template is automatically associated with the logged-in user by Base44 (user_id field should be automatic if authentication is enabled).

3. **Settings Validation**: The settings object should validate that:
   - brightness, contrast, saturate: 0-200
   - shadows: -100 to 100
   - rotate: any number (degrees)
   - flip_x, flip_y: 1 or -1

## Usage in Settings Page

Templates can be deleted from the Settings page using the same soft delete pattern:
- Set `deleted_at` to current timestamp
- Filter out templates where `deleted_at` is not null when listing

## Example Data

```json
{
  "name": "Bright & Vibrant",
  "settings": {
    "brightness": 120,
    "contrast": 110,
    "saturate": 115,
    "shadows": 10,
    "rotate": 0,
    "flip_x": 1,
    "flip_y": 1
  },
  "deleted_at": null
}
```

