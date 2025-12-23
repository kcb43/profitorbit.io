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
 * Claim a listing job using row-level locking
 * Uses Supabase RPC function to prevent duplicate processing
 * 
 * Note: supabase.rpc('claim_listing_job') automatically calls public.claim_listing_job
 * No need to specify schema prefix - Supabase defaults to public schema
 */
export async function claimJob() {
  const { data, error } = await supabase.rpc('claim_listing_job');

  if (error) {
    console.error('Error claiming job:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  return data[0];
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

