/**
 * Settings › Fulfillment
 *
 * Let users set their pickup / shipping preferences once.
 * These are pulled server-side by /api/ai/generate-description so the AI
 * only ever includes the details the user has actually saved.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, MapPin, Package, Loader2, Check, Info, Smile } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getFulfillmentProfile, saveFulfillmentProfile } from '@/api/fulfillmentApi';

const PLATFORMS = [
  { id: 'facebook', label: 'Facebook Marketplace', placeholder: 'e.g. Pickup in Easton, MA. I can also ship if needed.' },
  { id: 'mercari',  label: 'Mercari',              placeholder: 'e.g. Fast shipping, usually next business day.' },
  { id: 'ebay',     label: 'eBay',                 placeholder: 'e.g. Ships within 1 business day via USPS. Free Shipping on all orders.' },
  { id: 'etsy',     label: 'Etsy',                 placeholder: 'e.g. Ships carefully packed within 2 business days.' },
  { id: 'poshmark', label: 'Poshmark',             placeholder: 'e.g. Ships within 1 business day.' },
];

export default function FulfillmentSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving, setIsSaving]     = useState(false);
  const [showPlatform, setShowPlatform] = useState(true);

  const [form, setForm] = useState({
    pickup_enabled:       false,
    pickup_location_line: '',
    pickup_notes:         '',
    shipping_enabled:     true,
    shipping_notes:       '',
    platform_notes:       {},
  });

  // Load existing profile on mount
  useEffect(() => {
    getFulfillmentProfile()
      .then((data) => {
        if (data && Object.keys(data).length > 0) {
          setForm({
            pickup_enabled:       Boolean(data.pickup_enabled),
            pickup_location_line: data.pickup_location_line || '',
            pickup_notes:         data.pickup_notes || '',
            shipping_enabled:     data.shipping_enabled !== false,
            shipping_notes:       data.shipping_notes || '',
            platform_notes:       data.platform_notes || {},
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const setPlatformNote = (platformId, value) =>
    setForm((prev) => ({
      ...prev,
      platform_notes: { ...prev.platform_notes, [platformId]: value },
    }));

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveFulfillmentProfile(form);
      toast({ title: 'Fulfillment settings saved', description: 'Your pickup and shipping details have been updated.' });
    } catch (err) {
      toast({ title: 'Failed to save', description: err.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate('/Settings')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Fulfillment Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your pickup and shipping preferences — used by the AI description generator so it
            never invents these details.
          </p>
        </div>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          The AI will <strong>only</strong> include pickup or shipping lines if the corresponding
          option is enabled here. If disabled, no fulfillment text will appear in generated descriptions.
        </AlertDescription>
      </Alert>

      {/* ── Pickup ───────────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border p-5 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Local Pickup</h2>
              <p className="text-xs text-muted-foreground">Show a pickup option in descriptions</p>
            </div>
          </div>
          <Switch
            checked={form.pickup_enabled}
            onCheckedChange={(v) => set('pickup_enabled', v)}
          />
        </div>

        {form.pickup_enabled && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label htmlFor="pickup_location">Pickup location line</Label>
              <Input
                id="pickup_location"
                placeholder="e.g. Pickup in Easton, MA 02356"
                value={form.pickup_location_line}
                onChange={(e) => set('pickup_location_line', e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                This exact text will appear at the end of AI-generated descriptions.
              </p>
            </div>
            <div>
              <Label htmlFor="pickup_notes">Pickup notes <span className="text-muted-foreground">(optional)</span></Label>
              <Input
                id="pickup_notes"
                placeholder="e.g. Meet at police station, evenings only"
                value={form.pickup_notes}
                onChange={(e) => set('pickup_notes', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Shipping ─────────────────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border p-5 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Shipping</h2>
              <p className="text-xs text-muted-foreground">Mention shipping availability in descriptions</p>
            </div>
          </div>
          <Switch
            checked={form.shipping_enabled}
            onCheckedChange={(v) => set('shipping_enabled', v)}
          />
        </div>

        {form.shipping_enabled && (
          <div className="space-y-3 pt-2 border-t">
            <div>
              <Label htmlFor="shipping_notes">Shipping note</Label>
              <Input
                id="shipping_notes"
                placeholder="e.g. Ships next business day via USPS"
                value={form.shipping_notes}
                onChange={(e) => set('shipping_notes', e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        )}
      </section>

      {/* ── Per-platform overrides ────────────────────────────────────────────── */}
      <section className="space-y-4 rounded-xl border p-5 bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">Platform-specific overrides</h2>
              <p className="text-xs text-muted-foreground">
                Write a custom fulfillment line for a specific marketplace. Overrides the defaults above.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowPlatform((v) => !v)}>
            {showPlatform ? 'Hide' : 'Show'}
          </Button>
        </div>

        {showPlatform && (
          <div className="space-y-4 pt-2 border-t">
            {PLATFORMS.map(({ id, label, placeholder }) => (
              <div key={id}>
                <Label htmlFor={`platform_${id}`}>{label}</Label>
                <Textarea
                  id={`platform_${id}`}
                  placeholder={placeholder}
                  value={form.platform_notes?.[id] || ''}
                  onChange={(e) => setPlatformNote(id, e.target.value)}
                  rows={2}
                  className="mt-1 text-sm"
                />
                {id === 'ebay' && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Tip: Include "Free Shipping" or "Next Day Shipping" here and the AI will add it to your eBay title suggestions.
                  </p>
                )}
              </div>
            ))}

            {/* eBay Emoji Toggle */}
            <div className="rounded-lg border p-4 bg-muted/20 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smile className="h-4 w-4 text-primary" />
                  <div>
                    <Label className="font-medium">eBay Emoji Descriptions</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      When enabled, the AI will use emojis before section headings in eBay descriptions (e.g. ✅ Features & Details).
                    </p>
                  </div>
                </div>
                <Switch
                  checked={Boolean(form.platform_notes?.ebay_emojis)}
                  onCheckedChange={(v) => setPlatformNote('ebay_emojis', v || undefined)}
                />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/Settings')}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          {isSaving ? 'Saving…' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
