
import React, { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose
} from "@/components/ui/sheet";
import {
  Filter, Grid2X2, Rows, ArrowRight, Plus, Rocket, Search
} from "lucide-react";
import { format, parseISO } from "date-fns";
import BulkActionsMenu from "../components/BulkActionsMenu";

const MARKETPLACES = [
  { id: "ebay",     label: "eBay",     icon: "🅔" },
  { id: "facebook", label: "Facebook", icon: "📘" },
  { id: "mercari",  label: "Mercari",  icon: "●"  },
  { id: "etsy",     label: "Etsy",     icon: "🅔" },
  { id: "poshmark", label: "Posh",     icon: "🅟" },
];

const STATUS_COLORS = {
  available: "bg-blue-100 text-blue-800",
  listed:    "bg-yellow-100 text-yellow-800",
  sold:      "bg-gray-100 text-gray-800",
};

export default function Crosslist() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState("rows");
  const [q, setQ] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [selected, setSelected] = useState([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerTargets, setComposerTargets] = useState([]);
  const [activeMkts, setActiveMkts] = useState(["ebay", "facebook", "mercari"]);

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ["inventoryItems"],
    queryFn: () => base44.entities.InventoryItem.list("-purchase_date"),
    initialData: [],
  });

  const computeListingState = (item) => {
    return {
      ebay:     item.status === "listed",
      facebook: false,
      mercari:  false,
      etsy:     false,
      poshmark: false,
    };
  };

  const filtered = useMemo(() => {
    return inventory.filter((it) => {
      const matchesQ =
        !q ||
        it.item_name.toLowerCase().includes(q.toLowerCase()) ||
        it.category?.toLowerCase().includes(q.toLowerCase()) ||
        it.source?.toLowerCase().includes(q.toLowerCase());
      if (!matchesQ) return false;

      if (platformFilter === "all") return true;
      const map = computeListingState(it);
      const anyListed = Object.values(map).some(Boolean);
      return platformFilter === "listed" ? anyListed : !anyListed;
    });
  }, [inventory, q, platformFilter]);

  const toggleSelect = (id) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleAll = (checked) =>
    setSelected(checked ? filtered.map((x) => x.id) : []);

  const toggleMarketActive = (mkt) =>
    setActiveMkts((prev) => (prev.includes(mkt) ? prev.filter((x) => x !== mkt) : [...prev, mkt]));

  const openComposer = (ids) => {
    setComposerTargets(activeMkts);
    if (ids?.length) setSelected(ids);
    setComposerOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      <div className="max-w-7xl mx-auto space-y-6 min-w-0">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground break-words">Crosslist</h1>
            <p className="text-sm text-muted-foreground break-words">
              Start crosslisting your inventory in seconds. Bulk tools now; marketplace APIs later.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0 flex-wrap">
            <Button
              variant="outline"
              onClick={() => setLayout((l) => (l === "rows" ? "grid" : "rows"))}
              className="hidden sm:inline-flex whitespace-nowrap"
            >
              {layout === "rows" ? <Grid2X2 className="w-4 h-4 mr-2" /> : <Rows className="w-4 h-4 mr-2" />}
              {layout === "rows" ? "Grid View" : "Row View"}
            </Button>
            <BulkActionsMenu />
            <Button
              onClick={() => openComposer(selected)}
              disabled={selected.length === 0}
              className="bg-green-600 hover:bg-green-700 whitespace-nowrap"
            >
              <Rocket className="w-4 h-4 mr-2" />
              Crosslist {selected.length > 0 ? `(${selected.length})` : ""}
            </Button>
          </div>
        </div>

        <Card className="border-0 shadow-lg">
          <CardHeader className="border-b bg-gray-800 dark:bg-gray-800">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters & Marketplaces
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 min-w-0">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">
              <div className="relative min-w-0">
                <Label htmlFor="q" className="text-xs mb-1.5 block">Search</Label>
                <Search className="absolute left-2.5 top-9 w-4 h-4 text-muted-foreground" />
                <Input
                  id="q"
                  placeholder="Item name, category, source…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="pl-8 w-full"
                />
              </div>

              <div className="min-w-0">
                <Label className="text-xs mb-1.5 block">Listing State</Label>
                <Select value={platformFilter} onValueChange={setPlatformFilter}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="listed">Listed somewhere</SelectItem>
                    <SelectItem value="unlisted">Not listed anywhere</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="min-w-0">
                <Label className="text-xs mb-1.5 block">Marketplaces</Label>
                <div className="flex flex-wrap gap-2">
                  {MARKETPLACES.map((m) => {
                    const active = activeMkts.includes(m.id);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleMarketActive(m.id)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition whitespace-nowrap
                          ${active
                            ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                            : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                          }`}
                        aria-pressed={active}
                      >
                        <span aria-hidden="true" className="text-xs leading-none">{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 flex-wrap gap-3 min-w-0">
              <div className="text-sm text-muted-foreground">
                Showing <span className="font-medium text-foreground">{filtered.length}</span> of{" "}
                <span className="font-medium text-foreground">{inventory.length}</span> items
              </div>
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  onClick={() => toggleAll(selected.length !== filtered.length)}
                  className="whitespace-nowrap"
                >
                  {selected.length === filtered.length ? "Unselect All" : "Select All"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => openComposer([])}
                  className="whitespace-nowrap"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Compose New Listing
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            No items match your filters.
          </div>
        ) : layout === "rows" ? (
          <div className="divide-y rounded-md border bg-card overflow-x-auto">
            <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-xs text-muted-foreground">
              <div className="col-span-6">Item</div>
              <div className="col-span-2">Purchase</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filtered.map((it) => {
              const map = computeListingState(it);
              return (
                <div key={it.id} className="grid grid-cols-12 gap-4 px-4 py-4 items-center min-w-0">
                  <div className="col-span-12 sm:col-span-6 flex items-center gap-3 min-w-0">
                    <Checkbox
                      checked={selected.includes(it.id)}
                      onCheckedChange={() => toggleSelect(it.id)}
                      className="!bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600 flex-shrink-0"
                    />
                    <img
                      src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={it.item_name}
                      className="w-14 h-14 rounded-md object-cover flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-foreground truncate break-words">{it.item_name}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {it.category || "—"} • {it.source || "—"}
                      </div>

                      <div className="flex flex-wrap gap-1 mt-1">
                        {MARKETPLACES.map((m) => (
                          <Badge key={m.id} variant="outline" className={map[m.id] ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"}>
                            <span className="mr-1 text-[11px]">{m.icon}</span>{m.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2 text-sm min-w-0">
                    <div className="text-foreground font-medium">${(it.purchase_price || 0).toFixed(2)}</div>
                    <div className="text-muted-foreground">
                      {it.purchase_date ? format(parseISO(it.purchase_date), "MMM d, yyyy") : "—"}
                    </div>
                  </div>

                  <div className="col-span-6 sm:col-span-2">
                    <Badge className={`${STATUS_COLORS[it.status] || STATUS_COLORS.available}`}>{it.status}</Badge>
                  </div>

                  <div className="col-span-12 sm:col-span-2 flex sm:justify-end gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      onClick={() => openComposer([it.id])}
                      className="w-full sm:w-auto whitespace-nowrap"
                    >
                      Crosslist
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}
                      className="w-full sm:w-auto whitespace-nowrap"
                    >
                      Edit
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((it) => {
              const map = computeListingState(it);
              return (
                <Card key={it.id} className="overflow-hidden">
                  <div className="relative">
                    <img
                      src={it.image_url || "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/68e86fb5ac26f8511acce7ec/4abea2f77_box.png"}
                      alt={it.item_name}
                      className="aspect-square w-full object-cover"
                    />
                    <div className="absolute top-2 left-2">
                      <Checkbox
                        checked={selected.includes(it.id)}
                        onCheckedChange={() => toggleSelect(it.id)}
                        className="!bg-transparent !border-green-600 border-2 data-[state=checked]:!bg-green-600 data-[state=checked]:!border-green-600"
                      />
                    </div>
                  </div>
                  <CardContent className="p-3">
                    <div className="font-semibold text-sm line-clamp-2 break-words">{it.item_name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{it.category || "—"}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {MARKETPLACES.map((m) => (
                        <Badge key={m.id} variant="outline" className={map[m.id] ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-700 border-gray-200"}>
                          <span className="mr-1 text-[11px]">{m.icon}</span>{m.label}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" className="w-full whitespace-nowrap" onClick={() => openComposer([it.id])}>
                        Crosslist
                      </Button>
                      <Button size="sm" variant="outline" className="w-full whitespace-nowrap" onClick={() => navigate(createPageUrl(`AddInventoryItem?id=${it.id}`))}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Sheet open={composerOpen} onOpenChange={setComposerOpen}>
        <SheetContent side="bottom" className="h-[85vh] sm:rounded-t-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Compose Listing</SheetTitle>
            <SheetDescription>
              Choose marketplaces and set the base fields. Full per-market fine-tuning can follow.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4">
            <Label className="text-xs mb-1.5 block">Target Marketplaces</Label>
            <div className="flex flex-wrap gap-2">
              {MARKETPLACES.map((m) => {
                const active = composerTargets.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() =>
                      setComposerTargets((prev) =>
                        prev.includes(m.id) ? prev.filter((x) => x !== m.id) : [...prev, m.id]
                      )
                    }
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-sm transition
                      ${active
                        ? "bg-foreground text-background dark:bg-foreground dark:text-background"
                        : "bg-muted/70 hover:bg-muted dark:bg-muted/40 dark:hover:bg-muted/60 text-foreground"
                      }`}
                  >
                    <span aria-hidden="true" className="text-xs">{m.icon}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <div>
              <Label className="text-xs mb-1.5 block">Title</Label>
              <Input placeholder="Brand + Model + Size" />
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Price</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs mb-1.5 block">Description</Label>
              <textarea className="w-full rounded-md border bg-background p-2 min-h-[100px]" placeholder="Condition, inclusions, measurements, shipping, returns…" />
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            This is a stub. On submit, we'll call marketplace APIs (eBay, Mercari, etc.)
            to create drafts and return listing URLs & ids to store on the item.
          </div>

          <SheetFooter className="mt-6">
            <SheetClose asChild>
              <Button variant="outline">Cancel</Button>
            </SheetClose>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={() => {
                setComposerOpen(false);
              }}
            >
              Create Drafts
              <Rocket className="w-4 h-4 ml-2" />
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
