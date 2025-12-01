/**
 * Vercel Serverless Function - Crosslistings API (Individual Item)
 * 
 * Handles:
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
 */
function getUserId(req) {
  if (req.query.userId) {
    return req.query.userId;
  }
  if (req.body && req.body.userId) {
    return req.body.userId;
  }
  return req.headers['x-user-id'] || null;
}

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-User-Id');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Extract ID from query parameter (Vercel passes dynamic params as query.id)
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({ 
        error: 'Missing ID',
        message: 'Crosslisting ID is required in the URL path.'
      });
    }

    // GET /api/crosslistings/:id - Get specific crosslisting (public for Chrome extension)
    if (req.method === 'GET') {
      try {
        const listing = await base44.entities.Crosslisting.get(id);

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
        const existing = await base44.entities.Crosslisting.get(id);
        
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
        const updated = await base44.entities.Crosslisting.update(id, updates);

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
        const existing = await base44.entities.Crosslisting.get(id);
        
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
        await base44.entities.Crosslisting.delete(id);

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

