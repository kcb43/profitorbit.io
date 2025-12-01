# Crosslisting Setup Guide

This document explains the Crosslisting feature setup for Chrome Extension integration.

## Overview

The Crosslisting feature allows users to:
1. Create crosslisting entries (title, price, description, images, category, condition)
2. Save them to the database
3. View a list of all crosslistings
4. Edit and delete crosslistings
5. Copy extension links for Chrome extension integration

## Backend Setup

### 1. Create Base44 Entity

You need to create a `Crosslisting` entity in your Base44 dashboard with the following schema:

```json
{
  "name": "Crosslisting",
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
      "description": "User ID who owns this crosslisting"
    },
    "title": {
      "type": "string",
      "description": "Listing title"
    },
    "description": {
      "type": "string",
      "description": "Listing description"
    },
    "price": {
      "type": "string",
      "description": "Listing price"
    },
    "images": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of image URLs"
    },
    "category": {
      "type": "string",
      "description": "Item category (optional)"
    },
    "condition": {
      "type": "string",
      "description": "Item condition (optional)"
    }
  },
  "required": [
    "userId",
    "title",
    "description",
    "price",
    "images"
  ],
  "rls": {
    "write": true
  }
}
```

**Important Notes:**
- Base44 will automatically add `id`, `createdAt`, and `updatedAt` fields
- Make sure RLS (Row Level Security) is configured for write access
- The `images` field should be stored as JSON array

### 2. API Routes

API routes have been created at:
- `/api/crosslistings.js` - Handles GET (list) and POST (create)
- Also handles dynamic routes like `/api/crosslistings/:id` for GET, PUT, DELETE

**Routes Available:**
- `GET /api/crosslistings?userId=XXX` - List all crosslistings for a user
- `POST /api/crosslistings` - Create a new crosslisting (requires userId in body)
- `GET /api/crosslistings/:id` - Get a specific crosslisting (public endpoint for Chrome extension)
- `PUT /api/crosslistings/:id` - Update a crosslisting (requires authentication)
- `DELETE /api/crosslistings/:id` - Delete a crosslisting (requires authentication)

### 3. Authentication

**Current Implementation:**
- Uses `userId` from query parameter, request body, or `X-User-Id` header
- TODO: Replace with proper NextAuth session authentication

**To Add Proper Authentication:**
1. Install NextAuth if not already installed
2. Update `getUserId()` function in `api/crosslistings.js` to extract user from session
3. Update frontend to send session token in requests

## Frontend Setup

### 1. Page Route

The Crosslisting page is available at:
- `/crosslisting` (lowercase)
- `/Crosslisting` (uppercase)

### 2. User ID Management

**Current Implementation:**
- Uses a temporary user ID stored in localStorage
- For development: Generates `temp_user_id` if not exists

**To Add Proper Authentication:**
1. Replace `getUserId()` function in `src/pages/Crosslisting.jsx`
2. Use your authentication system to get the current user ID
3. Update API calls to include proper auth headers/tokens

### 3. Features

**Create Listing Form:**
- Title (required)
- Price (required)
- Description (required)
- Images (required, multiple upload)
- Category (optional dropdown)
- Condition (optional dropdown)

**List View:**
- Shows all crosslistings for the logged-in user
- Displays title, description, price, category, condition
- Shows image thumbnails (first 3 images)

**Actions per Listing:**
- **Copy Extension Link**: Copies URL like `https://YOURDOMAIN.com/api/crosslistings/[ID]` to clipboard
- **Edit**: Opens edit dialog with pre-filled form
- **Delete**: Deletes the listing (with confirmation)

## Chrome Extension Integration

### Extension Link Format

Each crosslisting has a unique API endpoint:
```
https://YOURDOMAIN.com/api/crosslistings/[ID]
```

### Expected JSON Response

When the Chrome extension fetches the endpoint, it receives:
```json
{
  "id": "123",
  "title": "Example Product",
  "description": "This is a product description",
  "price": "20.00",
  "images": ["url1", "url2"],
  "category": "Electronics",
  "condition": "Like New"
}
```

### Chrome Extension Usage

The Chrome extension can:
1. Fetch listing JSON from `/api/crosslistings/:id`
2. Parse the JSON response
3. Auto-fill Facebook Marketplace form using the data
4. Extract images from the `images` array
5. Map fields: title, description, price, category, condition

## Testing

### Test API Routes

1. **Create a crosslisting:**
   ```bash
   curl -X POST https://YOURDOMAIN.com/api/crosslistings \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "test_user",
       "title": "Test Item",
       "description": "Test description",
       "price": "10.00",
       "images": ["https://example.com/image.jpg"],
       "category": "Electronics",
       "condition": "New"
     }'
   ```

2. **List all crosslistings:**
   ```bash
   curl https://YOURDOMAIN.com/api/crosslistings?userId=test_user
   ```

3. **Get specific crosslisting (for Chrome extension):**
   ```bash
   curl https://YOURDOMAIN.com/api/crosslistings/[ID]
   ```

4. **Update a crosslisting:**
   ```bash
   curl -X PUT https://YOURDOMAIN.com/api/crosslistings/[ID] \
     -H "Content-Type: application/json" \
     -H "X-User-Id: test_user" \
     -d '{"title": "Updated Title"}'
   ```

5. **Delete a crosslisting:**
   ```bash
   curl -X DELETE https://YOURDOMAIN.com/api/crosslistings/[ID] \
     -H "X-User-Id: test_user"
   ```

## Next Steps

1. ✅ Create API routes
2. ✅ Create frontend page
3. ⚠️ Create Base44 `Crosslisting` entity (manually in dashboard)
4. ⚠️ Add proper authentication (replace userId placeholder)
5. ⚠️ Test the full flow
6. ⚠️ Deploy to production

## Notes

- The extension link is intentionally public (no auth required for GET) so the Chrome extension can fetch it
- Other operations (POST, PUT, DELETE) require authentication
- Images are uploaded to Base44 storage before saving to the crosslisting
- The page uses React Query for efficient data fetching and caching

