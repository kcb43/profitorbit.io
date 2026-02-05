import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { ArrowLeft, Play, Pause, Activity } from "lucide-react";

const MARKETPLACES = [
  { id: "poshmark", label: "Poshmark", color: "bg-pink-600", action: "Share" },
  { id: "depop", label: "Depop", color: "bg-red-600", action: "Refresh" },
  { id: "grailed", label: "Grailed", color: "bg-black", action: "Bump" },
];

function loadSharing(marketplace) {
  try {
    const raw = localStorage.getItem(`po_marketplace_sharing_${marketplace}`);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed) return { enabled: false, intervalMinutes: "30" };
    return {
      enabled: Boolean(parsed.enabled),
      intervalMinutes: String(parsed.intervalMinutes ?? "30"),
    };
  } catch (_) {
    return { enabled: false, intervalMinutes: "30" };
  }
}

function saveSharing(marketplace, state) {
  try {
    localStorage.setItem(`po_marketplace_sharing_${marketplace}`, JSON.stringify(state));
  } catch (_) {}
}

export default function ProToolsMarketplaceSharing() {
  const { toast } = useToast();
  const [marketplace, setMarketplace] = useState("poshmark");

  const initial = loadSharing(marketplace);
  const [enabled, setEnabled] = useState(Boolean(initial.enabled));
  const [intervalMinutes, setIntervalMinutes] = useState(String(initial.intervalMinutes || "30"));

  React.useEffect(() => {
    const next = loadSharing(marketplace);
    setEnabled(Boolean(next.enabled));
    setIntervalMinutes(String(next.intervalMinutes || "30"));
  }, [marketplace]);

  const persist = () => {
    saveSharing(marketplace, { enabled, intervalMinutes });
    toast({ title: "Saved", description: "Sharing settings saved. Next step: run these actions via extension automation on each marketplace." });
  };

  const toggle = () => {
    setEnabled((v) => !v);
  };

  const actionLabel = MARKETPLACES.find((m) => m.id === marketplace)?.action || "Run";

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
              <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Beta</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words mt-1">Marketplace Sharing</h1>
            <p className="text-sm text-muted-foreground break-words">
              Automate visibility actions like sharing/refreshing/bumping. (Automation wiring comes next.)
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" className="gap-2" onClick={persist}>
              <Activity className="h-4 w-4" />
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
                        <div className="text-xs text-muted-foreground truncate">{m.action}</div>
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
                      onClick={toggle}
                      className={`h-6 w-11 rounded-full border transition-colors ${enabled ? "bg-emerald-600 border-emerald-700" : "bg-muted border-border"}`}
                      aria-label="Toggle sharing"
                    >
                      <span className={`block h-5 w-5 bg-white rounded-full transition-transform ${enabled ? "translate-x-5" : "translate-x-1"}`} />
                    </button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <Label className="text-xs">Run every (minutes)</Label>
                    <Input
                      value={intervalMinutes}
                      onChange={(e) => setIntervalMinutes(e.target.value)}
                      inputMode="decimal"
                      className="mt-1"
                    />
                    <div className="text-xs text-muted-foreground mt-1">
                      We’ll run <span className="font-medium text-foreground">{actionLabel}</span> automatically at this interval.
                    </div>
                  </div>
                  <div className="min-w-0 flex items-end gap-2">
                    <Button
                      type="button"
                      className="bg-emerald-600 hover:bg-emerald-700 gap-2"
                      onClick={() => toast({ title: "Coming next", description: "We’ll wire this to extension automation per marketplace (no visible tabs where possible)." })}
                    >
                      <Play className="h-4 w-4" />
                      Run once now
                    </Button>
                    <Button type="button" variant="outline" className="gap-2" onClick={() => setEnabled(false)}>
                      <Pause className="h-4 w-4" />
                      Stop
                    </Button>
                  </div>
                </div>

                <div className="rounded-lg border border-border/60 p-3 bg-background/50">
                  <div className="text-sm font-semibold">Activity Log</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    We’ll record runs here (success/fail + timestamps). For now, this is a placeholder until automation is wired.
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

