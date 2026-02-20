import React, { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Package, Plus, RefreshCw, Trash2, ExternalLink,
  Truck, CheckCircle2, AlertTriangle, Clock, RotateCcw,
  ChevronDown, ChevronUp, MapPin, Download, X, Info,
  ArrowRight, PackageCheck, Loader2
} from "lucide-react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";

import {
  trackingApi, shipmentsApi, labelsApi, shippoApi,
  addressesApi, parcelsApi,
} from "@/api/shippingApi";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CARRIERS = [
  { value: "usps", label: "USPS" },
  { value: "ups", label: "UPS" },
  { value: "fedex", label: "FedEx" },
  { value: "dhl_express", label: "DHL Express" },
  { value: "amazon", label: "Amazon Logistics" },
  { value: "ontrac", label: "OnTrac" },
  { value: "lasership", label: "LaserShip" },
];

const STATUS_CONFIG = {
  delivered:   { label: "Delivered",   icon: CheckCircle2,  color: "text-emerald-500", bg: "bg-emerald-500/10" },
  in_transit:  { label: "In Transit",  icon: Truck,         color: "text-blue-500",    bg: "bg-blue-500/10"    },
  pre_transit: { label: "Pre-Transit", icon: Clock,         color: "text-yellow-500",  bg: "bg-yellow-500/10"  },
  exception:   { label: "Exception",   icon: AlertTriangle, color: "text-red-500",     bg: "bg-red-500/10"     },
  returned:    { label: "Returned",    icon: RotateCcw,     color: "text-orange-500",  bg: "bg-orange-500/10"  },
  unknown:     { label: "Unknown",     icon: Package,       color: "text-muted-foreground", bg: "bg-muted"     },
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.unknown;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function formatDate(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit",
    });
  } catch {
    return ts;
  }
}

// ─── Track Tab ────────────────────────────────────────────────────────────────

function AddTrackingDialog({ open, onOpenChange, onSuccess }) {
  const [form, setForm] = useState({ carrier: "", tracking_number: "", to_name: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.tracking_number.trim()) {
      toast.error("Tracking number is required");
      return;
    }
    setLoading(true);
    try {
      await trackingApi.add({
        carrier:         form.carrier || undefined,
        tracking_number: form.tracking_number.trim(),
        to_name:         form.to_name.trim() || undefined,
      });
      toast.success("Tracking added");
      setForm({ carrier: "", tracking_number: "", to_name: "" });
      onSuccess?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(err.message || "Failed to add tracking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Tracking Number</DialogTitle>
          <DialogDescription>
            Carrier is optional — Shippo will infer it from the tracking number format.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="tracking_number">Tracking Number *</Label>
            <Input
              id="tracking_number"
              placeholder="9400111899223870980423"
              value={form.tracking_number}
              onChange={e => setForm(f => ({ ...f, tracking_number: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>Carrier (optional)</Label>
            <Select value={form.carrier} onValueChange={v => setForm(f => ({ ...f, carrier: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Auto-detect" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Auto-detect</SelectItem>
                {CARRIERS.map(c => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to_name">Recipient Name (optional)</Label>
            <Input
              id="to_name"
              placeholder="John Doe"
              value={form.to_name}
              onChange={e => setForm(f => ({ ...f, to_name: e.target.value }))}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Add Tracking
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TrackingTimeline({ events = [] }) {
  if (!events.length) {
    return <p className="text-sm text-muted-foreground py-4 text-center">No tracking events yet.</p>;
  }

  const sorted = [...events].sort((a, b) =>
    new Date(b.occurred_at || 0) - new Date(a.occurred_at || 0)
  );

  return (
    <ol className="relative border-l border-border ml-3 space-y-4 py-2">
      {sorted.map((ev, i) => {
        const cfg = STATUS_CONFIG[ev.status] || STATUS_CONFIG.unknown;
        const Icon = cfg.icon;
        return (
          <li key={i} className="ml-5">
            <span className={`absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full ${cfg.bg} ${cfg.color}`}>
              <Icon className="w-3 h-3" />
            </span>
            <p className="text-sm font-medium leading-tight">{ev.message || cfg.label}</p>
            {ev.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3" />{ev.location}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(ev.occurred_at)}</p>
          </li>
        );
      })}
    </ol>
  );
}

function ShipmentDetailPanel({ shipment, onClose, onDelete, onRefresh }) {
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh(shipment.id);
      toast.success("Tracking refreshed");
    } catch (err) {
      toast.error(err.message || "Failed to refresh");
    } finally {
      setRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm("Remove this tracking entry?")) return;
    setDeleting(true);
    try {
      await onDelete(shipment.id);
      toast.success("Tracking removed");
      onClose();
    } catch (err) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  const toAddr = shipment.to_address;

  return (
    <div className="border border-border rounded-xl bg-card shadow-sm overflow-hidden">
      <div className="flex items-start justify-between p-4 border-b border-border">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            {shipment.carrier?.toUpperCase() || "Carrier unknown"}
          </p>
          <p className="font-mono text-sm font-medium">{shipment.tracking_number}</p>
          {shipment.to_name && (
            <p className="text-sm text-muted-foreground mt-0.5">To: {shipment.to_name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={shipment.status} />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {toAddr && (
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            {[toAddr.street1, toAddr.city, toAddr.state, toAddr.zip].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Timeline</h4>
          <p className="text-xs text-muted-foreground">
            Last update: {formatDate(shipment.last_event_at)}
          </p>
        </div>
        <TrackingTimeline events={shipment.events || []} />
      </div>

      <div className="flex items-center gap-2 p-4 border-t border-border">
        <Button
          size="sm"
          variant="outline"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          }
          Refresh
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          disabled={deleting}
        >
          {deleting
            ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
            : <Trash2 className="w-3.5 h-3.5 mr-1.5" />
          }
          Remove
        </Button>
      </div>
    </div>
  );
}

function TrackTab() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);

  const { data: shipments = [], isLoading } = useQuery({
    queryKey: ["shipments"],
    queryFn: shipmentsApi.list,
  });

  const handleRefresh = useCallback(async (id) => {
    const updated = await trackingApi.refresh(id);
    qc.setQueryData(["shipments"], prev =>
      (prev || []).map(s => s.id === id ? updated : s)
    );
    return updated;
  }, [qc]);

  const handleDelete = useCallback(async (id) => {
    await shipmentsApi.delete(id);
    qc.setQueryData(["shipments"], prev => (prev || []).filter(s => s.id !== id));
  }, [qc]);

  const selected = shipments.find(s => s.id === selectedId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold">Tracking Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Monitor shipments across all carriers
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Add Tracking
        </Button>
      </div>

      <div className={`gap-4 ${selected ? "grid grid-cols-1 lg:grid-cols-5" : ""}`}>
        {/* Table */}
        <div className={selected ? "lg:col-span-3" : ""}>
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              Loading shipments…
            </div>
          ) : shipments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
              <Truck className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="font-medium text-muted-foreground">No shipments tracked</p>
              <p className="text-sm text-muted-foreground mt-1 mb-4">
                Add a tracking number to get started
              </p>
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Add Tracking
              </Button>
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Status</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Tracking #</TableHead>
                    <TableHead className="hidden md:table-cell">Recipient</TableHead>
                    <TableHead className="hidden md:table-cell">Last Update</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.map(s => (
                    <TableRow
                      key={s.id}
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${
                        s.id === selectedId ? "bg-primary/5 border-l-2 border-l-primary" : ""
                      }`}
                      onClick={() => setSelectedId(s.id === selectedId ? null : s.id)}
                    >
                      <TableCell><StatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-sm font-medium">
                        {s.carrier?.toUpperCase() || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.tracking_number || "—"}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {s.to_name || "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {formatDate(s.last_event_at)}
                      </TableCell>
                      <TableCell>
                        <ChevronDown
                          className={`w-4 h-4 text-muted-foreground transition-transform ${
                            s.id === selectedId ? "rotate-180" : ""
                          }`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="lg:col-span-2">
            <ShipmentDetailPanel
              shipment={selected}
              onClose={() => setSelectedId(null)}
              onDelete={handleDelete}
              onRefresh={handleRefresh}
            />
          </div>
        )}
      </div>

      <AddTrackingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["shipments"] })}
      />
    </div>
  );
}

// ─── Create Label Tab ─────────────────────────────────────────────────────────

const LABEL_STEPS = ["From Address", "To Address", "Parcel", "Rates", "Confirm"];

function AddressForm({ value, onChange, saved = [] }) {
  const [useSaved, setUseSaved] = useState(false);

  const handleSavedSelect = (idx) => {
    if (idx === "") return;
    const addr = saved[Number(idx)];
    if (addr) {
      onChange({
        name: addr.name, company: addr.company || "",
        street1: addr.street1, street2: addr.street2 || "",
        city: addr.city, state: addr.state, zip: addr.zip,
        country: addr.country, phone: addr.phone || "", email: addr.email || "",
      });
      setUseSaved(false);
    }
  };

  const field = (key, label, placeholder = "", required = false) => (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-destructive ml-0.5">*</span>}</Label>
      <Input
        placeholder={placeholder}
        value={value[key] || ""}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <Label>Load Saved Address</Label>
          <Select onValueChange={handleSavedSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose saved address…" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((a, i) => (
                <SelectItem key={a.id} value={String(i)}>
                  {a.label} — {a.name}, {a.city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator className="my-2" />
        </div>
      )}
      {field("name", "Full Name", "John Doe", true)}
      {field("company", "Company", "Acme Inc.")}
      {field("street1", "Street 1", "123 Main St", true)}
      {field("street2", "Street 2 / Apt", "Apt 4B")}
      <div className="grid grid-cols-2 gap-3">
        {field("city", "City", "New York", true)}
        {field("state", "State", "NY", true)}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("zip", "ZIP", "10001", true)}
        <div className="space-y-1.5">
          <Label>Country</Label>
          <Select value={value.country || "US"} onValueChange={v => onChange({ ...value, country: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="US">United States</SelectItem>
              <SelectItem value="CA">Canada</SelectItem>
              <SelectItem value="GB">United Kingdom</SelectItem>
              <SelectItem value="AU">Australia</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {field("phone", "Phone", "+1 555-555-5555")}
      {field("email", "Email", "john@example.com")}
    </div>
  );
}

function ParcelForm({ value, onChange, saved = [] }) {
  const field = (key, label, placeholder = "", type = "text") => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        placeholder={placeholder}
        value={value[key] || ""}
        onChange={e => onChange({ ...value, [key]: e.target.value })}
      />
    </div>
  );

  const handleSavedSelect = (idx) => {
    if (idx === "") return;
    const p = saved[Number(idx)];
    if (p) {
      onChange({
        name: p.name || "",
        length: String(p.length), width: String(p.width), height: String(p.height),
        distance_unit: p.distance_unit || "in",
        weight: String(p.weight), mass_unit: p.mass_unit || "lb",
      });
    }
  };

  return (
    <div className="space-y-3">
      {saved.length > 0 && (
        <div className="space-y-1.5">
          <Label>Load Preset</Label>
          <Select onValueChange={handleSavedSelect}>
            <SelectTrigger>
              <SelectValue placeholder="Choose parcel preset…" />
            </SelectTrigger>
            <SelectContent>
              {saved.map((p, i) => (
                <SelectItem key={p.id} value={String(i)}>
                  {p.name} ({p.length}×{p.width}×{p.height}{p.distance_unit}, {p.weight}{p.mass_unit})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Separator className="my-2" />
        </div>
      )}

      {field("name", "Parcel Name (optional)", "Small box")}

      <div className="grid grid-cols-3 gap-3">
        {field("length", "Length", "12", "number")}
        {field("width", "Width", "9", "number")}
        {field("height", "Height", "4", "number")}
      </div>
      <div className="space-y-1.5">
        <Label>Dimension Unit</Label>
        <Select value={value.distance_unit || "in"} onValueChange={v => onChange({ ...value, distance_unit: v })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="in">Inches (in)</SelectItem>
            <SelectItem value="cm">Centimeters (cm)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("weight", "Weight", "1.5", "number")}
        <div className="space-y-1.5">
          <Label>Weight Unit</Label>
          <Select value={value.mass_unit || "lb"} onValueChange={v => onChange({ ...value, mass_unit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="lb">Pounds (lb)</SelectItem>
              <SelectItem value="oz">Ounces (oz)</SelectItem>
              <SelectItem value="kg">Kilograms (kg)</SelectItem>
              <SelectItem value="g">Grams (g)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function RateCard({ rate, selected, onSelect }) {
  const days = rate.days ? `Est. ${rate.days} day${rate.days !== 1 ? "s" : ""}` : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(rate)}
      className={`w-full text-left p-3 rounded-lg border transition-all ${
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/50 hover:bg-muted/40"
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-sm">{rate.carrier} — {rate.servicelevel}</p>
          {days && <p className="text-xs text-muted-foreground mt-0.5">{days}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-primary">${rate.amount}</p>
          <p className="text-xs text-muted-foreground">{rate.currency}</p>
        </div>
      </div>
    </button>
  );
}

function CreateLabelTab() {
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [fromAddr, setFromAddr] = useState({ country: "US" });
  const [toAddr, setToAddr] = useState({ country: "US" });
  const [parcel, setParcel] = useState({ distance_unit: "in", mass_unit: "lb" });
  const [rates, setRates] = useState([]);
  const [shipmentObjectId, setShipmentObjectId] = useState(null);
  const [selectedRate, setSelectedRate] = useState(null);
  const [loadingRates, setLoadingRates] = useState(false);
  const [buying, setBuying] = useState(false);
  const [result, setResult] = useState(null);

  const { data: savedAddresses = [] } = useQuery({
    queryKey: ["shipping-addresses"],
    queryFn: addressesApi.list,
  });

  const { data: savedParcels = [] } = useQuery({
    queryKey: ["parcel-presets"],
    queryFn: parcelsApi.list,
  });

  const isShippoConfigured = true; // We'll show a warning at the rates step if key missing

  const validateAddress = (addr, label) => {
    const required = ["name", "street1", "city", "state", "zip"];
    for (const f of required) {
      if (!addr[f]?.trim()) {
        toast.error(`${label}: ${f.replace("_", " ")} is required`);
        return false;
      }
    }
    return true;
  };

  const validateParcel = (p) => {
    if (!p.length || !p.width || !p.height || !p.weight) {
      toast.error("All parcel dimensions and weight are required");
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (step === 0 && !validateAddress(fromAddr, "From address")) return;
    if (step === 1 && !validateAddress(toAddr, "To address")) return;
    if (step === 2) {
      if (!validateParcel(parcel)) return;
      setLoadingRates(true);
      try {
        const resp = await shippoApi.getRates({ from_address: fromAddr, to_address: toAddr, parcel });
        setRates(resp.rates || []);
        setShipmentObjectId(resp.shipment_object_id);
        setSelectedRate(null);
      } catch (err) {
        toast.error(err.message || "Failed to fetch rates");
        setLoadingRates(false);
        return;
      } finally {
        setLoadingRates(false);
      }
    }
    if (step === 3 && !selectedRate) {
      toast.error("Please select a shipping rate");
      return;
    }
    setStep(s => Math.min(s + 1, LABEL_STEPS.length - 1));
  };

  const handleBuy = async () => {
    if (!selectedRate) return;
    setBuying(true);
    try {
      const resp = await shippoApi.buyLabel({
        rate_object_id:     selectedRate.object_id,
        shipment_object_id: shipmentObjectId,
        from_address:       fromAddr,
        to_address:         toAddr,
        parcel,
      });
      setResult(resp);
      qc.invalidateQueries({ queryKey: ["shipments"] });
      qc.invalidateQueries({ queryKey: ["shipping-labels"] });
      toast.success("Label purchased!");
    } catch (err) {
      toast.error(err.message || "Failed to purchase label");
    } finally {
      setBuying(false);
    }
  };

  const reset = () => {
    setStep(0);
    setFromAddr({ country: "US" });
    setToAddr({ country: "US" });
    setParcel({ distance_unit: "in", mass_unit: "lb" });
    setRates([]);
    setSelectedRate(null);
    setResult(null);
    setShipmentObjectId(null);
  };

  if (result) {
    return (
      <div className="max-w-md mx-auto py-8 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
          <PackageCheck className="w-8 h-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-bold mb-1">Label Purchased!</h2>
        <p className="text-muted-foreground text-sm mb-6">
          Your shipping label has been created and tracking is active.
        </p>
        <div className="bg-card border border-border rounded-xl p-4 text-left mb-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Carrier</span>
            <span className="font-medium">{result.label?.carrier?.toUpperCase()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Service</span>
            <span className="font-medium">{result.label?.servicelevel}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cost</span>
            <span className="font-bold text-primary">
              ${result.label?.rate_amount} {result.label?.rate_currency}
            </span>
          </div>
          <Separator />
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Tracking #</span>
            <span className="font-mono text-xs font-medium">{result.tracking_number}</span>
          </div>
        </div>
        <div className="flex gap-2 justify-center">
          {result.label_url && (
            <Button asChild>
              <a href={result.label_url} target="_blank" rel="noopener noreferrer">
                <Download className="w-4 h-4 mr-2" />
                Download Label (PDF)
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={reset}>
            Create Another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-1">Create Shipping Label</h2>
        <p className="text-sm text-muted-foreground">Powered by Shippo — multi-carrier label purchasing</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-1 mb-6">
        {LABEL_STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-1.5 ${i <= step ? "text-primary" : "text-muted-foreground"}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border-2 border-primary text-primary"
                    : "border border-muted-foreground/30 text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs hidden sm:inline">{s}</span>
            </div>
            {i < LABEL_STEPS.length - 1 && (
              <div className={`flex-1 h-px transition-colors ${i < step ? "bg-primary/50" : "bg-border"}`} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-card border border-border rounded-xl p-5 mb-4">
        {step === 0 && (
          <AddressForm value={fromAddr} onChange={setFromAddr} saved={savedAddresses} />
        )}
        {step === 1 && (
          <AddressForm value={toAddr} onChange={setToAddr} saved={savedAddresses} />
        )}
        {step === 2 && (
          <ParcelForm value={parcel} onChange={setParcel} saved={savedParcels} />
        )}
        {step === 3 && (
          <div className="space-y-3">
            {loadingRates ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Fetching rates…
              </div>
            ) : rates.length === 0 ? (
              <div className="text-center py-8">
                <AlertTriangle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                <p className="text-sm font-medium">No rates returned</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Shippo API key may not be configured yet, or address validation failed.
                </p>
              </div>
            ) : (
              rates.map(r => (
                <RateCard
                  key={r.object_id}
                  rate={r}
                  selected={selectedRate?.object_id === r.object_id}
                  onSelect={setSelectedRate}
                />
              ))
            )}
          </div>
        )}
        {step === 4 && selectedRate && (
          <div className="space-y-4">
            <h3 className="font-semibold text-sm">Confirm Purchase</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">From</span>
                <span className="font-medium">{fromAddr.name}, {fromAddr.city} {fromAddr.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">To</span>
                <span className="font-medium">{toAddr.name}, {toAddr.city} {toAddr.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Parcel</span>
                <span className="font-medium">
                  {parcel.length}×{parcel.width}×{parcel.height}{parcel.distance_unit}, {parcel.weight}{parcel.mass_unit}
                </span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Carrier</span>
                <span className="font-medium">{selectedRate.carrier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Service</span>
                <span className="font-medium">{selectedRate.servicelevel}</span>
              </div>
              {selectedRate.days && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Estimated Transit</span>
                  <span className="font-medium">{selectedRate.days} day{selectedRate.days !== 1 ? "s" : ""}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base">
                <span className="font-semibold">Total</span>
                <span className="font-bold text-primary">${selectedRate.amount} {selectedRate.currency}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => Math.max(s - 1, 0))}
          disabled={step === 0}
        >
          Back
        </Button>
        {step < LABEL_STEPS.length - 1 ? (
          <Button onClick={handleNext} disabled={loadingRates}>
            {loadingRates && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {step === 2 ? "Get Rates" : "Next"}
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        ) : (
          <Button onClick={handleBuy} disabled={buying || !selectedRate}>
            {buying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Purchase Label — ${selectedRate?.amount}
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Labels Tab ───────────────────────────────────────────────────────────────

function LabelsTab() {
  const { data: labels = [], isLoading } = useQuery({
    queryKey: ["shipping-labels"],
    queryFn: () => labelsApi.list(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        Loading labels…
      </div>
    );
  }

  if (labels.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-xl">
        <Package className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="font-medium text-muted-foreground">No labels yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Purchase a label in the "Create Label" tab to see it here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Label History</h2>
        <p className="text-sm text-muted-foreground">{labels.length} label{labels.length !== 1 ? "s" : ""} purchased</p>
      </div>
      <div className="rounded-xl border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Date</TableHead>
              <TableHead>Carrier / Service</TableHead>
              <TableHead className="hidden md:table-cell">Tracking #</TableHead>
              <TableHead className="hidden md:table-cell">To</TableHead>
              <TableHead>Cost</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {labels.map(l => (
              <TableRow key={l.id}>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(l.created_at)}
                </TableCell>
                <TableCell>
                  <p className="text-sm font-medium">{l.carrier?.toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{l.servicelevel}</p>
                </TableCell>
                <TableCell className="hidden md:table-cell font-mono text-xs">
                  {l.tracking_number || "—"}
                </TableCell>
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                  {l.to_address?.name || "—"}
                  {l.to_address?.city && `, ${l.to_address.city}`}
                </TableCell>
                <TableCell className="font-semibold text-sm">
                  {l.rate_amount ? `$${Number(l.rate_amount).toFixed(2)}` : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={l.status === "VALID" ? "default" : "secondary"} className="text-xs">
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {l.label_url && (
                    <a
                      href={l.label_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Download label PDF"
                    >
                      <Button variant="ghost" size="icon" className="h-7 w-7">
                        <Download className="w-3.5 h-3.5" />
                      </Button>
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Shipping() {
  const [tab, setTab] = useState("track");

  return (
    <div className="px-4 md:px-6 lg:px-8 py-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Truck className="w-6 h-6 text-primary" />
            Shipping
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Track packages and purchase shipping labels across all major carriers
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="h-9">
          <TabsTrigger value="track" className="gap-1.5 text-sm">
            <Truck className="w-3.5 h-3.5" />
            Track
          </TabsTrigger>
          <TabsTrigger value="create" className="gap-1.5 text-sm">
            <Plus className="w-3.5 h-3.5" />
            Create Label
          </TabsTrigger>
          <TabsTrigger value="labels" className="gap-1.5 text-sm">
            <Package className="w-3.5 h-3.5" />
            Labels
          </TabsTrigger>
        </TabsList>

        <TabsContent value="track">
          <TrackTab />
        </TabsContent>

        <TabsContent value="create">
          <CreateLabelTab />
        </TabsContent>

        <TabsContent value="labels">
          <LabelsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
