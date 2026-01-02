import React, { useMemo, useState } from "react";
import { supabase } from "@/api/supabaseClient";
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

function mapInventoryItem(item) {
  return {
    item_name: item.item_name || item.itemName || item.title || item.name || "Unnamed Item",
    purchase_price: toNumber(item.purchase_price ?? item.purchasePrice ?? item.cost ?? 0),
    purchase_date: toIsoDateOrNull(item.purchase_date || item.purchaseDate || item.date_purchased),
    source: item.source || item.store || null,
    status: item.status || "available",
    category: item.category || null,
    notes: item.notes || null,
    image_url: item.image_url || item.imageUrl || item.image || null,
    images: Array.isArray(item.images)
      ? item.images
      : (item.image_url || item.imageUrl ? [item.image_url || item.imageUrl] : []),
    quantity: toNumber(item.quantity ?? 1, 1) || 1,
    quantity_sold: toNumber(item.quantity_sold ?? item.quantitySold ?? 0, 0),
    return_deadline: toIsoDateOrNull(item.return_deadline || item.returnDeadline),
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

  return {
    inventory_id: sale.inventory_id || sale.inventoryId || null,
    item_name: sale.item_name || sale.itemName || sale.title || null,
    selling_price: toNumber(selling_price),
    sale_date: toIsoDateOrNull(sale.sale_date || sale.saleDate || sale.date_sold),
    platform: sale.platform || sale.marketplace || null,
    shipping_cost: toNumber(shipping_cost),
    platform_fees: toNumber(platform_fees),
    vat_fees: toNumber(vat_fees),
    other_costs: toNumber(other_costs),
    profit: Number.isFinite(Number(sale.profit)) ? toNumber(sale.profit) : computedProfit,
    notes: sale.notes || null,
    image_url: sale.image_url || sale.imageUrl || null,
    purchase_price: toNumber(purchase_price),
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
  const [fullExportJson, setFullExportJson] = useState("");
  const [inventoryJson, setInventoryJson] = useState("");
  const [salesJson, setSalesJson] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [errors, setErrors] = useState([]);

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
    const invToImport = invRows.map(mapInventoryItem);
    const salesToImport = salesRows.map(mapSale);

    if (invToImport.length === 0 && salesToImport.length === 0) {
      setStatus("No rows found. Paste your full Base44 export JSON (recommended) or paste inventory + sales JSON.");
      return;
    }

    setBusy(true);
    try {
      let invOk = 0;
      let salesOk = 0;
      const errs = [];

      setStatus(`Importing inventory (${invToImport.length})...`);
      for (const item of invToImport) {
        try {
          await postWithUser("/api/inventory", userId, item);
          invOk++;
        } catch (e) {
          errs.push(`Inventory "${item.item_name}": ${e.message}`);
        }
      }

      setStatus(`Importing sales (${salesToImport.length})...`);
      for (const sale of salesToImport) {
        try {
          await postWithUser("/api/sales", userId, sale);
          salesOk++;
        } catch (e) {
          errs.push(`Sale "${sale.item_name || "Unknown"}": ${e.message}`);
        }
      }

      setErrors(errs);
      setStatus(`Done. Imported inventory=${invOk}/${invToImport.length}, sales=${salesOk}/${salesToImport.length}. Refresh /dashboard.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 md:p-8 bg-gray-50 dark:bg-gray-900/95 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-5">
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Migrate Data (Base44 → Supabase)</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
            Paste the JSON from your Base44 export page (inventory + sales). This will import into your currently signed-in Supabase user.
          </p>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-gray-500">Inventory rows</div>
              <div className="text-lg font-semibold">{preview.inventoryCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-gray-500">Sales rows</div>
              <div className="text-lg font-semibold">{preview.salesCount}</div>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
              <div className="text-gray-500">Profit sum (preview)</div>
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
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Full Base44 export JSON (recommended)</div>
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
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Inventory JSON</div>
              <Textarea
                value={inventoryJson}
                onChange={(e) => setInventoryJson(e.target.value)}
                placeholder='Paste inventory JSON (array or { "inventory": [...] })'
                className="min-h-[180px] font-mono text-xs"
              />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Sales JSON</div>
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
              onClick={() => {
                setFullExportJson("");
                setInventoryJson("");
                setSalesJson("");
                setStatus(null);
                setErrors([]);
              }}
              disabled={busy}
            >
              Clear
            </Button>
          </div>

          {errors.length > 0 && (
            <div className="mt-4">
              <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Errors (first 25)</div>
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


