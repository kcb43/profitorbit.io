/**
 * Settings › Fulfillment
 *
 * Let users set their pickup / shipping preferences once.
 * These are pulled server-side by /api/ai/generate-description so the AI
 * only ever includes the details the user has actually saved.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, MapPin, Package, Loader2, Check, Info, Smile, ShoppingBag, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { getFulfillmentProfile, saveFulfillmentProfile } from '@/api/fulfillmentApi';
import {
  HANDLING_TIME_OPTIONS,
  FLAT_SHIPPING_SERVICES,
  CALCULATED_SHIPPING_SERVICES,
} from '@/constants/ebay-shipping';

const EBAY_DEFAULTS_KEY = 'ebay-shipping-defaults';
const FACEBOOK_DEFAULTS_KEY = 'facebook-defaults';

const FB_DELIVERY_OPTIONS = [
  { id: 'shipping_and_pickup', label: 'Shipping and Local Pickup' },
  { id: 'shipping', label: 'Shipping Only' },
  { id: 'local_only', label: 'Local Pickup Only' },
];
const FB_SHIPPING_OPTION_OPTIONS = [
  { id: 'own_label', label: 'Ship on my own (own label)' },
  { id: 'prepaid', label: 'Facebook prepaid label' },
];
const FB_CARRIER_OPTIONS = [
  { id: 'usps', label: 'USPS' },
  { id: 'ups', label: 'UPS' },
  { id: 'fedex', label: 'FedEx' },
];

function loadFacebookDefaults() {
  try {
    const stored = localStorage.getItem(FACEBOOK_DEFAULTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}
function saveFacebookDefaults(defaults) {
  try {
    localStorage.setItem(FACEBOOK_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch { /* ignore */ }
}

function loadEbayDefaults() {
  try {
    const stored = localStorage.getItem(EBAY_DEFAULTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveEbayDefaults(defaults) {
  try {
    localStorage.setItem(EBAY_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch { /* ignore */ }
}

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
  const [showEbayDefaults, setShowEbayDefaults] = useState(true);
  const [ebayDefaults, setEbayDefaults] = useState(() => loadEbayDefaults());
  const [showFbDefaults, setShowFbDefaults] = useState(true);
  const [fbDefaults, setFbDefaults] = useState(() => loadFacebookDefaults());

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

  const setEbayDefault = (key, value) => {
    setEbayDefaults((prev) => {
      const next = { ...prev, [key]: value };
      saveEbayDefaults(next);
      return next;
    });
  };

  const setFbDefault = (key, value) => {
    setFbDefaults((prev) => {
      const next = { ...prev, [key]: value };
      saveFacebookDefaults(next);
      return next;
    });
  };

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

        {/* ── eBay Shipping Defaults ──────────────────────────────────────── */}
        <div className="pt-3 border-t">
          <button
            type="button"
            className="w-full flex items-center justify-between group"
            onClick={() => setShowEbayDefaults((v) => !v)}
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">eBay Shipping Defaults</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Smart Listing</Badge>
            </div>
            {showEbayDefaults
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
          <p className="text-xs text-muted-foreground mt-1 ml-6">
            These defaults are used by Smart Listing to pre-fill and suggest eBay shipping fields. Saved automatically as you type.
          </p>

          {showEbayDefaults && (
            <div className="mt-4 space-y-4 pl-1">

              {/* Shipping Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Shipping Method</Label>
                  <Select
                    value={ebayDefaults.shippingMethod || ''}
                    onValueChange={(v) => setEbayDefault('shippingMethod', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Standard: Small to medium items">Standard: Small to medium items</SelectItem>
                      <SelectItem value="Local pickup only: Sell to buyer nears you">Local pickup only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-1.5 block">Handling Time</Label>
                  <Select
                    value={ebayDefaults.handlingTime || ''}
                    onValueChange={(v) => setEbayDefault('handlingTime', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select handling time…" />
                    </SelectTrigger>
                    <SelectContent>
                      {HANDLING_TIME_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Cost Type + Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Shipping Cost Type</Label>
                  <Select
                    value={ebayDefaults.shippingCostType || ''}
                    onValueChange={(v) => {
                      setEbayDefault('shippingCostType', v);
                      // Clear service if cost type changes since services differ
                      setEbayDefault('shippingService', '');
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select cost type…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Flat: Same cost regardless of buyer location">Flat rate</SelectItem>
                      <SelectItem value="Calculated: Cost varies based on buyer location">Calculated by eBay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-sm mb-1.5 block">
                    Default Shipping Cost
                    {ebayDefaults.shippingCostType?.startsWith('Calculated') && (
                      <span className="ml-1 text-xs text-muted-foreground">(eBay calculates — leave blank)</span>
                    )}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder={ebayDefaults.shippingCostType?.startsWith('Calculated') ? 'Calculated by eBay' : '0.00'}
                    disabled={ebayDefaults.shippingCostType?.startsWith('Calculated')}
                    className={ebayDefaults.shippingCostType?.startsWith('Calculated') ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
                    value={ebayDefaults.shippingCostType?.startsWith('Calculated') ? '' : (ebayDefaults.shippingCost || '')}
                    onChange={(e) => setEbayDefault('shippingCost', e.target.value)}
                  />
                </div>
              </div>

              {/* Shipping Service */}
              <div>
                <Label className="text-sm mb-1.5 block">Shipping Service</Label>
                <Select
                  value={ebayDefaults.shippingService || ''}
                  onValueChange={(v) => setEbayDefault('shippingService', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select shipping service…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {(ebayDefaults.shippingCostType?.startsWith('Calculated')
                      ? CALCULATED_SHIPPING_SERVICES
                      : FLAT_SHIPPING_SERVICES
                    ).map((svc) => (
                      <SelectItem key={svc.value} value={svc.value}>
                        {svc.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {ebayDefaults.shippingCostType?.startsWith('Calculated')
                    ? 'Showing calculated-rate services (cost determined by eBay at checkout).'
                    : 'Showing flat-rate services. Select a cost type above to switch.'}
                </p>
              </div>

            </div>
          )}
        </div>

        {/* ── Facebook Marketplace Defaults ──────────────────────────────────── */}
        <div className="pt-3 border-t">
          <button
            type="button"
            onClick={() => setShowFbDefaults((v) => !v)}
            className="w-full flex items-center justify-between py-1 mb-1 hover:opacity-80 transition-opacity"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              <span className="font-medium text-sm">Facebook Marketplace Defaults</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Smart Listing</Badge>
            </div>
            {showFbDefaults
              ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
              : <ChevronDown className="h-4 w-4 text-muted-foreground" />
            }
          </button>
          <p className="text-xs text-muted-foreground mb-1">
            Set your Facebook listing defaults. These will be pre-applied during smart listing review and auto-fill so Orben doesn't ask for them repeatedly.
          </p>

          {showFbDefaults && (
            <div className="mt-4 space-y-4 pl-1">

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={fbDefaults.deliveryMethod || ''}
                    onValueChange={(v) => setFbDefault('deliveryMethod', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select delivery method…" />
                    </SelectTrigger>
                    <SelectContent>
                      {FB_DELIVERY_OPTIONS.map(o => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(fbDefaults.deliveryMethod === 'shipping' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && (
                  <div>
                    <Label className="text-sm mb-1.5 block">Shipping Option</Label>
                    <Select
                      value={fbDefaults.shippingOption || ''}
                      onValueChange={(v) => {
                        setFbDefault('shippingOption', v);
                        if (v === 'prepaid') setFbDefault('shippingCarrier', '');
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select shipping option…" />
                      </SelectTrigger>
                      <SelectContent>
                        {FB_SHIPPING_OPTION_OPTIONS.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {(fbDefaults.deliveryMethod === 'shipping' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && fbDefaults.shippingOption !== 'prepaid' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Preferred Carrier</Label>
                    <Select
                      value={fbDefaults.shippingCarrier || ''}
                      onValueChange={(v) => setFbDefault('shippingCarrier', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select carrier…" />
                      </SelectTrigger>
                      <SelectContent>
                        {FB_CARRIER_OPTIONS.map(o => (
                          <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">
                      Default Shipping Rate
                      {fbDefaults.displayFreeShipping && (
                        <span className="ml-1 text-xs text-muted-foreground">(Free shipping enabled)</span>
                      )}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder={fbDefaults.displayFreeShipping ? 'Free ($0)' : '0.00'}
                      disabled={!!fbDefaults.displayFreeShipping}
                      className={fbDefaults.displayFreeShipping ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
                      value={fbDefaults.displayFreeShipping ? '' : (fbDefaults.shippingPrice || '')}
                      onChange={(e) => setFbDefault('shippingPrice', e.target.value)}
                    />
                  </div>
                </div>
              )}

              {(fbDefaults.deliveryMethod === 'shipping' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && fbDefaults.shippingOption !== 'prepaid' && (
                <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                  <Switch
                    id="fb-default-free-shipping"
                    checked={!!fbDefaults.displayFreeShipping}
                    onCheckedChange={(v) => {
                      setFbDefault('displayFreeShipping', v);
                      if (v) setFbDefault('shippingPrice', '');
                    }}
                  />
                  <Label htmlFor="fb-default-free-shipping" className="text-sm leading-tight cursor-pointer">
                    Display Free Shipping by default — covers shipping cost, deducted from payout
                  </Label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Default Meet-up / Pickup Location</Label>
                  <Input
                    placeholder="e.g. Boston, MA"
                    value={fbDefaults.meetUpLocation || ''}
                    onChange={(e) => setFbDefault('meetUpLocation', e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used for local pickup listings.</p>
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Minimum Offer Price ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="e.g. 10.00"
                    value={fbDefaults.minimumOfferPrice || ''}
                    onChange={(e) => setFbDefault('minimumOfferPrice', e.target.value)}
                    disabled={!fbDefaults.allowOffers}
                    className={!fbDefaults.allowOffers ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 flex-1">
                  <Switch
                    id="fb-default-allow-offers"
                    checked={fbDefaults.allowOffers !== false}
                    onCheckedChange={(v) => {
                      setFbDefault('allowOffers', v);
                      if (!v) setFbDefault('minimumOfferPrice', '');
                    }}
                  />
                  <Label htmlFor="fb-default-allow-offers" className="text-sm leading-tight cursor-pointer">
                    Allow offers by default
                  </Label>
                </div>
                <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 flex-1">
                  <Switch
                    id="fb-default-hide-friends"
                    checked={!!fbDefaults.hideFromFriends}
                    onCheckedChange={(v) => setFbDefault('hideFromFriends', v)}
                  />
                  <Label htmlFor="fb-default-hide-friends" className="text-sm leading-tight cursor-pointer">
                    Hide from Facebook friends by default
                  </Label>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                All changes save automatically. The smart listing review will not flag these fields once defaults are set.
              </p>

            </div>
          )}
        </div>

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
