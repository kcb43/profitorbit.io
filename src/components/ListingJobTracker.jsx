/**
 * Listing Job Tracker Component
 * Shows real-time status of listing automation jobs
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  ExternalLink,
  X,
} from 'lucide-react';
import { listingJobsApi } from '@/api/listingApiClient';

const STATUS_CONFIG = {
  queued: { label: 'Queued', color: 'bg-gray-500', icon: Clock },
  running: { label: 'Processing', color: 'bg-blue-500', icon: Loader2 },
  completed: { label: 'Completed', color: 'bg-green-500', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-500', icon: XCircle },
};

export function ListingJobTracker({ jobId, onComplete, onClose }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    if (!jobId) return;

    // Poll for job status
    const pollInterval = setInterval(async () => {
      try {
        const jobData = await listingJobsApi.getJobStatus(jobId);
        setJob(jobData);
        setLoading(false);

        // Stop polling if job is complete or failed
        if (jobData.status === 'completed' || jobData.status === 'failed') {
          clearInterval(pollInterval);
          if (jobData.status === 'completed' && onComplete) {
            onComplete(jobData);
          }
        }
      } catch (error) {
        console.error('Error polling job status:', error);
        setLoading(false);
        clearInterval(pollInterval);
      }
    }, 2000); // Poll every 2 seconds

    // Initial fetch
    pollInterval();

    return () => clearInterval(pollInterval);
  }, [jobId, onComplete]);

  if (!job && loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading job status...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!job) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
  const StatusIcon = statusConfig.icon;
  const progress = job.progress?.percent || 0;
  const message = job.progress?.message || 'Processing...';

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <StatusIcon
              className={`w-4 h-4 ${
                job.status === 'running' ? 'animate-spin' : ''
              }`}
            />
            Listing Job Status
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <Badge className={statusConfig.color}>
            {statusConfig.label}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {job.platforms?.join(', ')}
          </span>
        </div>

        {job.status === 'running' && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{message}</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {job.status === 'completed' && job.result && (
          <div className="space-y-2">
            <div className="text-sm text-green-600 font-medium">
              ✓ Listing created successfully!
            </div>
            {Object.entries(job.result).map(([platform, result]) => {
              if (result.success && result.listingUrl) {
                return (
                  <div key={platform} className="flex items-center gap-2">
                    <span className="text-xs capitalize">{platform}:</span>
                    <a
                      href={result.listingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                    >
                      View Listing
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                );
              }
              return null;
            })}
          </div>
        )}

        {job.status === 'failed' && job.error && (
          <div className="text-sm text-red-600">
            <div className="font-medium">Error:</div>
            <div className="text-xs mt-1">{job.error}</div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Job List Component - Shows all jobs for the current user
 */
export function ListingJobList() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadJobs();
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);
      const jobList = await listingJobsApi.listJobs();
      setJobs(jobList);
    } catch (error) {
      console.error('Error loading jobs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Loading jobs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          No listing jobs yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {jobs.slice(0, 5).map((job) => (
        <ListingJobTracker key={job.id} jobId={job.id} />
      ))}
    </div>
  );
}


