const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Price Watchlist API Endpoints
 * GET /api/pulse/watchlist - Fetch user's watchlist
 * POST /api/pulse/watchlist - Add item to watchlist
 * DELETE /api/pulse/watchlist/:id - Remove from watchlist
 */

// Helper to get user from request
async function getUser(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // GET /api/pulse/watchlist
    if (req.method === 'GET') {
      const { data: watchlist, error } = await supabase
        .from('price_watchlist')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Enhance with latest price info
      const enhancedWatchlist = await Promise.all(
        (watchlist || []).map(async (item) => {
          // Get latest price history
          const { data: latestPrice } = await supabase
            .from('price_history')
            .select('price')
            .eq('watchlist_item_id', item.id)
            .order('recorded_at', { ascending: false })
            .limit(1)
            .single();

          // Calculate price change
          const currentPrice = latestPrice?.price || item.target_price;
          const originalPrice = item.initial_price || currentPrice;
          const priceChangePercentage = originalPrice > 0
            ? ((currentPrice - originalPrice) / originalPrice) * 100
            : 0;

          return {
            ...item,
            current_price: currentPrice,
            price_change_percentage: priceChangePercentage
          };
        })
      );

      return res.status(200).json(enhancedWatchlist);
    }

    // POST /api/pulse/watchlist - Add item
    if (req.method === 'POST') {
      const {
        product_name,
        product_url,
        product_image_url,
        marketplace,
        initial_price,
        target_price,
        notify_on_drop = true
      } = req.body;

      if (!product_name || !product_url) {
        return res.status(400).json({ error: 'Product name and URL required' });
      }

      const { data: newItem, error } = await supabase
        .from('price_watchlist')
        .insert({
          user_id: user.id,
          product_name,
          product_url,
          product_image_url,
          marketplace,
          initial_price,
          target_price,
          notify_on_drop,
          is_active: true
        })
        .select()
        .single();

      if (error) throw error;

      // Record initial price in history
      await supabase.from('price_history').insert({
        watchlist_item_id: newItem.id,
        price: initial_price
      });

      return res.status(201).json(newItem);
    }

    // DELETE /api/pulse/watchlist/:id
    if (req.method === 'DELETE') {
      const itemId = req.query.id;
      if (!itemId) {
        return res.status(400).json({ error: 'Item ID required' });
      }

      const { error } = await supabase
        .from('price_watchlist')
        .update({ is_active: false })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Watchlist error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
