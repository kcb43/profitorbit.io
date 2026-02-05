import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Plus, History, Trash2 } from "lucide-react";

const MARKETPLACES = [
  { id: "ebay", label: "eBay", color: "bg-blue-600" },
  { id: "mercari", label: "Mercari", color: "bg-orange-600" },
  { id: "facebook", label: "Facebook", color: "bg-sky-600" },
  { id: "poshmark", label: "Poshmark", color: "bg-pink-600" },
  { id: "depop", label: "Depop", color: "bg-red-600" },
  { id: "grailed", label: "Grailed", color: "bg-black" },
];

function loadRules(marketplace) {
  try {
    const raw = localStorage.getItem(`po_auto_offers_rules_${marketplace}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return { enabled: false, rules: [] };
    return {
      enabled: Boolean(parsed.enabled),
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
    };
  } catch (_) {
    return { enabled: false, rules: [] };
  }
}

function saveRules(marketplace, state) {
  try {
    localStorage.setItem(`po_auto_offers_rules_${marketplace}`, JSON.stringify(state));
  } catch (_) {}
}

export default function ProToolsAutoOffers() {
  const { toast } = useToast();
  const [marketplace, setMarketplace] = useState("ebay");

  const initial = useMemo(() => loadRules(marketplace), [marketplace]);
  const [enabled, setEnabled] = useState(Boolean(initial.enabled));
  const [rules, setRules] = useState(initial.rules);

  // Keep state in sync when switching marketplace
  React.useEffect(() => {
    const next = loadRules(marketplace);
    setEnabled(Boolean(next.enabled));
    setRules(next.rules);
  }, [marketplace]);

  const addRule = () => {
    setRules((prev) => [
      ...(prev || []),
      {
        id: `rule_${Date.now()}`,
        minPrice: "",
        maxPrice: "",
        noPriceLimit: true,
        pctOff: "10",
        excludeNwt: false,
        excludeListedHours: "0",
      },
    ]);
  };

  const updateRule = (id, patch) => {
    setRules((prev) => (prev || []).map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const removeRule = (id) => {
    setRules((prev) => (prev || []).filter((r) => r.id !== id));
  };

  const persist = () => {
    saveRules(marketplace, { enabled, rules });
    toast({ title: "Saved", description: "Auto Offer rules saved. Next step: wire automation to marketplace events via extension/server polling." });
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 min-w-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link to={createPageUrl("Pro Tools")} className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-4 w-4" />
                Pro Tools
              </Link>
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words mt-1">Auto Offers</h1>
            <p className="text-sm text-muted-foreground break-words">
              Configure rules for automatic offers to new likers/watchers. (Automation wiring comes next.)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={persist}>
              <History className="h-4 w-4" />
              Save
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 min-w-0">
          <Card className="lg:col-span-3 border border-border/60 bg-card/60 min-w-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Marketplaces</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {MARKETPLACES.map((m) => {
                const isActive = marketplace === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMarketplace(m.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left min-w-0 ${
                      isActive ? "border-emerald-500/50 bg-emerald-500/10" : "border-border/60 hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`h-8 w-8 rounded-full ${m.color} flex items-center justify-center text-white text-xs font-bold`}>
                        {m.label.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground">{m.label}</div>
                        <div className="text-xs text-muted-foreground truncate">{enabled && isActive ? "Active" : "Off"}</div>
                      </div>
                    </div>
                    {isActive ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">On</Badge> : <Badge variant="secondary">Off</Badge>}
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <div className="lg:col-span-9 space-y-3 min-w-0">
            <Card className="border border-border/60 bg-card/60 min-w-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <span>{MARKETPLACES.find((m) => m.id === marketplace)?.label || "Marketplace"}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <button
                      type="button"
                      onClick={() => setEnabled((v) => !v)}
                      className={`h-6 w-11 rounded-full border transition-colors ${enabled ? "bg-emerald-600 border-emerald-700" : "bg-muted border-border"}`}
                      aria-label="Toggle auto offers"
                    >
                      <span className={`block h-5 w-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-4 min-w-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs">Offer price based on</Label>
                    <Input value="Profit Orbit price" readOnly className="mt-1" />
                  </div>
                  <div className="min-w-0 flex items-end">
                    <Button type="button" variant="outline" className="gap-2" onClick={addRule}>
                      <Plus className="h-4 w-4" />
                      Add new rule
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  {rules.map((r, idx) => (
                    <div key={r.id} className="rounded-lg border border-border/60 p-3 bg-background/50 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="text-sm font-semibold">Price Rule ({idx + 1})</div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => removeRule(r.id)}
                          aria-label="Remove rule"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 min-w-0">
                        <div className="md:col-span-2 min-w-0">
                          <Label className="text-xs">If the price is between</Label>
                          <div className="mt-1 flex items-center gap-2 min-w-0">
                            <Input
                              value={r.minPrice}
                              onChange={(e) => updateRule(r.id, { minPrice: e.target.value })}
                              placeholder="$ 0"
                              inputMode="decimal"
                              className="min-w-0"
                              disabled={r.noPriceLimit}
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                              value={r.maxPrice}
                              onChange={(e) => updateRule(r.id, { maxPrice: e.target.value })}
                              placeholder="$ 0"
                              inputMode="decimal"
                              className="min-w-0"
                              disabled={r.noPriceLimit}
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Checkbox
                              checked={Boolean(r.noPriceLimit)}
                              onCheckedChange={(v) => updateRule(r.id, { noPriceLimit: Boolean(v) })}
                            />
                            <span className="text-sm">No price limit</span>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <Label className="text-xs">Offer % off</Label>
                          <Input
                            value={r.pctOff}
                            onChange={(e) => updateRule(r.id, { pctOff: e.target.value })}
                            inputMode="decimal"
                            className="mt-1"
                          />
                        </div>

                        <div className="min-w-0">
                          <Label className="text-xs">Exclusions</Label>
                          <div className="mt-1 space-y-2">
                            <div className="flex items-center gap-2">
                              <Checkbox
                                checked={Boolean(r.excludeNwt)}
                                onCheckedChange={(v) => updateRule(r.id, { excludeNwt: Boolean(v) })}
                              />
                              <span className="text-sm">New with tags items (NWT)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-muted-foreground">Listed in last</span>
                              <Input
                                value={r.excludeListedHours}
                                onChange={(e) => updateRule(r.id, { excludeListedHours: e.target.value })}
                                inputMode="decimal"
                                className="w-20"
                              />
                              <span className="text-sm text-muted-foreground">hours</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {rules.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      No rules yet. Click <span className="font-medium text-foreground">Add new rule</span> to start.
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

