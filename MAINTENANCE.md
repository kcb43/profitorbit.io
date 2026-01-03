# Preventative Maintenance (Profit Orbit)

This doc is the “don’t accidentally break prod” checklist for future changes.

## Data + Auth Architecture (high level)
- **Frontend auth**: Supabase Auth (PKCE enabled in `src/api/supabaseClient.js`).
- **API**: Vercel Serverless Functions under `api/*`.
  - Requests should include `Authorization: Bearer <supabase access token>` whenever possible.
  - Several endpoints still accept `x-user-id` for compatibility/debug, but **Bearer auth is preferred**.
- **DB**: Supabase Postgres with RLS enabled.

## Before deploying (fast checklist)
- **Dashboard loads data immediately**: hard refresh `/dashboard` and confirm `/api/sales` + `/api/inventory` calls show in Network.
- **No SPA asset rewrite issues**: confirm JS chunks load as `application/javascript` (see `vercel.json` routes/handles).
- **Crosslist still shows inventory**: `/Crosslist` should not be blank and should not throw “missing column” errors.
- **Uploads still work**: test an inventory photo upload (server uses `api/upload.js` with `busboy`).
- **eBay connect**: `/api/ebay/auth` should redirect to eBay, and callback should land on `/oauth/ebay`.

## React Query rules (avoid “nothing loads until you click another page”)
- **Never share query keys across pages** if `queryFn` differs.
  - Good: `["inventoryItems", "dashboard"]`, `["inventoryItems", "inventory"]`, `["inventoryItems", "crosslist"]`
  - Bad: using `["inventoryItems"]` everywhere.
- Prefer **`placeholderData`** over `initialData` for list pages to avoid cache poisoning.

## Supabase migrations (RLS + functions)
- Add new SQL in `supabase/migrations/*`.
- If Supabase warns about RLS performance:
  - Replace `auth.uid()` with `(select auth.uid())` in policies.
- If Supabase warns about function `search_path`:
  - Recreate with `SET search_path = pg_catalog, public` (or `public, pg_temp` where appropriate).

## Extension + Crosslisting notes
- The extension is MV3; background worker storage writes should be awaited.
- Facebook listing uses in-page/iframe strategies; avoid opening new tabs.
- Mercari listing is extension-based; web app should generate “View Listing” URLs as `/us/item/<id>/`.

## Admin-only pages
- `/MigrateData` should stay **admin-only**.
  - Admin IDs are configured with `VITE_ADMIN_USER_IDS` (comma-separated).
  - If not set, code falls back to the owner admin id.


