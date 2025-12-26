/**
 * Database utilities for Render Worker
 * Handles Supabase connection and job claiming
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Claim a listing job (old-school query with status check)
 */
export async function claimJob() {
  // 1) find one queued job
  const { data: queued, error: qErr } = await supabase
    .from('listing_jobs')
    .select('*')
    .eq('status', 'queued')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (qErr) {
    console.error('Error fetching queued job:', qErr);
    throw qErr;
  }
  if (!queued) return null;

  // 2) claim it AND return the claimed row
  const { data: claimed, error: cErr } = await supabase
    .from('listing_jobs')
    .update({
      status: 'running',
      progress: { percent: 0, message: 'Claimed by worker' },
      updated_at: new Date().toISOString(),
    })
    .eq('id', queued.id)
    .eq('status', 'queued') // prevent double-claim
    .select('*')
    .single();

  if (cErr) {
    console.error('Error claiming job:', cErr);
    throw cErr;
  }

  return claimed;
}

/**
 * Update job progress
 */
export async function updateJobProgress(jobId, progress) {
  const { error } = await supabase
    .from('listing_jobs')
    .update({ progress, updated_at: new Date().toISOString() })
    .eq('id', jobId);

  if (error) {
    console.error('Error updating job progress:', error);
    throw error;
  }
}

/**
 * Update job result
 */
export async function updateJobResult(jobId, result) {
  const { error } = await supabase
    .from('listing_jobs')
    .update({
      status: 'completed',
      result,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error updating job result:', error);
    throw error;
  }
}

/**
 * Mark job as failed
 */
export async function markJobFailed(jobId, errorMessage) {
  const { error } = await supabase
    .from('listing_jobs')
    .update({
      status: 'failed',
      error: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  if (error) {
    console.error('Error marking job as failed:', error);
    throw error;
  }
}

/**
 * Log job event
 */
export async function logJobEvent(jobId, eventType, message, metadata = {}) {
  const { error } = await supabase.from('listing_job_events').insert({
    job_id: jobId,
    event_type: eventType,
    message,
    metadata,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('Error logging job event:', error);
    // Don't throw - event logging failures shouldn't break the job
  }
}

