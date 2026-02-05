import React, { useMemo, useState } from "react";
import { supabase } from "@/api/supabaseClient";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

function tryParseJson(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (e) {
    return { ok: false, error: e?.message || "Invalid JSON" };
  }
}

function normalizeArray(input, keys = []) {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === "object") {
    for (const k of keys) {
      if (Array.isArray(input[k])) return input[k];
    }
  }
  return [];
}

function toNumber(v, fallback = 0) {
  const n = typeof v === "string" ? Number(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toIsoDateOrNull(v) {
  if (!v) return null;
  // If already YYYY-MM-DD or ISO, keep it.
  if (typeof v === "string") return v;
  return null;
}

function isUuidLike(v) {
  if (!v || typeof v !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

function appendImportTag(notes, tagLine) {
  const base = (notes || "").trim();
  if (base.includes(tagLine)) return base || null;
  const joined = base ? `${base}\n${tagLine}` : tagLine;
  return joined.trim() || null;
}

function base44Tag(kind, id) {
  if (!id) return null;
  return `Base44 ${kind} ID: ${id}`;
}

function mapInventoryItem(item) {
  const base44Id = item?.id || item?._id || null;
  const taggedNotes = base44Tag("inventory", base44Id)
    ? appendImportTag(item.notes, base44Tag("inventory", base44Id))
    : (item.notes || null);

  return {
    __base44_id: base44Id,
    item_name: item.item_name || item.itemName || item.title || item.name || "Unnamed Item",
    purchase_price: toNumber(item.purchase_price ?? item.purchasePrice ?? item.cost ?? 0),
    purchase_date: toIsoDateOrNull(item.purchase_date || item.purchaseDate || item.date_purchased),
    source: item.source || item.store || null,
    status: item.status || "available",
    category: item.category || null,
    notes: taggedNotes,
    image_url: item.image_url || item.imageUrl || item.image || null,
    images: Array.isArray(item.images)
      ? item.images
      : (item.image_url || item.imageUrl ? [item.image_url || item.imageUrl] : []),
    quantity: toNumber(item.quantity ?? 1, 1) || 1,
    quantity_sold: toNumber(item.quantity_sold ?? item.quantitySold ?? 0, 0),
    return_deadline: toIsoDateOrNull(item.return_deadline || item.returnDeadline),
    return_deadline_dismissed: Boolean(item.return_deadline_dismissed ?? item.returnDeadlineDismissed ?? false),
  };
}

function mapSale(sale) {
  // App expects `selling_price` (see AddSale/Dashboard).
  const selling_price =
    sale.selling_price ??
    sale.sellingPrice ??
    sale.sale_price ??
    sale.salePrice ??
    sale.price ??
    0;

  const purchase_price = sale.purchase_price ?? sale.purchasePrice ?? 0;
  const shipping_cost = sale.shipping_cost ?? sale.shippingCost ?? 0;
  const platform_fees = sale.platform_fees ?? sale.platformFees ?? 0;
  const other_costs = sale.other_costs ?? sale.otherCosts ?? 0;
  const vat_fees = sale.vat_fees ?? sale.vatFees ?? 0;

  // If Base44 didn't store profit, compute it.
  const computedProfit =
    toNumber(selling_price) -
    (toNumber(purchase_price) +
      toNumber(shipping_cost) +
      toNumber(platform_fees) +
      toNumber(other_costs) +
      toNumber(vat_fees));

  const base44SaleId = sale?.id || sale?._id || null;
  const base44InventoryId = sale.inventory_id || sale.inventoryId || null;

  let taggedNotes = sale.notes || null;
  const saleTag = base44Tag("sale", base44SaleId);
  const invTag = base44Tag("inventory", base44InventoryId);
  if (saleTag) taggedNotes = appendImportTag(taggedNotes, saleTag);
  if (invTag) taggedNotes = appendImportTag(taggedNotes, `Base44 linked inventory ID: ${base44InventoryId}`);

  return {
    __base44_id: base44SaleId,
    __base44_inventory_id: base44InventoryId,
    // IMPORTANT: inventory_id must be a UUID in Supabase. We'll fill this in later using a mapping.
    inventory_id: isUuidLike(base44InventoryId) ? base44InventoryId : null,
    item_name: sale.item_name || sale.itemName || sale.title || null,
    purchase_price: toNumber(purchase_price),
    purchase_date: toIsoDateOrNull(sale.purchase_date || sale.purchaseDate),
    selling_price: toNumber(selling_price),
    sale_date: toIsoDateOrNull(sale.sale_date || sale.saleDate || sale.date_sold),
    platform: sale.platform || sale.marketplace || null,
    source: sale.source || sale.store || null,
    category: sale.category || null,
    shipping_cost: toNumber(shipping_cost),
    platform_fees: toNumber(platform_fees),
    vat_fees: toNumber(vat_fees),
    other_costs: toNumber(other_costs),
    profit: Number.isFinite(Number(sale.profit)) ? toNumber(sale.profit) : computedProfit,
    notes: taggedNotes,
    image_url: sale.image_url || sale.imageUrl || null,
    quantity_sold: toNumber(sale.quantity_sold ?? sale.quantitySold ?? 1, 1) || 1,
    return_deadline: toIsoDateOrNull(sale.return_deadline || sale.returnDeadline),
  };
}

async function postWithUser(url, userId, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${url} ${res.status}: ${text}`);
  }

  return res.json();
}

export default function MigrateData() {
  const queryClient = useQueryClient();
  const [fullExportJson, setFullExportJson] = useState("");
  const [inventoryJson, setInventoryJson] = useState("");
  const [salesJson, setSalesJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState([]);
  const [backfillBusy, setBackfillBusy] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState(null);
  const [confirmed, setConfirmed] = useState(false);

  const fullParsed = useMemo(() => tryParseJson(fullExportJson), [fullExportJson]);
  const invParsed = useMemo(() => tryParseJson(inventoryJson), [inventoryJson]);
  const salesParsed = useMemo(() => tryParseJson(salesJson), [salesJson]);

  const fullInvRows = useMemo(
    () => normalizeArray(fullParsed.value, ["inventory_items", "inventoryItems", "inventory", "items"]),
    [fullParsed.value],
  );
  const fullSalesRows = useMemo(
    () => normalizeArray(fullParsed.value, ["sales", "sale_items", "saleItems", "rows"]),
    [fullParsed.value],
  );

  const invRows = useMemo(() => {
    if (fullInvRows.length > 0) return fullInvRows;
    return normalizeArray(invParsed.value, ["inventory_items", "inventory", "items", "inventoryItems"]);
  }, [fullInvRows, invParsed.value]);

  const salesRows = useMemo(() => {
    if (fullSalesRows.length > 0) return fullSalesRows;
    return normalizeArray(salesParsed.value, ["sales", "sale_items", "rows", "saleItems"]);
  }, [fullSalesRows, salesParsed.value]);

  const preview = useMemo(() => {
    const mappedSales = salesRows.map(mapSale);
    const profitSum = mappedSales.reduce((sum, s) => sum + (toNumber(s.profit) || 0), 0);
    return {
      inventoryCount: invRows.length,
      salesCount: salesRows.length,
      profitSum,
    };
  }, [invRows, salesRows]);

  const runImport = async () => {
    setStatus(null);
    setErrors([]);

    if (!confirmed) {
      setStatus("Please confirm you understand this is a migration-only tool before importing.");
      return;
    }

    if (!fullParsed.ok) {
      setStatus(`Full export JSON invalid: ${fullParsed.error}`);
      return;
    }
    if (!invParsed.ok) {
      setStatus(`Inventory JSON invalid: ${invParsed.error}`);
      return;
    }
    if (!salesParsed.ok) {
      setStatus(`Sales JSON invalid: ${salesParsed.error}`);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
      setStatus("You must be signed in to import.");
      return;
    }

    const userId = session.user.id;
    const invToImportRaw = invRows.map(mapInventoryItem);
    const salesToImportRaw = salesRows.map(mapSale);

    // Load existing rows once so re-running import doesn't duplicate.
    setStatus("Loading existing inventory + sales (for dedupe)...");
    let existingInventory = [];
    let existingSales = [];
    try {
      existingInventory = await fetch("/api/inventory", {
        headers: { "x-user-id": userId },
      }).then((r) => (r.ok ? r.json() : Promise.resolve([])));
      existingSales = await fetch("/api/sales", {
        headers: { "x-user-id": userId },
      }).then((r) => (r.ok ? r.json() : Promise.resolve([])));
    } catch {
      // If this fails, we still proceed (worst case: duplicates)
      existingInventory = [];
      existingSales = [];
    }

    const existingInvNotes = new Map(); // base44Id -> supabaseUuid
    for (const row of existingInventory || []) {
      const notes = String(row?.notes || "");
      const m = notes.match(/Base44 inventory ID:\s*([^\s]+)/i);
      if (m?.[1] && row?.id) existingInvNotes.set(m[1], row.id);
    }

    const existingSaleBase44 = new Set();
    for (const row of existingSales || []) {
      const notes = String(row?.notes || "");
      const m = notes.match(/Base44 sale ID:\s*([^\s]+)/i);
      if (m?.[1]) existingSaleBase44.add(m[1]);
    }

    // Build base44 inventory id -> newly created uuid mapping for this run
    const invIdMap = new Map(existingInvNotes);

    const invToImport = invToImportRaw.filter((it) => {
      if (!it.__base44_id) return true;
      return !invIdMap.has(it.__base44_id);
    });

    const salesToImport = salesToImportRaw.filter((s) => {
      if (!s.__base44_id) return true;
      return !existingSaleBase44.has(s.__base44_id);
    });

    if (invToImportRaw.length === 0 && salesToImportRaw.length === 0) {
      setStatus("No rows found. Paste your full Base44 export JSON (recommended) or paste inventory + sales JSON.");
      return;
    }

    setBusy(true);
    try {
      let invOk = 0;
      let salesOk = 0;
      let invSkipped = invToImportRaw.length - invToImport.length;
      let salesSkipped = salesToImportRaw.length - salesToImport.length;
      const errs = [];

      setStatus(`Importing inventory (${invToImport.length})...`);
      for (const item of invToImport) {
        try {
          const { __base44_id, ...payload } = item;
          const created = await postWithUser("/api/inventory", userId, payload);
          invOk++;
          if (__base44_id && created?.id) invIdMap.set(__base44_id, created.id);
        } catch (e) {
          errs.push(`Inventory "${item.item_name}": ${e.message}`);
        }
      }

      setStatus(`Importing sales (${salesToImport.length})...`);
      for (const sale of salesToImport) {
        try {
          const { __base44_id, __base44_inventory_id, ...payload } = sale;

          // If the sale references a Base44 inventory id, link it to the new UUID if we can.
          if (__base44_inventory_id && invIdMap.has(__base44_inventory_id)) {
            payload.inventory_id = invIdMap.get(__base44_inventory_id);
          }

          // If still not a UUID, drop it to avoid Supabase 400.
          if (payload.inventory_id && !isUuidLike(payload.inventory_id)) {
            payload.inventory_id = null;
          }

          await postWithUser("/api/sales", userId, payload);
          salesOk++;
        } catch (e) {
          errs.push(`Sale "${sale.item_name || "Unknown"}": ${e.message}`);
        }
      }

      setErrors(errs);
      setStatus(
        `Done. Imported inventory=${invOk}/${invToImport.length} (skipped ${invSkipped}), sales=${salesOk}/${salesToImport.length} (skipped ${salesSkipped}). Refresh /dashboard.`
      );

      // Bust React Query caches so users immediately see data without hard reloads.
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryItems"] });
    } finally {
      setBusy(false);
    }
  };

  const runBackfill = async () => {
    setBackfillBusy(true);
    setBackfillStatus(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(session?.user?.id ? { 'x-user-id': session.user.id } : {}),
      };
      const resp = await fetch('/api/admin/backfill-sales-fields', { method: 'POST', headers });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
      setBackfillStatus(`Done. Scanned ${json.scanned}, updated ${json.updated}, skipped ${json.skipped}.`);
      queryClient.invalidateQueries({ queryKey: ["sales"] });
    } catch (e) {
      setBackfillStatus(`Backfill failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setBackfillBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-background min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-card border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <h1 className="text-xl font-semibold text-foreground">Migrate Data (Base44 → Supabase)</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Paste the JSON from your Base44 export page (inventory + sales). This will import into your currently signed-in Supabase user.
          </p>

          <div className="mt-4">
            <Alert>
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium">Migration-only tool</div>
                  <div className="text-sm">
                    This page is meant for one-time data migration and can create many rows quickly. It should not be used as part of normal day-to-day workflow.
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                    />
                    I understand and want to proceed.
                  </label>
                </div>
              </AlertDescription>
            </Alert>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-muted-foreground">Inventory rows</div>
              <div className="text-lg font-semibold">{preview.inventoryCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-muted-foreground">Sales rows</div>
              <div className="text-lg font-semibold">{preview.salesCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-muted-foreground">Profit sum (preview)</div>
              <div className="text-lg font-semibold">${preview.profitSum.toFixed(2)}</div>
            </div>
          </div>

          {status && (
            <div className="mt-4">
              <Alert>
                <AlertDescription>{status}</AlertDescription>
              </Alert>
            </div>
          )}

          {(invParsed.ok === false || salesParsed.ok === false) && (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertDescription>
                  {!invParsed.ok ? `Inventory JSON error: ${invParsed.error}` : null}
                  {!salesParsed.ok ? ` Sales JSON error: ${salesParsed.error}` : null}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {fullParsed.ok === false && (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertDescription>{`Full export JSON error: ${fullParsed.error}`}</AlertDescription>
              </Alert>
            </div>
          )}

          <div className="mt-4 grid grid-cols-1 gap-3">
            <div>
              <div className="text-sm font-medium text-foreground mb-1">Full Base44 export JSON (recommended)</div>
              <Textarea
                value={fullExportJson}
                onChange={(e) => setFullExportJson(e.target.value)}
                placeholder='Paste the full Base44 JSON (supports { "inventory_items": [...], "sales": [...] })'
                className="min-h-[180px] font-mono text-xs"
              />
              <div className="text-xs text-gray-500 mt-1">
                If this is filled, it will be used instead of the two boxes below.
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-foreground mb-1">Inventory JSON</div>
              <Textarea
                value={inventoryJson}
                onChange={(e) => setInventoryJson(e.target.value)}
                placeholder='Paste inventory JSON (array or { "inventory": [...] })'
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-foreground mb-1">Sales JSON</div>
              <Textarea
                value={salesJson}
                onChange={(e) => setSalesJson(e.target.value)}
                placeholder='Paste sales JSON (array or { "sales": [...] })'
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <Button onClick={runImport} disabled={busy}>
              {busy ? "Importing..." : "Import into Supabase"}
            </Button>
            <Button
              variant="outline"
              onClick={runBackfill}
              disabled={busy || backfillBusy}
            >
              {backfillBusy ? "Backfilling..." : "Backfill missing Sales fields (admin)"}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setFullExportJson("");
                setInventoryJson("");
                setSalesJson("");
                setStatus(null);
                setErrors([]);
                setBackfillStatus(null);
              }}
              disabled={busy}
            >
              Clear
            </Button>
          </div>

          {backfillStatus && (
            <div className="mt-3">
              <Alert>
                <AlertDescription>{backfillStatus}</AlertDescription>
              </Alert>
            </div>
          )}

          {errors.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-foreground mb-2">Errors (first 25)</div>
              <pre className="text-xs whitespace-pre-wrap bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg p-3 max-h-[240px] overflow-auto">
                {errors.slice(0, 25).join("\n")}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


