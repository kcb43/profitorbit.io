import React, { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase';

export default function GuideFeedback({ slug, className }) {
  const [vote, setVote] = useState(null); // 'up' | 'down' | null
  const [existingVote, setExistingVote] = useState(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load existing vote for this user+slug
  useEffect(() => {
    async function loadExisting() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('guide_feedback')
        .select('vote, comment')
        .eq('slug', slug)
        .eq('user_id', user.id)
        .maybeSingle();
      if (data) {
        setExistingVote(data.vote);
        setVote(data.vote);
        if (data.vote) setSubmitted(true);
      }
    }
    if (slug) loadExisting();
  }, [slug]);

  async function handleVote(newVote) {
    if (submitted && newVote === existingVote) return;
    setVote(newVote);
    if (newVote === 'down') {
      setShowComment(true);
    } else {
      setShowComment(false);
      await submitFeedback(newVote, '');
    }
  }

  async function submitFeedback(v, c) {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await fetch('/api/training/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(user ? { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` } : {}),
        },
        body: JSON.stringify({ slug, vote: v, comment: c }),
      });
      setSubmitted(true);
      setExistingVote(v);
      setShowComment(false);
    } catch {
      // Fail silently — feedback is non-critical
    } finally {
      setLoading(false);
    }
  }

  if (submitted && !showComment) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}>
        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        Thanks for your feedback!
        <button
          className="text-primary underline-offset-2 hover:underline ml-1 text-xs"
          onClick={() => { setSubmitted(false); setVote(null); setExistingVote(null); }}
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Was this helpful?</span>
        <div className="flex items-center gap-2">
          <Button
            variant={vote === 'up' ? 'default' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => handleVote('up')}
            disabled={loading}
          >
            <ThumbsUp className="w-3.5 h-3.5" />
            Yes
          </Button>
          <Button
            variant={vote === 'down' ? 'destructive' : 'outline'}
            size="sm"
            className="gap-1.5"
            onClick={() => handleVote('down')}
            disabled={loading}
          >
            <ThumbsDown className="w-3.5 h-3.5" />
            No
          </Button>
        </div>
      </div>

      {showComment && (
        <div className="space-y-2">
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What was unclear or missing? (optional)"
            className="text-sm resize-none"
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => submitFeedback('down', comment)}
              disabled={loading}
            >
              {loading ? 'Sending…' : 'Send feedback'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setShowComment(false); setVote(null); }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
