/**
 * Vercel Serverless Function - Crosslistings API
 * 
 * Handles:
 * - GET /api/crosslistings - List all crosslistings for authenticated user
 * - POST /api/crosslistings - Create a new crosslisting
 * - GET /api/crosslistings/:id - Get a specific crosslisting (public endpoint for Chrome extension)
 * - PUT /api/crosslistings/:id - Update a crosslisting
 * - DELETE /api/crosslistings/:id - Delete a crosslisting
 */

import { createClient } from '@base44/sdk';

// Initialize Base44 client
const base44 = createClient({
  appId: process.env.VITE_BASE44_APP_ID || process.env.BASE44_APP_ID || "68e86fb5ac26f8511acce7ec",
  requiresAuth: false,
});

/**
 * Get user ID from request
 * TODO: Implement proper authentication (NextAuth session)
 * For now, we'll use a userId from query/body or header
 */
function getUserId(req) {
  // Option 1: From query parameter (for testing)
  if (req.query.userId) {
    return req.query.userId;
  }
  
  // Option 2: From request body
  if (req.body && req.body.userId) {
    return req.body.userId;
  }
  
  // Option 3: From authorization header
  // TODO: Implement JWT/session token parsing from NextAuth
  
  // Option 4: From custom header
  return req.headers['x-user-id'] || null;
}

/**
 * Extract ID from URL path
 * Supports both /api/crosslistings/:id and /api/crosslistings?id=...
 */
function extractIdFromUrl(url) {
  const urlParts = url.split('?')[0].split('/');
  const crosslistingsIndex = urlParts.indexOf('crosslistings');
  if (crosslistingsIndex >= 0 && urlParts.length > crosslistingsIndex + 1) {
    const id = urlParts[crosslistingsIndex + 1];
    // Check if it's a valid ID (not empty, not another path segment)
    if (id && id !== '' && !id.includes('.')) {
      return id;
    }
  }
  return null;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Check if this is a request for a specific item (has ID in URL)
  const itemId = extractIdFromUrl(req.url) || req.query.id;

  try {
    // Handle requests for specific items (with ID in URL)
    if (itemId) {
      // GET /api/crosslistings/:id - Get specific crosslisting (public for Chrome extension)
      if (req.method === 'GET') {
        try {
          const listing = await base44.entities.Crosslisting.get(itemId);

          if (!listing) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }

          // Return formatted data for Chrome extension
          return res.status(200).json({
            id: listing.id,
            title: listing.title,
            description: listing.description,
            price: listing.price,
            images: Array.isArray(listing.images) ? listing.images : (listing.images ? JSON.parse(listing.images) : []),
            category: listing.category || null,
            condition: listing.condition || null,
          });
        } catch (error) {
          console.error('Error fetching crosslisting:', error);
          if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }
          return res.status(500).json({ 
            error: 'Failed to fetch crosslisting',
            message: error.message 
          });
        }
      }

      // PUT /api/crosslistings/:id - Update crosslisting
      if (req.method === 'PUT') {
        const userId = getUserId(req);
        
        if (!userId) {
          return res.status(401).json({ 
            error: 'Authentication required',
            message: 'User ID is required to update a crosslisting.'
          });
        }

        try {
          // Get the listing to verify it exists
          const existing = await base44.entities.Crosslisting.get(itemId);
          
          if (!existing) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }

          // TODO: Verify ownership if needed
          // if (existing.userId !== userId) {
          //   return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to update this listing.' });
          // }

          const { title, description, price, images, category, condition } = req.body;

          // Build update object with only provided fields
          const updates = {};
          if (title !== undefined) updates.title = title;
          if (description !== undefined) updates.description = description;
          if (price !== undefined) updates.price = String(price);
          if (images !== undefined) updates.images = images;
          if (category !== undefined) updates.category = category || null;
          if (condition !== undefined) updates.condition = condition || null;

          // Update the listing
          const updated = await base44.entities.Crosslisting.update(itemId, updates);

          return res.status(200).json({
            id: updated.id,
            title: updated.title,
            description: updated.description,
            price: updated.price,
            images: Array.isArray(updated.images) ? updated.images : (updated.images ? JSON.parse(updated.images) : []),
            category: updated.category || null,
            condition: updated.condition || null,
            createdAt: updated.createdAt,
            updatedAt: updated.updatedAt,
          });
        } catch (error) {
          console.error('Error updating crosslisting:', error);
          if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }
          return res.status(500).json({ 
            error: 'Failed to update crosslisting',
            message: error.message 
          });
        }
      }

      // DELETE /api/crosslistings/:id - Delete crosslisting
      if (req.method === 'DELETE') {
        const userId = getUserId(req);
        
        if (!userId) {
          return res.status(401).json({ 
            error: 'Authentication required',
            message: 'User ID is required to delete a crosslisting.'
          });
        }

        try {
          // Get the listing to verify it exists
          const existing = await base44.entities.Crosslisting.get(itemId);
          
          if (!existing) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }

          // TODO: Verify ownership if needed
          // if (existing.userId !== userId) {
          //   return res.status(403).json({ error: 'Forbidden', message: 'You do not have permission to delete this listing.' });
          // }

          // Delete the listing
          await base44.entities.Crosslisting.delete(itemId);

          return res.status(200).json({ 
            success: true,
            message: 'Crosslisting deleted successfully.'
          });
        } catch (error) {
          console.error('Error deleting crosslisting:', error);
          if (error.message && error.message.includes('not found')) {
            return res.status(404).json({ 
              error: 'Not found',
              message: 'Crosslisting not found.'
            });
          }
          return res.status(500).json({ 
            error: 'Failed to delete crosslisting',
            message: error.message 
          });
        }
      }

      // Method not allowed for specific item
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Handle collection-level requests (no ID in URL)
    // GET /api/crosslistings - List all crosslistings
    if (req.method === 'GET') {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'User ID is required. Please authenticate or provide userId parameter.'
        });
      }

      try {
        // List all crosslistings for this user
        const crosslistings = await base44.entities.Crosslisting.list({
          filter: { userId: userId }
        });

        // Transform to match expected format
        const formatted = (crosslistings || []).map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          price: item.price,
          images: Array.isArray(item.images) ? item.images : (item.images ? JSON.parse(item.images) : []),
          category: item.category || null,
          condition: item.condition || null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
        }));

        return res.status(200).json(formatted);
      } catch (error) {
        console.error('Error fetching crosslistings:', error);
        return res.status(500).json({ 
          error: 'Failed to fetch crosslistings',
          message: error.message 
        });
      }
    }

    // POST /api/crosslistings - Create new crosslisting
    if (req.method === 'POST') {
      const userId = getUserId(req);
      
      if (!userId) {
        return res.status(401).json({ 
          error: 'Authentication required',
          message: 'User ID is required. Please authenticate or provide userId in request body.'
        });
      }

      const { title, description, price, images, category, condition } = req.body;

      // Validate required fields
      if (!title || !description || !price) {
        return res.status(400).json({ 
          error: 'Missing required fields',
          message: 'Title, description, and price are required.'
        });
      }

      // Validate images
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ 
          error: 'Images required',
          message: 'At least one image is required.'
        });
      }

      try {
        // Create crosslisting in Base44
        const newListing = await base44.entities.Crosslisting.create({
          userId: userId,
          title: title,
          description: description,
          price: String(price),
          images: images, // Base44 should handle JSON serialization
          category: category || null,
          condition: condition || null,
        });

        return res.status(201).json({
          id: newListing.id,
          title: newListing.title,
          description: newListing.description,
          price: newListing.price,
          images: Array.isArray(newListing.images) ? newListing.images : (newListing.images ? JSON.parse(newListing.images) : []),
          category: newListing.category || null,
          condition: newListing.condition || null,
          createdAt: newListing.createdAt,
          updatedAt: newListing.updatedAt,
        });
      } catch (error) {
        console.error('Error creating crosslisting:', error);
        return res.status(500).json({ 
          error: 'Failed to create crosslisting',
          message: error.message 
        });
      }
    }

    // Method not allowed
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Unexpected error in crosslistings API:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

