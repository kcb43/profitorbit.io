import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { CheckCircle2, Send } from 'lucide-react';
import { supabase } from '@/integrations/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';

const ORBEN_API_URL = import.meta.env.VITE_ORBEN_API_URL || 'https://orben-api.fly.dev';

export default function SubmitDeal() {
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    price: '',
    merchant: '',
    notes: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title || !formData.url) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in title and URL',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({
          title: 'Authentication required',
          description: 'Please log in to submit deals',
          variant: 'destructive'
        });
        navigate('/login');
        return;
      }

      const response = await fetch(`${ORBEN_API_URL}/v1/deals/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: formData.title,
          url: formData.url,
          price: formData.price ? parseFloat(formData.price) : null,
          merchant: formData.merchant || null,
          notes: formData.notes || null
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit deal');
      }

      setSubmitted(true);
      toast({
        title: 'Deal submitted!',
        description: 'Your submission is pending review',
        variant: 'default'
      });

      // Reset form
      setTimeout(() => {
        setFormData({
          title: '',
          url: '',
          price: '',
          merchant: '',
          notes: ''
        });
        setSubmitted(false);
      }, 3000);
    } catch (error) {
      toast({
        title: 'Submission failed',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
        <Card className="p-8 sm:p-12">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 sm:w-16 sm:h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Deal Submitted!</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-6">
              Thank you for contributing. Your deal is now pending review and will appear in the feed once approved.
            </p>
            <Button onClick={() => navigate('/deals')} className="w-full sm:w-auto">View Deals Feed</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 sm:p-6 max-w-2xl">
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold">Submit a Deal</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1">
          Found a great deal? Share it with the community!
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Deal Information</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Deal Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="e.g., PlayStation 5 Console 50% Off at Best Buy"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label htmlFor="url">
                Deal URL <span className="text-red-500">*</span>
              </Label>
              <Input
                id="url"
                type="url"
                placeholder="https://..."
                value={formData.url}
                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                required
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <Label htmlFor="price">Price (USD)</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                placeholder="299.99"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
              />
            </div>

            {/* Merchant */}
            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant/Retailer</Label>
              <Input
                id="merchant"
                placeholder="e.g., Amazon, Walmart, Best Buy"
                value={formData.merchant}
                onChange={(e) => setFormData({ ...formData, merchant: e.target.value })}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Additional Notes</Label>
              <Textarea
                id="notes"
                placeholder="Any additional details about the deal (coupon codes, conditions, etc.)"
                rows={4}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Deal
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/deals')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardContent className="pt-6">
          <h3 className="font-semibold mb-2">Submission Guidelines</h3>
          <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
            <li>Only submit deals from legitimate retailers</li>
            <li>Ensure the link works and leads directly to the deal</li>
            <li>Include accurate pricing information</li>
            <li>Add any relevant coupon codes in the notes</li>
            <li>Focus on deals with good resale value</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
