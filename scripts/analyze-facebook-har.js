/**
 * Analyze a Chrome DevTools HAR export to extract likely Facebook Marketplace listing requests.
 *
 * Usage:
 *   node scripts/analyze-facebook-har.js path/to/export.har
 *
 * What it does:
 * - Finds Facebook GraphQL POSTs (facebook.com/api/graphql) and ranks likely "create listing" mutations
 * - Finds Facebook upload endpoints (rupload.facebook.com / upload.facebook.com)
 * - Prints the highest-signal candidates with doc_id, friendly_name, and a short variables preview
 *
 * Notes:
 * - This is meant to analyze HARs you are authorized to capture (e.g., your own Vendoo session).
 * - It does not bypass auth; it only helps us mirror the same request shapes in our extension.
 */

const fs = require("fs");
const path = require("path");

function safeDecode(s) {
  try {
    return decodeURIComponent(s);
  } catch {
    return String(s || "");
  }
}

function parseFormUrlEncoded(text) {
  const out = {};
  const s = String(text || "");
  for (const part of s.split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    out[safeDecode(k)] = safeDecode(v);
  }
  return out;
}

function getHeader(headers, name) {
  const n = String(name || "").toLowerCase();
  const h = Array.isArray(headers) ? headers : [];
  const hit = h.find((x) => String(x?.name || "").toLowerCase() === n);
  return hit?.value ?? null;
}

function scoreGraphql(entry) {
  const req = entry?.request || {};
  const postData = req?.postData || {};
  const mime = String(postData?.mimeType || "");
  const raw = String(postData?.text || "");

  let bodyText = raw;
  if (mime.includes("application/x-www-form-urlencoded")) {
    // already text
  } else if (mime.includes("multipart/form-data")) {
    // HAR sometimes stores multipart; keep raw for heuristics
  }

  const form = parseFormUrlEncoded(bodyText);
  const friendly = String(form.fb_api_req_friendly_name || "");
  const docId = String(form.doc_id || "");
  const varsRaw = String(form.variables || "");

  let vars = null;
  try {
    vars = varsRaw ? JSON.parse(varsRaw) : null;
  } catch {
    vars = null;
  }

  const friendlyLower = friendly.toLowerCase();
  const rawLower = bodyText.toLowerCase();

  const hasDoc = /^\d{5,}$/.test(docId);
  const hasVars = !!varsRaw;
  const isMutation = friendlyLower.includes("mutation") || friendlyLower.includes("create");
  const isQuery = friendlyLower.includes("query");
  const mentionsMarketplace = friendlyLower.includes("marketplace") || rawLower.includes("marketplace");
  const mentionsCreate = friendlyLower.includes("create") || rawLower.includes("create");

  // Strong boost if we find the known template name.
  const known = friendly === "useCometMarketplaceListingCreateMutation";

  const score =
    (known ? 100 : 0) +
    (hasDoc ? 20 : 0) +
    (hasVars ? 10 : 0) +
    (mentionsMarketplace ? 10 : 0) +
    (mentionsCreate ? 8 : 0) +
    (isMutation ? 8 : 0) -
    (isQuery ? 10 : 0);

  return { score, friendly, docId, vars };
}

function scoreUpload(entry) {
  const req = entry?.request || {};
  const url = String(req?.url || "");
  const headers = req?.headers || [];
  const ct = String(getHeader(headers, "content-type") || "");
  const post = String(req?.postData?.text || "");
  let score = 0;
  if (/rupload\.facebook\.com/i.test(url)) score += 10;
  if (/upload\.facebook\.com/i.test(url)) score += 6;
  if (ct.toLowerCase().includes("multipart/form-data")) score += 10;
  if (/filename=/i.test(post) || /name="file"/i.test(post)) score += 10;
  if (/marketplace|commerce/i.test(url.toLowerCase())) score += 5;
  return { score, url, ct };
}

function shortJson(obj, max = 900) {
  let s = "";
  try {
    s = JSON.stringify(obj);
  } catch {
    s = String(obj || "");
  }
  if (s.length > max) return s.slice(0, max) + "…";
  return s;
}

function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage: node scripts/analyze-facebook-har.js path/to/export.har");
    process.exit(1);
  }
  const abs = path.resolve(process.cwd(), file);
  const text = fs.readFileSync(abs, "utf8");
  const har = JSON.parse(text);
  const entries = har?.log?.entries || [];

  const graphql = [];
  const uploads = [];

  for (const e of entries) {
    const url = String(e?.request?.url || "");
    const method = String(e?.request?.method || "").toUpperCase();
    if (method === "POST" && /facebook\.com\/api\/graphql/i.test(url)) {
      graphql.push({ entry: e, ...scoreGraphql(e) });
    }
    if (method === "POST" && /(rupload|upload)\.facebook\.com/i.test(url)) {
      uploads.push({ entry: e, ...scoreUpload(e) });
    }
  }

  graphql.sort((a, b) => b.score - a.score);
  uploads.sort((a, b) => b.score - a.score);

  console.log("\n=== Top GraphQL candidates ===");
  for (const g of graphql.slice(0, 8)) {
    console.log(
      `- score=${g.score} friendly=${JSON.stringify(g.friendly)} doc_id=${JSON.stringify(g.docId)} url=${g.entry?.request?.url}`
    );
    if (g.vars) console.log(`  vars=${shortJson(g.vars, 700)}`);
  }

  console.log("\n=== Top upload candidates ===");
  for (const u of uploads.slice(0, 5)) {
    console.log(`- score=${u.score} ct=${JSON.stringify(u.ct)} url=${u.url}`);
  }

  console.log("\nTip: If the top GraphQL candidate is a Query (not a Mutation), re-capture HAR while clicking Publish/Create on Marketplace.");
}

main();

