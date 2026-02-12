import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Deal Alerts API Endpoints
 * GET /api/pulse/deal-alerts - Fetch user's deal alerts
 * DELETE /api/pulse/deal-alerts/:id - Delete alert
 * POST /api/pulse/deal-alerts/:id/read - Mark alert as read
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

    // GET /api/pulse/deal-alerts
    if (req.method === 'GET') {
      const { data: alerts, error } = await supabase
        .from('deal_alerts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return res.status(200).json(alerts || []);
    }

    // DELETE /api/pulse/deal-alerts/:id
    if (req.method === 'DELETE') {
      const alertId = req.query.id;
      if (!alertId) {
        return res.status(400).json({ error: 'Alert ID required' });
      }

      const { error } = await supabase
        .from('deal_alerts')
        .delete()
        .eq('id', alertId)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    // POST /api/pulse/deal-alerts/:id/read
    if (req.method === 'POST' && req.url?.includes('/read')) {
      const alertId = req.query.id;
      if (!alertId) {
        return res.status(400).json({ error: 'Alert ID required' });
      }

      const { error } = await supabase
        .from('deal_alerts')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', alertId)
        .eq('user_id', user.id);

      if (error) throw error;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Deal alerts error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
