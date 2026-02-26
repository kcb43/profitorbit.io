/**
 * Settings › Fulfillment
 *
 * Let users set their pickup / shipping preferences once.
 * These are pulled server-side by /api/ai/generate-description so the AI
 * only ever includes the details the user has actually saved.
 */

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Truck, MapPin, Package, Loader2, Check, Info, Smile, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { getFulfillmentProfile, saveFulfillmentProfile } from '@/api/fulfillmentApi';
import {
  HANDLING_TIME_OPTIONS,
  FLAT_SHIPPING_SERVICES,
  CALCULATED_SHIPPING_SERVICES,
} from '@/constants/ebay-shipping';

const EBAY_DEFAULTS_KEY = 'ebay-shipping-defaults';

const EBAY_COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
  'France', 'Italy', 'Spain', 'Japan', 'China', 'Mexico', 'Brazil',
  'Netherlands', 'Belgium', 'Sweden', 'Switzerland', 'Austria', 'Poland',
  'Portugal', 'Ireland', 'New Zealand', 'Singapore', 'Hong Kong', 'India',
  'South Korea', 'Israel', 'United Arab Emirates', 'Saudi Arabia',
  'South Africa', 'Argentina', 'Chile', 'Colombia', 'Peru', 'Russia',
  'Ukraine', 'Turkey', 'Greece', 'Denmark', 'Finland', 'Norway',
];
const FACEBOOK_DEFAULTS_KEY = 'facebook-defaults';
const MERCARI_DEFAULTS_KEY = 'mercari-defaults';

const MERCARI_DELIVERY_OPTIONS = [
  { id: 'prepaid', label: 'Mercari Prepaid Label' },
  { id: 'ship_on_own', label: 'Ship on Your Own' },
];

const FB_DELIVERY_OPTIONS = [
  { id: 'shipping_and_pickup', label: 'Shipping and Local Pickup' },
  { id: 'shipping_only', label: 'Shipping Only' },
  { id: 'local_pickup', label: 'Local Pickup Only' },
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
    const parsed = stored ? JSON.parse(stored) : {};
    // Migrate old IDs to match form: local_only -> local_pickup, shipping -> shipping_only
    if (parsed.deliveryMethod === 'local_only') parsed.deliveryMethod = 'local_pickup';
    if (parsed.deliveryMethod === 'shipping') parsed.deliveryMethod = 'shipping_only';
    return parsed;
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

function loadMercariDefaults() {
  try {
    const stored = localStorage.getItem(MERCARI_DEFAULTS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}
function saveMercariDefaults(defaults) {
  try {
    localStorage.setItem(MERCARI_DEFAULTS_KEY, JSON.stringify(defaults));
  } catch { /* ignore */ }
}

const MARKETPLACE_LOGOS = {
  facebook: 'https://upload.wikimedia.org/wikipedia/commons/b/b9/2023_Facebook_icon.svg',
  mercari: 'https://cdn.brandfetch.io/idjAt9LfED/w/400/h/400/theme/dark/icon.jpeg?c=1dxbfHSJFAPEGdCLU4o5B',
  ebay: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/EBay_logo.svg',
  etsy: 'https://cdn.brandfetch.io/idzyTAzn6G/theme/dark/logo.svg?c=1dxbfHSJFAPEGdCLU4o5B',
  poshmark: 'https://cdn.brandfetch.io/idUxsADOAW/theme/dark/symbol.svg?c=1dxbfHSJFAPEGdCLU4o5B',
};

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

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [openMarketplace, setOpenMarketplace] = useState(null);
  const [ebayDefaults, setEbayDefaults] = useState(() => loadEbayDefaults());
  const [fbDefaults, setFbDefaults] = useState(() => loadFacebookDefaults());
  const [mercariDefaults, setMercariDefaults] = useState(() => loadMercariDefaults());

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

  const setMercariDefault = (key, value) => {
    setMercariDefaults((prev) => {
      const next = { ...prev, [key]: value };
      saveMercariDefaults(next);
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
        <div className="pt-3 border-t flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </section>

      {/* ── Marketplace Settings ───────────────────────────────────────────────── */}
      <section className="space-y-3 rounded-xl border p-5 bg-card">
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-semibold">Marketplace Settings</h2>
            <p className="text-xs text-muted-foreground">
              Per-marketplace fulfillment notes and listing defaults. Overrides the general pickup/shipping above.
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-2">
          {PLATFORMS.map(({ id, label, placeholder }) => {
            const isOpen = openMarketplace === id;
            const logo = MARKETPLACE_LOGOS[id];
            return (
              <Collapsible
                key={id}
                open={isOpen}
                onOpenChange={(open) => setOpenMarketplace(open ? id : null)}
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50",
                      isOpen && "border-primary/50 bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {logo && (
                        <img src={logo} alt={label} className="h-6 w-6 shrink-0 object-contain" />
                      )}
                      <span className="font-medium truncate">{label}</span>
                    </div>
                    <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-3 rounded-lg border bg-muted/20 p-4 space-y-4">
                    {/* Platform note (all marketplaces) */}
                    <div>
                      <Label htmlFor={`platform_${id}`}>Fulfillment note</Label>
                      <Textarea
                        id={`platform_${id}`}
                        placeholder={placeholder}
                        value={form.platform_notes?.[id] || ''}
                        onChange={(e) => setPlatformNote(id, e.target.value)}
                        rows={2}
                        className="mt-1.5 text-sm"
                      />
                    </div>

                    {/* eBay-specific: defaults + emoji toggle */}
                    {id === 'ebay' && (() => {
            const isEbayLocalPickup = ebayDefaults.shippingMethod?.startsWith('Local pickup');
            return (
            <div className="mt-4 space-y-5 pl-1">

              {/* ── Group A: Listing Format ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Listing Format</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Pricing Format</Label>
                    <Select
                      value={ebayDefaults.pricingFormat || 'fixed'}
                      onValueChange={(v) => setEbayDefault('pricingFormat', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Price</SelectItem>
                        <SelectItem value="auction">Auction</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Duration</Label>
                    <Select
                      value={ebayDefaults.duration || ''}
                      onValueChange={(v) => setEbayDefault('duration', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select…" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Good 'Til Canceled">Good 'Til Canceled</SelectItem>
                        <SelectItem value="30 Days">30 Days</SelectItem>
                        <SelectItem value="7 Days">7 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Group A2: Pricing & Offers ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pricing &amp; Offers</p>
                <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 mb-3">
                  <Switch
                    id="ebay-default-best-offer"
                    checked={ebayDefaults.allowBestOffer !== false}
                    onCheckedChange={(v) => {
                      setEbayDefault('allowBestOffer', v);
                      if (!v) { setEbayDefault('autoAcceptPrice', ''); setEbayDefault('minimumOfferPrice', ''); }
                    }}
                  />
                  <Label htmlFor="ebay-default-best-offer" className="text-sm cursor-pointer">Allow Best Offer by default</Label>
                </div>
                {ebayDefaults.allowBestOffer !== false && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Auto-accept price</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-6"
                          placeholder="0.00"
                          value={ebayDefaults.autoAcceptPrice || ''}
                          onChange={(e) => setEbayDefault('autoAcceptPrice', e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Auto-accept offers at or above this price.</p>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Minimum offer price</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          className="pl-6"
                          placeholder="0.00"
                          value={ebayDefaults.minimumOfferPrice || ''}
                          onChange={(e) => setEbayDefault('minimumOfferPrice', e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Auto-decline offers below this price.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Group B: Shipping Method & Toggles ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Shipping Method</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Shipping Method</Label>
                    <Select
                      value={ebayDefaults.shippingMethod || ''}
                      onValueChange={(v) => {
                        setEbayDefault('shippingMethod', v);
                        if (v?.startsWith('Local pickup')) {
                          setEbayDefault('shippingCostType', '');
                          setEbayDefault('shippingCost', '');
                          setEbayDefault('shippingService', '');
                          setEbayDefault('handlingTime', '');
                          setEbayDefault('freeShipping', false);
                          setEbayDefault('addLocalPickup', false);
                        }
                      }}
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

                  {!isEbayLocalPickup && (
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
                  )}
                </div>

                {!isEbayLocalPickup && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3">
                      <Label className="text-sm font-medium">Free Shipping</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="ebay-default-free-shipping"
                          checked={!!ebayDefaults.freeShipping}
                          onCheckedChange={(v) => {
                            setEbayDefault('freeShipping', v);
                            if (v) setEbayDefault('shippingCost', '');
                          }}
                        />
                        <Label htmlFor="ebay-default-free-shipping" className="text-sm cursor-pointer">Enable free shipping by default</Label>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-muted-foreground/40 p-3">
                      <Label className="text-sm font-medium">Add Local Pickup</Label>
                      <div className="flex items-center gap-2">
                        <Switch
                          id="ebay-default-local-pickup"
                          checked={!!ebayDefaults.addLocalPickup}
                          onCheckedChange={(v) => {
                            setEbayDefault('addLocalPickup', v);
                            if (!v) setEbayDefault('localPickupLocation', '');
                          }}
                        />
                        <Label htmlFor="ebay-default-local-pickup" className="text-sm cursor-pointer">Allow local pickup in addition to shipping</Label>
                      </div>
                    </div>
                  </div>
                )}

                {!isEbayLocalPickup && ebayDefaults.addLocalPickup && (
                  <div className="mt-4">
                    <Label className="text-sm mb-1.5 block">Local Pickup Location</Label>
                    <Input
                      placeholder="e.g. Los Angeles, CA 90001"
                      value={ebayDefaults.localPickupLocation || ''}
                      onChange={(e) => setEbayDefault('localPickupLocation', e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">Buyers near this location can arrange local pickup.</p>
                  </div>
                )}
              </div>

              {/* ── Group C: Shipping Details (hidden for local pickup) ── */}
              {!isEbayLocalPickup && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Shipping Details</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Shipping Cost Type</Label>
                      <Select
                        value={ebayDefaults.shippingCostType || ''}
                        onValueChange={(v) => {
                          setEbayDefault('shippingCostType', v);
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
                        {(ebayDefaults.freeShipping || ebayDefaults.shippingCostType?.startsWith('Calculated')) && (
                          <span className="ml-1 text-xs text-muted-foreground">
                            {ebayDefaults.freeShipping ? '(free shipping enabled)' : '(eBay calculates)'}
                          </span>
                        )}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={ebayDefaults.freeShipping ? 'Free ($0)' : ebayDefaults.shippingCostType?.startsWith('Calculated') ? 'Calculated by eBay' : '0.00'}
                        disabled={!!ebayDefaults.freeShipping || ebayDefaults.shippingCostType?.startsWith('Calculated')}
                        className={(ebayDefaults.freeShipping || ebayDefaults.shippingCostType?.startsWith('Calculated')) ? 'opacity-50 cursor-not-allowed bg-muted' : ''}
                        value={(ebayDefaults.freeShipping || ebayDefaults.shippingCostType?.startsWith('Calculated')) ? '' : (ebayDefaults.shippingCost || '')}
                        onChange={(e) => setEbayDefault('shippingCost', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="mt-4">
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
                          <SelectItem key={svc.value} value={svc.value}>{svc.label}</SelectItem>
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

              {/* ── Group D: Package Details (for calculated shipping) ── */}
              {!isEbayLocalPickup && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Package Details</p>
                  <p className="text-xs text-muted-foreground mb-3">Required for eBay calculated shipping. Pre-fills the General form when listing.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Weight (lbs)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={ebayDefaults.packageWeight || ''}
                        onChange={(e) => setEbayDefault('packageWeight', e.target.value)}
                      />
                    </div>
                    <div className="sm:col-span-2 grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm mb-1.5 block">Length (in)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={ebayDefaults.packageLength || ''}
                          onChange={(e) => setEbayDefault('packageLength', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Width (in)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={ebayDefaults.packageWidth || ''}
                          onChange={(e) => setEbayDefault('packageWidth', e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-sm mb-1.5 block">Height (in)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={ebayDefaults.packageHeight || ''}
                          onChange={(e) => setEbayDefault('packageHeight', e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <Label className="text-sm mb-1.5 block">Package Notes (optional)</Label>
                      <Input
                        placeholder="Fragile, special handling, etc."
                        value={ebayDefaults.packageDetails || ''}
                        onChange={(e) => setEbayDefault('packageDetails', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Group E: Location (always visible) ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Location</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm mb-1.5 block">Ship From Country</Label>
                    <Select
                      value={ebayDefaults.shipFromCountry || 'United States'}
                      onValueChange={(v) => setEbayDefault('shipFromCountry', v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select country…" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {EBAY_COUNTRIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-sm mb-1.5 block">Shipping Location (zip/region)</Label>
                    <Input
                      placeholder="e.g. 90001 or Los Angeles"
                      value={ebayDefaults.shippingLocation || ''}
                      onChange={(e) => setEbayDefault('shippingLocation', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <Label className="text-sm mb-1.5 block">Location Description</Label>
                  <Input
                    placeholder="e.g. Spain (optional text shown to buyers)"
                    value={ebayDefaults.locationDescriptions || ''}
                    onChange={(e) => setEbayDefault('locationDescriptions', e.target.value)}
                  />
                </div>
              </div>

              {/* ── Group F: Returns ── */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Returns</p>
                <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2 mb-4">
                  <Switch
                    id="ebay-default-accept-returns"
                    checked={!!ebayDefaults.acceptReturns}
                    onCheckedChange={(v) => {
                      setEbayDefault('acceptReturns', v);
                      if (!v) {
                        setEbayDefault('returnWithin', '');
                        setEbayDefault('returnShippingPayer', '');
                        setEbayDefault('returnRefundMethod', '');
                      }
                    }}
                  />
                  <Label htmlFor="ebay-default-accept-returns" className="text-sm cursor-pointer">Accept returns by default</Label>
                </div>
                {ebayDefaults.acceptReturns && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-sm mb-1.5 block">Return Within</Label>
                      <Select
                        value={ebayDefaults.returnWithin || '30 days'}
                        onValueChange={(v) => setEbayDefault('returnWithin', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30 days">30 days</SelectItem>
                          <SelectItem value="60 days">60 days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Return Shipping Payer</Label>
                      <Select
                        value={ebayDefaults.returnShippingPayer || 'Buyer'}
                        onValueChange={(v) => setEbayDefault('returnShippingPayer', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Buyer">Buyer pays</SelectItem>
                          <SelectItem value="Free for buyer, you pay">Free for buyer, you pay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-sm mb-1.5 block">Refund Method</Label>
                      <Select
                        value={ebayDefaults.returnRefundMethod || 'Full Refund'}
                        onValueChange={(v) => setEbayDefault('returnRefundMethod', v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Full Refund">Full Refund</SelectItem>
                          <SelectItem value="Full Refund or Replacement">Full Refund or Replacement</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground">eBay defaults save automatically. Smart Listing will skip flagging fields that have a saved default.</p>

              {/* eBay Emoji Toggle */}
              <div className="rounded-lg border border-dashed border-muted-foreground/40 p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Smile className="h-4 w-4 text-primary" />
                    <div>
                      <Label className="font-medium text-sm">Emoji descriptions</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Use emojis before section headings in eBay descriptions.</p>
                    </div>
                  </div>
                  <Switch
                    checked={Boolean(form.platform_notes?.ebay_emojis)}
                    onCheckedChange={(v) => setPlatformNote('ebay_emojis', v || undefined)}
                  />
                </div>
              </div>
            </div>
            );
          })()}

                    {/* Mercari-specific: defaults (excludes smart pricing/offers - those change per item) */}
                    {id === 'mercari' && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Smart Listing</Badge>
                <span className="text-xs text-muted-foreground">Pre-applied during smart listing review.</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Ships From (Zip Code)</Label>
                  <Input
                    placeholder="e.g. 90210"
                    maxLength={5}
                    value={mercariDefaults.shipsFrom || ''}
                    onChange={(e) => setMercariDefault('shipsFrom', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-sm mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={mercariDefaults.deliveryMethod || 'prepaid'}
                    onValueChange={(v) => setMercariDefault('deliveryMethod', v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select…" />
                    </SelectTrigger>
                    <SelectContent>
                      {MERCARI_DELIVERY_OPTIONS.map((o) => (
                        <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Smart Pricing & Smart Offers — per-item; flag in Smart Listing unless user disables here */}
              <div className="space-y-3 pt-2 border-t">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Smart Pricing &amp; Offers</p>
                <p className="text-xs text-muted-foreground">These change per item, so they&apos;re not in fulfillment. Smart Listing will flag them when listing to Mercari. Turn both off below to skip the flag.</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="mercari-disable-smart-pricing"
                      checked={!!mercariDefaults.smartPricingDisabled}
                      onCheckedChange={(v) => setMercariDefault('smartPricingDisabled', v)}
                    />
                    <Label htmlFor="mercari-disable-smart-pricing" className="text-sm cursor-pointer">I don&apos;t use Smart Pricing (won&apos;t flag in Smart Listing)</Label>
                  </div>
                  <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                    <Switch
                      id="mercari-disable-smart-offers"
                      checked={!!mercariDefaults.smartOffersDisabled}
                      onCheckedChange={(v) => setMercariDefault('smartOffersDisabled', v)}
                    />
                    <Label htmlFor="mercari-disable-smart-offers" className="text-sm cursor-pointer">I don&apos;t use Smart Offers (won&apos;t flag in Smart Listing)</Label>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">Mercari defaults save automatically. Smart Pricing and Smart Offers are set per listing.</p>
            </div>
                    )}

                    {/* Facebook-specific: defaults */}
                    {id === 'facebook' && (
            <div className="space-y-4 pt-2 border-t">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Smart Listing</Badge>
                <span className="text-xs text-muted-foreground">Pre-applied during smart listing review.</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm mb-1.5 block">Delivery Method</Label>
                  <Select
                    value={fbDefaults.deliveryMethod || ''}
                    onValueChange={(v) => {
                      setFbDefault('deliveryMethod', v);
                      if (v === 'local_pickup') {
                        setFbDefault('allowOffers', false);
                        setFbDefault('minimumOfferPrice', '');
                      }
                    }}
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

                {(fbDefaults.deliveryMethod === 'shipping_only' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && (
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

              {(fbDefaults.deliveryMethod === 'shipping_only' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && fbDefaults.shippingOption !== 'prepaid' && (
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

              {(fbDefaults.deliveryMethod === 'shipping_only' || fbDefaults.deliveryMethod === 'shipping_and_pickup') && fbDefaults.shippingOption !== 'prepaid' && (
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
              </div>

              {/* Allow Offers is NOT in fulfillment settings — it gets flagged in Smart Listing when delivery is Shipping Only or Shipping & Local Pickup. Set delivery to Local Pickup Only above to avoid the flag. */}
              <div className="flex items-center gap-3 rounded-md border border-dashed border-muted-foreground/40 px-3 py-2">
                <Switch
                  id="fb-default-hide-friends"
                  checked={!!fbDefaults.hideFromFriends}
                  onCheckedChange={(v) => setFbDefault('hideFromFriends', v)}
                />
                <Label htmlFor="fb-default-hide-friends" className="text-sm leading-tight cursor-pointer">
                  Hide from Facebook friends by default
                </Label>
              </div>

              <p className="text-xs text-muted-foreground">Facebook defaults save automatically.</p>
            </div>
                    )}

                    {/* Save button (saves fulfillment profile; eBay/FB defaults save to localStorage automatically) */}
                    <div className="pt-2 border-t flex justify-end">
                      <Button onClick={handleSave} disabled={isSaving} size="sm" className="gap-2">
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        {isSaving ? 'Saving…' : 'Save'}
                      </Button>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/Settings')}>
          Back to Settings
        </Button>
      </div>
    </div>
  );
}
