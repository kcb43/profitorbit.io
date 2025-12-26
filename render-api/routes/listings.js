/**
 * Listing job management routes
 * Handles creating and tracking listing jobs
 */

import express from 'express';
import { requireAuth } from '../utils/auth.js';
import { supabase } from '../utils/db.js';

const router = express.Router();

/**
 * POST /api/listings/create-job
 * Create a new listing job
 * 
 * Body:
 * {
 *   "inventory_item_id": "uuid",
 *   "platforms": ["mercari", "facebook"],
 *   "payload": { ...listing data... }
 * }
 */
router.post('/create-job', requireAuth, async (req, res) => {
  try {
    console.log('🔥 LISTING ROUTE HIT', new Date().toISOString());
    const userId = req.userId;
    const { inventory_item_id, platforms, payload } = req.body;

    // Validate input
    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        error: 'platforms array is required and must not be empty',
      });
    }

    // Verify user has connected accounts for requested platforms
    const { data: accounts, error: accountsError } = await supabase
      .from('platform_accounts')
      .select('platform, status')
      .eq('user_id', userId)
      .in('platform', platforms);

    if (accountsError) {
      console.error('Database error:', accountsError);
      return res.status(500).json({
        error: 'Failed to verify platform connections',
      });
    }

    const connectedPlatforms = accounts
      .filter((a) => a.status === 'connected')
      .map((a) => a.platform);

    const missingPlatforms = platforms.filter(
      (p) => !connectedPlatforms.includes(p)
    );

    if (missingPlatforms.length > 0) {
      return res.status(400).json({
        error: `Platforms not connected: ${missingPlatforms.join(', ')}`,
        missingPlatforms,
      });
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('listing_jobs')
      .insert({
        user_id: userId,
        inventory_item_id: inventory_item_id || null,
        platforms,
        payload: payload || {},
        status: 'queued',
        progress: {
          percent: 0,
          message: 'Job queued',
        },
        result: {},
      })
      .select()
      .single();

    if (jobError) {
      console.error('Database error:', jobError);
      return res.status(500).json({
        error: 'Failed to create job',
        details: jobError.message,
      });
    }

    res.json({
      success: true,
      jobId: job.id,
      status: job.status,
    });
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
    });
  }
});

/**
 * GET /api/listings/jobs/:id
 * Get job status and progress
 */
router.get('/jobs/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const { data: job, error } = await supabase
      .from('listing_jobs')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({
          error: 'Job not found',
        });
      }
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch job',
      });
    }

    res.json({
      job,
    });
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

/**
 * GET /api/listings/jobs
 * List user's jobs (with optional filters)
 */
router.get('/jobs', requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('listing_jobs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: jobs, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({
        error: 'Failed to fetch jobs',
      });
    }

    res.json({
      jobs: jobs || [],
      count: jobs?.length || 0,
    });
  } catch (error) {
    console.error('List jobs error:', error);
    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

export default router;


