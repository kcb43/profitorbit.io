# ProfitOrbit — Complete Codebase Reference

This document is the canonical reference for the ProfitOrbit codebase. It covers every major page, feature, data model, API route, component, and external integration in enough depth that an AI agent can understand the system and make changes without needing additional exploration.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Database Schema (Supabase)](#3-database-schema-supabase)
4. [Authentication & API Layer](#4-authentication--api-layer)
5. [Constants & Data Dictionaries](#5-constants--data-dictionaries)
6. [Core Pages — Detailed](#6-core-pages--detailed)
   - [Dashboard](#61-dashboard)
   - [Add Inventory Item](#62-add-inventory-item)
   - [Inventory](#63-inventory)
   - [Add Sale](#64-add-sale)
   - [Sales History](#65-sales-history)
   - [Crosslist Composer](#66-crosslist-composer)
   - [Import](#67-import)
   - [Deals](#68-deals)
   - [Shipping](#69-shipping)
   - [Analytics Hub](#610-analytics-hub)
   - [Reports / Profit Calendar / Gallery / Platform Performance](#611-reports--profit-calendar--gallery--platform-performance)
   - [Marketplace Connect](#612-marketplace-connect)
   - [Settings & Sub-pages](#613-settings--sub-pages)
   - [Other Pages](#614-other-pages)
7. [Key Components](#7-key-components)
   - [ImageEditor](#71-imageeditor)
   - [DescriptionGenerator](#72-descriptiongenerator)
   - [EnhancedProductSearchDialog](#73-enhancedproductsearchdialog)
   - [EbaySoldDialog](#74-ebaysolddialog)
   - [EbaySearchDialog](#75-ebaysearchdialog)
   - [InventoryItemViewDialog](#76-inventoryitemviewdialog)
   - [FacebookListingDialog](#77-facebooklistingdialog)
   - [SoldLookupDialog](#78-soldlookupdialog)
   - [ReceiptScannerDialog](#79-receiptscannerdialog)
8. [API Routes (Vercel Serverless)](#8-api-routes-vercel-serverless)
9. [External Integrations](#9-external-integrations)
10. [Browser Extension Integration](#10-browser-extension-integration)
11. [Utility Modules & Hooks](#11-utility-modules--hooks)

---

## 1. Project Overview

**ProfitOrbit** (codenamed "Orben" internally) is a full-stack reseller business management tool. It lets resellers:

- Track inventory they purchase (with cost, source, photos, return deadlines)
- Record sales and calculate profit per item
- Crosslist items to multiple marketplaces (eBay, Mercari, Facebook, Etsy) from one form
- Import existing listings from those marketplaces into their inventory
- Edit and enhance product photos
- Generate AI-powered marketplace descriptions
- View dashboards, analytics, and reports
- Browse curated resale deals (separate Orben backend)
- Track packages / buy shipping labels via Shippo

The app is deployed on **Vercel** at `profitorbit.io`. The frontend is a React SPA; the backend is a mix of Vercel serverless functions (in `/api/`) and a Supabase PostgreSQL database.

---

## 2. Tech Stack & Architecture

### Frontend
| Layer | Library |
|-------|---------|
| Framework | React 18 |
| Routing | react-router-dom v7 |
| State / Fetching | TanStack React Query v5 |
| UI Components | shadcn/ui (Radix UI primitives + Tailwind) |
| Styling | TailwindCSS v3 |
| Charts | Recharts |
| Drag & Drop | react-sortablejs + sortablejs |
| Image Editor | react-filerobot-image-editor (FIE) + Konva |
| Image Cropping | react-easy-crop |
| Image Compression | browser-image-compression |
| Animation | framer-motion |
| Markdown | react-markdown + remark-gfm |
| Date Utils | date-fns |
| Toast Notifications | sonner + shadcn `useToast` |
| Forms | react-hook-form + zod |
| Rich Text | custom `RichTextarea` component |

### Backend / API
| Layer | Technology |
|-------|-----------|
| Serverless Functions | Vercel Functions (`/api/**/*.js`) |
| Database | Supabase (PostgreSQL) with Row-Level Security |
| Auth | Supabase Auth (JWT tokens) |
| AI | OpenAI GPT-4o-mini or Anthropic Claude (configurable) |
| Image Storage | Supabase Storage buckets |
| eBay API | eBay Browse API + Trading API (OAuth 2.0) |
| Shipping | Shippo API |
| Facebook | Facebook Graph API + developer OAuth flow |
| Mercari | Session-based puppeteer scraping |
| Deals Backend | Separate `orben-api.fly.dev` service |
| Product Search | SerpAPI (eBay sold listings) + custom scrapers |

### Project Structure
```
/
├── src/
│   ├── pages/           ← Route-level page components
│   ├── components/      ← Shared UI components
│   │   ├── ui/          ← shadcn/Radix primitives
│   │   ├── dashboard/   ← Dashboard-specific widgets
│   │   ├── reports/     ← Reports-specific components
│   │   ├── image-editor/← ImageEditor sub-components
│   │   ├── mobile/      ← Mobile-specific components
│   │   ├── training/    ← Training center components
│   │   └── settings/    ← Settings tile components
│   ├── api/             ← Client-side API wrappers
│   ├── constants/       ← Static data (marketplaces, categories)
│   ├── hooks/           ← Custom React hooks
│   ├── services/        ← CrosslistingEngine, salesSync
│   ├── utils/           ← Helper utilities
│   ├── lib/             ← cn(), misc
│   ├── data/            ← Static datasets (Facebook categories)
│   └── config/          ← Feature flags
├── api/                 ← Vercel serverless functions
│   ├── inventory/
│   ├── sales/
│   ├── ebay/
│   ├── facebook/
│   ├── mercari/
│   ├── ai/
│   ├── shipping/
│   ├── pulse/           ← Deals/deal scanning
│   ├── product-search/
│   ├── reports/
│   └── ...
├── supabase/migrations/ ← SQL migration files
└── public/
```

---

## 3. Database Schema (Supabase)

All tables are owned by `auth.users.id` (RLS enforced). The user's JWT is required for all access — both direct Supabase calls and API route calls.

### `inventory_items`
The primary inventory table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | uuid_generate_v4() |
| `user_id` | UUID FK → auth.users | RLS |
| `item_name` | TEXT | Required |
| `purchase_price` | NUMERIC(10,2) | NULL allowed (nullable migration 20260201) |
| `purchase_date` | DATE | |
| `source` | TEXT | Where you bought the item (e.g. "Amazon", "Thrift Store") |
| `status` | item_status ENUM | `available` \| `listed` \| `sold` |
| `category` | TEXT | Freeform or from predefined list |
| `notes` | TEXT | Internal notes + embedded tags (see base44Tags format) |
| `description` | TEXT | Listing description (added in migration 013) |
| `image_url` | TEXT | Legacy single image (backwards compat) |
| `images` | TEXT[] | Array of image URLs (multi-photo support) |
| `photos` | JSONB | Array of `{id, imageUrl, isMain, fileName}` objects (for ImageEditor history keying) |
| `quantity` | INTEGER DEFAULT 1 | Total units |
| `quantity_sold` | INTEGER DEFAULT 0 | Units sold |
| `return_deadline` | DATE | Auto-calculated based on source (Amazon=30d, Walmart=90d, Best Buy=15d) |
| `return_deadline_dismissed` | BOOLEAN | Dashboard alert dismissed flag |
| `brand` | TEXT | Added migration 014 |
| `condition` | TEXT | Added migration 022 |
| `size` | TEXT | Added migration 017 |
| `listing_price` | NUMERIC | Added migration 20260201 |
| `sku` | TEXT | Added migration 018 |
| `zip_code` | TEXT | Added migration 019 |
| `color` | TEXT | Added migration 015 |
| `weight` | NUMERIC | Package weight (migration 016) |
| `package_type` | TEXT | Package dimension type (migration 016) |
| `dimensions` | JSONB | Length/width/height (migration 016) |
| `ebay_item_id` | TEXT | Added migration 005 |
| `mercari_item_id` | TEXT | Added migration 20260202 |
| `facebook_item_id` | TEXT | Added migration 20260202 |
| `listing_keywords` | TEXT[] | AI-generated search tags (migration 20260221) |
| `internal_tags` | TEXT[] | Internal organizational tags (migration 20260221) |
| `is_favorite` | BOOLEAN DEFAULT false | Favorites filter (migration 20260221) |
| `mercari_likes` | INTEGER | Synced from Mercari (migration 20260201) |
| `mercari_views` | INTEGER | Synced from Mercari (migration 20260201) |
| `ebay_offer_id` | TEXT | Active eBay offer (migration 021) |
| `groups` | TEXT[] | Group membership (migration 20260212) |
| `deleted_at` | TIMESTAMPTZ | Soft-delete flag |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

### `sales`
Sale records. Each sale may be linked to an inventory item.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK → auth.users | |
| `inventory_id` | UUID FK → inventory_items | ON DELETE SET NULL |
| `item_name` | TEXT | |
| `brand` | TEXT | |
| `platform` | TEXT | Stored as slug e.g. `ebay`, `facebook_marketplace`, `mercari` |
| `purchase_price` | NUMERIC(10,2) | Cost basis |
| `selling_price` | NUMERIC(10,2) | aka `sale_price` (both exist for compat) |
| `sale_price` | NUMERIC | Legacy compat |
| `sale_date` | DATE | |
| `purchase_date` | DATE | |
| `source` | TEXT | Where purchased |
| `category` | TEXT | |
| `shipping_cost` | NUMERIC(10,2) DEFAULT 0 | |
| `platform_fees` | NUMERIC(10,2) DEFAULT 0 | For eBay: sales tax collected from buyer |
| `vat_fees` | NUMERIC(10,2) DEFAULT 0 | For eBay: VAT collected from buyer |
| `other_costs` | NUMERIC(10,2) DEFAULT 0 | Transaction fees + custom fees combined |
| `profit` | NUMERIC(10,2) | Calculated: selling_price - (purchase_price + shipping_cost + platform_fees + other_costs + vat_fees) |
| `notes` | TEXT | User notes; may contain embedded custom fee JSON (prefixed `[FEES:...]`) |
| `image_url` | TEXT | |
| `quantity_sold` | INTEGER DEFAULT 1 | |
| `return_deadline` | DATE | |
| `facebook_sale_type` | TEXT | `local` or `online` (for Facebook Marketplace sales) |
| `tracking_number` | TEXT | From eBay import |
| `shipping_carrier` | TEXT | From eBay import |
| `delivery_date` | TIMESTAMPTZ | From eBay import |
| `shipped_date` | TIMESTAMPTZ | From eBay import |
| `item_condition` | TEXT | From eBay import |
| `funds_status` | TEXT | eBay: funds status |
| `buyer_address` | JSONB | From eBay import |
| `payment_method` | TEXT | From eBay import |
| `payment_status` | TEXT | From eBay import |
| `payment_date` | TIMESTAMPTZ | From eBay import |
| `item_location` | TEXT | From eBay import |
| `buyer_notes` | TEXT | From eBay import |
| `ebay_order_id` | TEXT | From eBay import |
| `ebay_transaction_id` | TEXT | From eBay import |
| `ebay_buyer_username` | TEXT | From eBay import |
| `ebay_offer_id` | TEXT | eBay offer associated with this sale |
| `deleted_at` | TIMESTAMPTZ | Soft-delete |

### `image_editor_templates`
Saved photo editor presets per user.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `name` | TEXT | Template display name |
| `settings` | JSONB | FIE design state (filters, finetunes, crop, etc.) |
| `deleted_at` | TIMESTAMPTZ | |

### `crosslistings`
Saved crosslisting drafts/state. Used by CrosslistComposer.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `title` | TEXT | |
| `description` | TEXT | |
| `price` | TEXT | |
| `images` | TEXT[] | |
| `category` | TEXT | |
| `condition` | TEXT | |

### `user_fulfillment_profiles`
Per-user pickup/shipping preferences for AI description generation.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID UNIQUE FK | |
| `pickup_enabled` | BOOLEAN DEFAULT false | |
| `pickup_location_line` | TEXT | e.g. "Pickup in Easton, MA 02356" |
| `pickup_notes` | TEXT | e.g. "Meet at police station" |
| `shipping_enabled` | BOOLEAN DEFAULT true | |
| `shipping_notes` | TEXT | e.g. "Ships next business day" |
| `platform_notes` | JSONB | Per-platform override strings keyed by platform slug; special key `ebay_emojis` (boolean) controls emoji use in eBay descriptions |

### `ebay_tokens`
eBay OAuth tokens per user (migration 020).

### `mercari_sessions`
Mercari session cookies per user for puppeteer-based listing (migration 20260221).

### Other Tables
- `user_profiles` — display name, avatar, etc.
- `user_preferences` — notification preferences, appearance settings (migration 20260220)
- `deal_sources`, `deal_snapshots`, `deal_feed` — Deals system (migration 20260213)
- `deal_cache` — Cached deal results (migration 20260212)
- `notifications` — User notifications (migration 20260215)
- `rewards_events`, `rewards_catalog`, `rewards_state` — Rewards/gamification (migration 20260215)
- `report_runs` — Stored export report runs (migration 20260220)
- `news_items`, `news_seen` — In-app news (migration 20260220)
- `listing_jobs` — Background listing job tracker
- `search_snapshots` — Product search result snapshots
- `shipping_shipments`, `shipping_labels` — Shippo data (migration 20260220)
- `training_progress`, `training_feedback` — Training center (migration 20260220)

---

## 4. Authentication & API Layer

### Auth Flow
- **Provider**: Supabase Auth (email/password + Google OAuth)
- **Token**: JWT stored by Supabase client, injected into all requests
- Every API route reads `Authorization: Bearer <jwt>` to verify user identity
- `AuthGuard` component wraps all authenticated routes

### Client-Side API Wrappers (`src/api/`)

| File | Purpose |
|------|---------|
| `base44Client.js` | Re-exports `newApiClient` as `apiClient` (legacy compat) |
| `newApiClient.js` | Core client — calls `/api/inventory`, `/api/sales`, etc. via fetch with auth headers |
| `inventoryApi.js` | Thin wrapper: `inventoryApi.get/list/create/update/delete` |
| `salesApi.js` | Thin wrapper: `salesApi.get/list/create/update/delete` |
| `uploadApi.js` | `uploadApi.uploadFile({file})` → uploads to Supabase Storage, returns `{file_url}` |
| `supabaseClient.js` | `supabase` instance (for direct real-time/auth queries) |
| `ebayClient.js` | eBay Browse API helper |
| `facebookClient.js` | Facebook Graph API helper + `isConnected()` |
| `shippingApi.js` | Shippo API wrappers (tracking, shipments, labels, rates, addresses, parcels) |
| `fulfillmentApi.js` | `getFulfillmentProfile()` / `saveFulfillmentProfile()` |
| `receiptScanner.js` | `scanReceipt(file)` → calls `/api/receipt/scan` |
| `listingApiClient.js` | `listingJobsApi` for CrosslistComposer job tracking |

### API Routes Pattern
All serverless functions follow this pattern:
```js
export default async function handler(req, res) {
  // 1. CORS
  // 2. Auth check (read JWT from Authorization header)
  // 3. Route by method (GET/POST/PUT/DELETE)
  // 4. Supabase query with user_id filter
  // 5. Return JSON
}
```

---

## 5. Constants & Data Dictionaries

### Categories (shared across all pages)
Defined inline in AddInventoryItem, AddSale, SalesHistory, CrosslistComposer, Inventory. Always the same list:

```
Antiques, Books/Movies/Music, Clothing & Apparel, Collectibles, Electronics,
Gym/Workout, Health & Beauty, Home & Garden, Jewelry & Watches, Kitchen, Makeup,
Mic/Audio Equipment, Motorcycle, Motorcycle Accessories, Pets, Pool Equipment,
Shoes/Sneakers, Sporting Goods, Stereos & Speakers, Tools, Toys & Hobbies, Yoga
```
Plus "Other..." which lets users type a custom category (stored as freeform text).

### Sources (`src/constants/marketplaces.js` → `SOURCE_GROUPS` / `ALL_SOURCES`)
**Sources** = where you *buy* / source items. Grouped into:
- **Online Retailers**: Amazon, Walmart, Target, Best Buy, Woot, Costco, Sam's Club, Home Depot, Lowe's, Kohl's, Macy's, Nordstrom, Nordstrom Rack, TJ Maxx, Marshalls, Ross, Burlington, Dollar General, Dollar Tree, Five Below, GameStop, Petco, PetSmart, Chewy, IKEA, Walgreens, CVS, Staples, Dick's Sporting, Academy Sports
- **Liquidation & Wholesale**: B-Stock, Liquidation.com, BULQ, ShopGoodwill
- **Online Marketplaces**: eBay, Mercari, Poshmark, Depop, Grailed, ThredUp, The RealReal, Vestiaire Collective, Vinted, StockX, GOAT, WhatNot, Etsy, Bonanza, OfferUp, Facebook Marketplace, Craigslist, Back Market, Decluttr, HiBid, 1stDibs, Ruby Lane, Chairish, Kidizen, Swap.com, Goodwill
- **In-Person & Physical**: Thrift Store 🏪, Garage Sale 🏡, Estate Sale 🏠, Flea Market 🛍️, Auction 🔨, Local Pickup 📍

Each entry has: `{ name, domain, color, emoji? }`. `domain` is used to fetch favicon logos from Google S2: `https://www.google.com/s2/favicons?domain={domain}&sz=64`.

Users can also add **custom sources** (stored in `localStorage` under key `"orben_custom_sources"`).

### Platforms (`src/constants/marketplaces.js` → `PLATFORM_GROUPS` / `ALL_PLATFORMS`)
**Platforms** = where you *sell* items. Stored as slug values in the `sales.platform` column:

- **Popular**: `mercari`, `ebay`, `facebook_marketplace`, `poshmark`, `depop`, `grailed`, `whatnot`, `amazon`, `etsy`, `stockx`, `goat`
- **Fashion & Luxury**: `therealreal`, `vestiaire`, `thredup`, `vinted`, `kidizen`
- **Specialty & Niche**: `backmarket`, `decluttr`, `hibid`, `1stdibs`, `rubylane`, `chairish`, `bonanza`, `swap`
- **Social Commerce**: `tiktok_shop`, `instagram`
- **Local & Other**: `offer_up`, `craigslist`, `walmart_marketplace`, `goodwill`, `local_sale`

Users can add **custom platforms** (stored in localStorage under `"orben_custom_platforms"`).

**Important distinction**: `source` and `platform` are separate fields. You might source from "Amazon" and sell on "eBay". Both dropdowns share similar UI/search patterns but pull from different constant lists.

### Item Statuses
Stored as enum in Postgres (`item_status`):
- `available` → displayed as "In Stock" (blue badge)
- `listed` → "Listed" (green badge)
- `sold` → "Sold" (gray badge)

### Conditions
```
New, New with tags, New without tags, New with defects,
Used - Like new, Used - Excellent, Used - Good, Used - Fair,
For parts or not working
```

### Return Window Auto-Calculation
When source is set in AddInventoryItem:
- **Amazon**: 30 days
- **Walmart**: 90 days
- **Best Buy**: 15 days

---

## 6. Core Pages — Detailed

### 6.1 Dashboard
**File**: `src/pages/Dashboard.jsx`

The main landing page after login. Displays:

**KPI Cards** (top row, hover-to-expand):
- Total Profit (all-time, from `/api/sales/summary`)
- Total Sales (item count)
- Items in Stock (inventory remaining, filtered to `available`+`listed`)
- Platform Mix (number of active platforms)

**Alerts Section**:
- Return Deadlines alert (items whose `return_deadline` is within 10 days) → links to `/Inventory?filter=returnDeadline`
- Stale inventory alert (items with `available` status purchased 10+ days ago with no sale) → links to `/Inventory?filter=stale`

**Charts & Tables**:
- `ProfitTrendCard`: Recharts line/bar chart of profit over time (weekly/monthly/yearly/custom range)
- `PlatformRevenueTableCard`: Shows revenue by platform from `/api/sales/platform-summary`
- `QuickActions`: Action tiles (Add Inventory, Add Sale, Crosslist, Import, etc.)
- `RecentSales`: Carousel of 15 most recent sales

**Welcome Row**: `WelcomeInsightsRow` shows greeting + AI-powered insights.

**Data Sources**:
- `/api/sales/summary` → `{ totalProfit, totalRevenue, totalSales }`
- `/api/sales?sort=-sale_date&limit=5000` → for chart data
- `/api/sales/platform-summary` → for platform table
- `/api/inventory?sort=-purchase_date&limit=5000&fields=...` → for stock count + alerts

---

### 6.2 Add Inventory Item
**File**: `src/pages/AddInventoryItem.jsx`

Used for creating new inventory records, editing existing ones, and copying existing ones.

**URL Parameters**:
- `?id=<uuid>` → Edit mode
- `?copyId=<uuid>` → Copy mode (prefills from existing item, clears notes/status)
- `?itemName=...&purchasePrice=...&source=...&category=...&imageUrl=...&notes=...` → Pre-fill from URL (used by Import page)

**Key Form Fields**:
- `item_name` (required)
- `purchase_price` (required unless source is Facebook or Mercari — those can have blank cost)
- `purchase_date` (required)
- `return_deadline` (auto-calculated based on source, or manually set)
- `quantity`
- `source` (dropdown with search + custom source support)
- `status` (In Stock / Listed / Sold)
- `category` (dropdown + custom)
- `brand` (BrandCombobox with AI suggestions)
- `condition` (dropdown)
- `size` (free text)
- `description` (carries into Crosslist; HTML-cleaned on paste)
- `notes` (internal only; HTML-cleaned on paste)

**Photo System**:
- Up to 12 photos (constant `MAX_PHOTOS`)
- Stored as `photos[]` JSONB array (`{id, imageUrl, isMain, fileName}`) AND `images` TEXT[] array
- First photo is always `isMain: true`; displayed larger in the grid
- Drag-and-drop reordering via `ReactSortable`; reorder updates `isMain` to whichever is now first
- `image_url` (single URL column) always mirrors the main photo
- Supported: JPG, PNG, HEIC/HEIF, WebP (browser-image-compression handles compression)

**Photo Editor**:
- `ImageEditor` opens on "Edit photo" hover button
- `imageToEdit` state tracks `{url, itemId, photoIndex}`
- History keys: `imageEditHistory` localStorage map keyed by `${itemId}_${photoId}`
- For new (unsaved) items, a stable temp ID (`temp_add_inventory_${Date.now()}_...`) is used; on save, the key is migrated to the real item ID

**Special Features**:
- **Receipt Scanner**: `ReceiptScannerDialog` calls `/api/receipt/scan` (OpenAI Vision); auto-fills item name, source, purchase date, price, and appends line items to Description
- **Search Button**: Appears next to Item Name when text is present; opens `EnhancedProductSearchDialog` (lazy-loaded) with the item name as initial query
- **Description Generator**: "Generate" button opens `DescriptionGenerator` dialog (AI-powered, per-platform)
- **Mercari Metrics**: If editing a Mercari item with `mercari_likes`/`mercari_views`, shows read-only performance metrics panel

---

### 6.3 Inventory
**File**: `src/pages/Inventory.jsx` (~4100 lines — largest page)

The main inventory management list. Supports grid and list view modes.

**View Modes**:
- `grid` (default) — 3 variations (Compact/Visual Showcase/Mobile-First)
- `list` — 3 variations
- View mode persisted in `localStorage('inventory_view_mode')`

**Filters** (persistent across navigation via URL state):
- `search` — searches item_name
- `status` — `not_sold` (default), `available`, `listed`, `sold`, `all`
- `daysInStock` — all, 7, 14, 30, 60, 90 days
- `returnDeadline` — special filter for items with upcoming returns
- `stale` — items purchased 10+ days ago, not sold
- Tags filtering (favorites, quick tags)
- Group filtering

**Sort Options**: newest, oldest, price_asc, price_desc, name_asc

**Per-Item Actions**:
- View details (opens `InventoryItemViewDialog`)
- Edit (navigates to AddInventoryItem with `?id=...`)
- Copy (navigates to AddInventoryItem with `?copyId=...`)
- Sell — if `quantity > quantity_sold`, shows quantity dialog then navigates to AddSale with URL params
- Toggle favorite (`is_favorite` field)
- Quick tag (popup with predefined tags: "Return Soon", "Restock", "Consignment", "Gift", "High Priority")
- Edit photo (opens `ImageEditor`)
- Archive (soft-delete via `deleted_at`)
- Permanent delete
- View on Facebook (if `facebook_item_id` exists)
- Duplicate detection (runs `DuplicateDetectionDialog`)
- Group management (`GroupDialog`, `ManageGroupsDialog`)
- Export CSV (via `/api/inventory/export` with auth)

**Bulk Actions** (via `SelectionBanner`):
- Bulk archive
- Bulk status update
- Bulk delete

**Navigation from Import**: If URL has `?highlight=<id>`, the page scrolls to and highlights that item for 2 seconds.

---

### 6.4 Add Sale
**File**: `src/pages/AddSale.jsx`

Records a sale. Can create new, edit (`?id=<uuid>`), or copy (`?copyId=<uuid>`).

**Triggered from Inventory**: When clicking "Sell" on an inventory item, navigated to with:
`?inventoryId=<id>&itemName=...&purchasePrice=<per-item>&purchaseDate=...&source=...&category=...&imageUrl=...&soldQuantity=<qty>`

**Key Form Fields**:
- `item_name`, `brand`, `category`
- `quantity_sold` (capped at `remainingItemQuantity` when coming from inventory)
- `purchase_price` (auto-multiplied by quantity_sold when from inventory)
- `purchase_date`, `sale_date`
- `source` (where purchased)
- `platform` (where sold — from PLATFORM_GROUPS)
- `selling_price`
- `shipping_cost` (required for eBay, Mercari, Etsy, Facebook online)
- `platform_fees` (for eBay: sales tax collected from buyer)
- `vat_fees` (eBay only: VAT collected from buyer)
- `other_costs` (renamed "Transaction Fees" for eBay)
- `notes`
- `facebook_sale_type` (`local` or `online`) — shown when platform is `facebook_marketplace`

**Custom Fees** (eBay only): Users can add named custom fees (e.g. "International surcharge: $2.50"). Stored as JSON embedded in `notes` field via `[FEES:{...}]` prefix. Displayed in AddSale as an expandable section.

**Profit Calculation**: Auto-calculated live in UI. Formula:
```
profit = selling_price - (purchase_price + shipping_cost + platform_fees + other_costs + vat_fees + customFeesTotal)
```

**eBay-Specific Fields** (shown only for imported eBay sales with `ebay_transaction_id` or `ebay_order_id`):
- Tracking number (clickable Google search link)
- Shipping carrier, shipped date, delivery date, item condition
- eBay order link (to `ebay.com/sh/ord/details`)
- Buyer username badge
- "Show Details" toggle reveals: payment method/status/date, item location, funds status, buyer notes

**Search Button**: When `item_name` is not empty, shows a "Search" button that opens `EbaySoldDialog` for researching sold comp prices.

**Post-Save Logic**:
- If linked to inventory (`inventoryId`): increments `quantity_sold` on the inventory item; marks as `sold` if fully sold out
- If NOT linked to inventory: auto-creates a corresponding inventory item in `sold` status and links the sale to it

---

### 6.5 Sales History
**File**: `src/pages/SalesHistory.jsx` (~2700 lines)

Lists all sales with filters and bulk actions.

**View Modes**: Grid and list (similar to Inventory page).

**Filters**:
- Text search (item_name)
- Platform filter
- Date range (custom date picker)
- Category filter
- Sort: newest, oldest, profit_high, profit_low

**Per-Sale Actions**:
- Edit (→ AddSale?id=...)
- Copy (→ AddSale?copyId=...)
- Archive (soft-delete)
- Link to inventory item

**Profit Display**:
- Shows selling price, profit, ROI
- `getResaleValue()` function categorizes: High (ROI > 0, profit > $100), Medium (ROI > 50%), Low (profit > 0), No Profit

**Bulk Actions**: Delete, archive multiple sales.

**Export**: CSV export via `/api/sales/export` with auth.

---

### 6.6 Crosslist Composer
**File**: `src/pages/CrosslistComposer.jsx` (~23,000+ lines — the most complex page)

The heart of ProfitOrbit. A multi-marketplace listing composer. Generates and submits listings to eBay, Mercari, and Facebook simultaneously.

**Startup**: Loads an inventory item from `?inventoryId=<id>` URL param. All item data (name, description, photos, brand, size, category, condition) is pre-filled from the inventory record.

**Marketplace Tabs**: eBay, Mercari, Facebook Marketplace, Etsy (read-only/coming soon), Poshmark (coming soon).

**Per-Marketplace Settings**:

**eBay Tab**:
- Title (80 char limit)
- Category: uses eBay Taxonomy API (`/api/ebay/taxonomy`, `/api/ebay/taxonomy/categories`) with typeahead search and AI suggestions
- Condition (maps to eBay condition codes)
- Item Specifics (dynamic aspect fields from eBay Taxonomy API)
- Price, Quantity
- Shipping: Flat Rate or Calculated, carrier/service selection from `FLAT_SHIPPING_SERVICES` and `CALCULATED_SHIPPING_SERVICES` constants, handling time, free shipping toggle
- Description (rich text, platform-specific)
- Listing type: Fixed Price or Auction
- Duration: GTC (Good Till Cancelled) or 3/5/7/10/30 days

**Mercari Tab**:
- Title
- Category: hierarchical picker from `MERCARI_CATEGORIES` constant (Women/Men/Kids/Electronics/Games/etc. → subcategories → leaf categories)
- Condition: maps to Mercari condition options
- Price, Shipping details (Mercari prepaid or own label)
- Description

**Facebook Tab**:
- Title, Description
- Category: `FacebookCategoryPicker` component with Facebook's category tree
- Price
- Delivery: Local Pickup / Shipping / Both
- Condition

**Photo Management**:
- Inherits `photos[]` from inventory item
- Drag-to-reorder via `ReactSortable`
- Each photo can be opened in `ImageEditor`
- "Apply to All" applies the same filter settings to all photos simultaneously

**Description Generator**: "Generate" button opens `DescriptionGenerator` which creates platform-specific descriptions for all three platforms in one AI call.

**Sold Lookup / eBay Search**: `SoldLookupDialog` and `EbaySearchDialog` accessible to research pricing.

**AI Tag Suggestions**: `BrandCombobox` with AI brand suggestions (`/api/ai/suggest-brands`), tag suggestions.

**Crosslisting Engine** (`src/services/CrosslistingEngine.js`):
- Orchestrates actual listing submission
- eBay: via `/api/ebay/listing` (Trading API)
- Mercari: via Puppeteer/session-based (`/api/mercari/create-listing`)
- Facebook: via ProfitOrbit browser extension (`window.ProfitOrbitExtension`)

**Listing Job Tracker** (`ListingJobTracker` component): Shows real-time progress of background listing jobs.

**Smart Listing** (`SmartListingSection`, `SmartListingModal`, `FixesDialog`): Pre-flight validation that flags issues before submission (missing required fields, policy violations, etc.).

**Color Picker**: `ColorPickerDialog` for selecting item color (mapped to `color` field).

---

### 6.7 Import
**File**: `src/pages/Import.jsx` (~2800 lines)

Imports existing marketplace listings into ProfitOrbit inventory.

**Supported Sources**: eBay, Facebook Marketplace, Mercari, Etsy (coming soon).

**Source Selection**: Radio button strip at top. Last selection remembered in `localStorage('import_last_source')` and synced to URL `?source=...`.

**eBay Import**:
- Fetches via `/api/ebay/my-listings?status=Active|Ended|Sold`
- Lists items with image, title, price, status, listing ID
- Single import or bulk import (checkbox selection + SelectionBanner)
- On import: calls `inventoryApi.create()` to create an inventory record, then marks the eBay item as imported (shows "Imported" badge)
- `?highlight=<id>` is passed to Inventory page after import so the new item glows

**Facebook Import**:
- Requires ProfitOrbit browser extension to be installed
- Extension bridge (`window.ProfitOrbitExtension`) used to scrape Facebook Marketplace listings
- Job-based import system: extension posts items back to `/api/facebook/import-items`
- Shows items with title, price, date posted, status

**Mercari Import**:
- Session-based: user must have connected Mercari via Settings → Marketplaces
- Fetches active listings from `/api/mercari/import-items`
- Proxies Mercari CDN images through `/api/proxy/image` to avoid CORS
- Syncs `mercari_likes` and `mercari_views` into inventory

---

### 6.8 Deals
**File**: `src/pages/Deals.jsx`

A curated deal feed for resellers. Fetches from the separate Orben API at `VITE_ORBEN_API_URL` (default: `https://orben-api.fly.dev`).

**Feed**: Infinite-scroll (`useInfiniteQuery`), 20 items per page. Debounced search (400ms). Sticky search bar with IntersectionObserver sentinel detection.

**Filters**: Merchant, category, minimum deal score.

**Deal Cards**: Show title, merchant, original price, sale price, discount %, deal score, category badges, "Buy Now" link, bookmarking.

**Submit Deal**: `/SubmitDeal` page allows users to submit deals they found.

---

### 6.9 Shipping
**File**: `src/pages/Shipping.jsx`

Shipping management hub with three tabs:

**Track Tab**: Enter a tracking number + carrier, calls `/api/shipping/track`, shows timeline of tracking events.

**Shipments Tab**: Saved shipments list (`/api/shipping/index`). Create new shipment (from/to address, parcel dimensions/weight). Shows status badge.

**Labels Tab**: Buy shipping labels via Shippo. Rate shopping: enter addresses + parcel, get rates from `/api/shipping/shippo-rates`, select rate, purchase label via `/api/shipping/shippo-buy`. Shows label download link.

**Address Book**: Saved from/to addresses via `/api/shipping/addresses`.

**Parcels**: Saved parcel configs via `/api/shipping/parcels`.

---

### 6.10 Analytics Hub
**File**: `src/pages/Analytics.jsx`

Simple hub page (no data of its own) with tiles linking to:
- Reports (category + tax summaries, PDF/Excel export)
- Profit Calendar (calendar view of daily/monthly profit)
- Gallery (photo gallery view of inventory)
- Platform Performance (detailed platform comparison)
- Sales History

---

### 6.11 Reports / Profit Calendar / Gallery / Platform Performance

**Reports** (`src/pages/Reports.jsx`): Runs report definitions from `/api/reports/` engine. Supports multiple report types (Sales Summary, Profit by Month, Fees Breakdown, Category Performance, Inventory Aging). Can export to PDF (`/api/reports/runs/{id}/pdf`) or Excel (`/api/reports/runs/{id}/excel`). Also includes `AnalyticsPdfDialog` for a quick analytics PDF export.

**Profit Calendar** (`src/pages/ProfitCalendar.jsx`): Calendar view where each day shows total profit. Clicking a day shows sales list for that day.

**Gallery** (`src/pages/Gallery.jsx`): Photo-first grid view of all inventory items. Useful for visual browsing.

**Platform Performance** (`src/pages/PlatformPerformance.jsx`): Detailed breakdown of sales and profit per platform with comparison charts.

---

### 6.12 Marketplace Connect
**File**: `src/pages/MarketplaceConnect.jsx`

Central hub for OAuth connections:
- **eBay**: OAuth 2.0 flow via `/api/ebay/auth` → `/api/ebay/callback`; tokens stored in `ebay_tokens` table
- **Facebook**: Developer OAuth via `/api/facebook/auth` → `/api/facebook/callback`; also checks for ProfitOrbit extension
- **Mercari**: Session-based (coming soon label, handled via extension)
- **Poshmark**: Coming soon

Shows connection status, last synced time, disconnect option.

---

### 6.13 Settings & Sub-pages
**File**: `src/pages/Settings.jsx` (hub) + `src/pages/settings/*.jsx` (sub-pages)

Settings hub renders Windows-style tiles with a live search bar. Includes an Extension install/status banner that checks `window.ProfitOrbitExtension`.

**Sub-pages**:

| Page | File | What it Does |
|------|------|-------------|
| Account | `settings/Account.jsx` | Display name, avatar upload, email, delete account |
| Security | `settings/Security.jsx` | Change password, 2FA settings |
| Marketplaces | `settings/Marketplaces.jsx` | OAuth connections (links to MarketplaceConnect) |
| Fulfillment | `settings/Fulfillment.jsx` | **Critical** — See below |
| Notifications | `settings/Notifications.jsx` | Email/push notification preferences |
| Reports Prefs | `settings/ReportsPrefs.jsx` | Default report date ranges |
| Appearance | `settings/Appearance.jsx` | Dark/light/system theme, density |

**Fulfillment Settings** (`settings/Fulfillment.jsx` — most important settings page):
- **Global Settings**: Pickup enabled/disabled + location line + notes; Shipping enabled/disabled + notes
- **Per-Platform Overrides**: Per-platform text overrides for eBay, Mercari, Facebook (takes priority over global)
- **eBay Defaults**: Saved to `localStorage('ebay-shipping-defaults')` — handling time, shipping service (flat/calculated), shipping cost, item location, country, ships-to list
- **Facebook Defaults**: Saved to `localStorage('facebook-defaults')` — delivery method, shipping option, carrier
- **Mercari Defaults**: Saved to `localStorage('mercari-defaults')` — delivery option
- **eBay Emoji Toggle**: `platform_notes.ebay_emojis` JSONB flag controls whether AI generates emoji-formatted eBay descriptions
- Saved to `user_fulfillment_profiles` table via `/api/fulfillment/profile`

---

### 6.14 Other Pages

| Page | Key Function |
|------|-------------|
| `Landing.jsx` | Marketing landing page (no auth required) |
| `Login.jsx` / `SignUp.jsx` | Auth forms (Supabase) |
| `ResetPassword.jsx` | Password reset |
| `EbayOauthLanding.jsx` | eBay OAuth callback receiver |
| `MarketIntelligence.jsx` | Market research hub (product search + trend data) |
| `MarketIntelligenceDetail.jsx` | Detailed product search result page |
| `ProductSearch.jsx` | Universal product search page |
| `ProTools.jsx` | Pro tools hub (Send Offers, Auto Offers) |
| `ProToolsSendOffers.jsx` | Bulk eBay offer sender |
| `ProToolsAutoOffers.jsx` | Auto-accept eBay offers |
| `ProToolsMarketplaceSharing.jsx` | Cross-share listings |
| `Training.jsx` / `TrainingPlaybooks.jsx` | Training center hub |
| `TrainingGuide.jsx` / `TrainingPlaybook.jsx` | Individual training articles |
| `Rewards.jsx` / `RewardsNew.jsx` | Gamification rewards system |
| `News.jsx` | In-app news feed |
| `FAQ.jsx` | Static FAQ page |
| `PrivacyPolicy.jsx` | Privacy policy (static) |
| `MigrateData.jsx` | Data migration utility (admin) |
| `SoldItemDetail.jsx` | Detailed view of a single sold item |
| `ProfileSettings.jsx` | Profile/account settings (alternative entry) |

---

## 7. Key Components

### 7.1 ImageEditor
**File**: `src/components/ImageEditor.jsx` (~1700 lines)

The photo editing dialog. Built on `react-filerobot-image-editor` (FIE) with Konva for rendering.

**Props**:
- `open` — boolean
- `onOpenChange(bool)` — close callback
- `imageSrc` — URL of image to edit
- `onSave(fileUrl, photoIndex)` — called after upload completes
- `fileName` — output filename hint
- `allImages` — full photos array (for "Apply to All" feature)
- `itemId` — used for localStorage history keying
- `imageIndex` — index of current image in allImages

**Features**:
- **Finetunes**: Brightness, Contrast, Warmth, Shadows (via custom Konva filter getter/setters registered at module-load time)
- **Filters**: Standard photo filters (Vintage, Chrome, etc.)
- **Crop**: Aspect ratio locked/free, standard ratios
- **Rotation & Flip**
- **Tabs**: Finetune, Filters, Adjust (crop/rotate)

**Template System**:
- Templates stored in `localStorage('orben_editor_templates')` (max 20)
- Also synced to Supabase `image_editor_templates` table via `/api/image-templates`
- `extractTemplateFields(ds)` extracts only image-agnostic settings (finetunes, filters, crop ratio) — NOT image dimensions, annotations, or undo history (those would corrupt re-application)
- Templates can be named and saved, then applied to future images

**History System**:
- Per-photo edit history stored in `localStorage('imageEditHistory')` as a Map
- Key format: `${itemId}_${photoId}` or `${itemId}_${photoIndex}`
- When photo is removed: history entry is deleted
- When new item saves: temp ID keys are migrated to real item ID

**Apply to All**:
- Extracts current filter/finetune settings
- Applies to each photo in `allImages` client-side via Konva canvas
- Uploads all processed images, calls `onApplyFiltersToAll(processedImages, filters)` callback

**HQ Image Smoothing**: Patches `CanvasRenderingContext2D.prototype.drawImage` at module load to always enable `imageSmoothingEnabled: true` and `imageSmoothingQuality: 'high'`.

---

### 7.2 DescriptionGenerator
**File**: `src/components/DescriptionGenerator.jsx` (~680 lines)

AI-powered description generator dialog.

**Props**: `open`, `onOpenChange`, `onSelectDescription(text)`, `marketplace`, `inputDescription`, `title`, `brand`, `category`, `condition`, `itemId`, `onApplyTags(tagsArray)`, `onSelectCategory(catPath)`

**Platform Tabs**: eBay, Mercari, Facebook, Tags (using square icon buttons with marketplace logos)

**Per-platform caching**: Results cached in `localStorage` keyed by `desc_gen_${itemId}`. Only regenerates when user clicks "Regenerate".

**API call**: `POST /api/ai/generate-description` with `{title, brand, category, condition, inputDescription}`

**Returns**: `{ebay, mercari, facebook, tags[], ebaySuggestedCategories[], mercariSuggestedCategories[], facebookSuggestedCategories[], warnings[]}`

**UI Features**:
- Animated category suggestions section with accordion reveal
- "Apply Tags" button saves tags to inventory item via `onApplyTags` callback
- "Use This" button applies selected description via `onSelectDescription`
- Copy button per platform
- Warning alerts if AI couldn't fully parse or missing data

**Fulfillment Integration**: The API route reads the user's fulfillment profile from Supabase server-side and injects pickup/shipping lines into each platform's description automatically. Users configure this in Settings → Fulfillment.

---

### 7.3 EnhancedProductSearchDialog
**File**: `src/components/EnhancedProductSearchDialog.jsx` (~1000 lines, lazy-loaded)

Used on **Add Inventory** page. Tabbed product search dialog.

**Props**: `open`, `onOpenChange`, `initialQuery`, `onSelectItem(inventoryData)`

**Tabs**:
1. **All Marketplaces**: Universal product search via `/api/product-search/search`. Shows results from multiple sources (eBay, Walmart, etc.) with price range, average price. Clicking a result populates the inventory form.
2. **eBay Only**: Direct eBay Browse API search via `/api/ebay/search`. Shows active eBay listings with images, prices, conditions.

**eBay Sub-toggle** (inside eBay Only tab):
- **Active Listings** (default): live eBay Browse API results
- **Sold Listings**: calls `/api/ebay/sold-search` (SerpAPI), shows sold eBay comps with price, shipping, condition, seller info. Auto-triggers when switching to this view if a query is already entered.

**Size**: `max-w-[64rem]` (1024px) on desktop, `sm:w-[92vw]` on tablet.

**Search behavior**:
- Universal tab: fires on button click via `universalSearch()`
- eBay Active tab: debounced auto-search via `debouncedQuery` state
- eBay Sold tab: `handleSoldSearch()` fires on button click OR auto-fires via `useEffect` when `ebayView` switches to `'sold'` with a valid query

---

### 7.4 EbaySoldDialog
**File**: `src/components/EbaySoldDialog.jsx` (~600 lines)

Used on **Add Sale** page. Dedicated eBay sold comps research dialog.

**Props**: `open`, `onOpenChange`, `initialQuery`

**API**: `GET /api/ebay/sold-search?q=...&num=50` (SerpAPI)

**Two-panel layout**:
- **Left panel** (result list): `SoldResultCard` for each result showing: thumbnail, title, price, condition badge, trending/top-rated badge, watch count, shipping info, returns info, promotion badge, seller username
- **Right panel** (detail view): Shown when user clicks a result. Calls `/api/ebay/sold-search?product_id=...` for detailed data via SerpAPI `ebay_product` engine. Shows image gallery, full price, description, all shipping/returns/seller info.

**Size**: `max-w-[70rem]` (1120px), `sm:w-[92vw]`.

**Scrolling**: Uses native `overflow-y-auto` on flex containers with `min-h-0` (NOT Radix ScrollArea, which had broken scroll behavior).

---

### 7.5 EbaySearchDialog
**File**: `src/components/EbaySearchDialog.jsx` (lazy-loaded)

Searches live eBay active listings. Used in CrosslistComposer and Inventory page.

**API**: `/api/ebay/search` (eBay Browse API)

Distinct from `EnhancedProductSearchDialog` — this is the older, simpler search dialog for looking up active listings to inform pricing.

---

### 7.6 InventoryItemViewDialog
**File**: `src/components/InventoryItemViewDialog.jsx`

Quick-view dialog for an inventory item from the Inventory page without navigating away. Shows all fields in read-only mode with action buttons.

---

### 7.7 FacebookListingDialog
**File**: `src/components/FacebookListingDialog.jsx`

Dialog for listing an item directly on Facebook Marketplace via the ProfitOrbit browser extension. Passes item data to `window.ProfitOrbitExtension` bridge.

---

### 7.8 SoldLookupDialog
**File**: `src/components/SoldLookupDialog.jsx`

Legacy dialog (still used in CrosslistComposer) that provides links to sold listings on various marketplaces (eBay, Mercari, etc.) to help with pricing. Replaced by `EbaySoldDialog` on Add Sale page and `EnhancedProductSearchDialog` on Add Inventory page.

---

### 7.9 ReceiptScannerDialog
**File**: `src/components/ReceiptScannerDialog.jsx`

Dialog to upload a receipt image. Calls `/api/receipt/scan` which uses OpenAI Vision to extract merchant, date, total, and line items. Results auto-fill the Add Inventory Item form.

---

## 8. API Routes (Vercel Serverless)

All routes under `/api/`. Auth is via JWT in `Authorization: Bearer ...` header.

### Inventory
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/inventory` | GET/POST | List or create inventory items |
| `/api/inventory/index.js` | handles query params: sort, limit, fields, status filter |
| `/api/inventory/export` | GET | CSV export of inventory |
| `/api/inventory/check-duplicates` | POST | Check for duplicate items |
| `/api/inventory/find-duplicates` | GET | Find all duplicate groups |
| `/api/inventory/duplicates` | GET | List duplicate groups |
| `/api/inventory/merge-duplicates` | POST | Merge two duplicate items |
| `/api/inventory/groups` | GET | List item groups |

### Sales
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/sales` | GET/POST | List or create sales |
| `/api/sales/summary` | GET | `{totalProfit, totalRevenue, totalSales}` aggregate |
| `/api/sales/platform-summary` | GET | Per-platform profit/revenue totals |
| `/api/sales/export` | GET | CSV export of sales |

### eBay
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ebay/auth` | GET | Start eBay OAuth flow |
| `/api/ebay/callback` | GET | eBay OAuth callback, stores tokens |
| `/api/ebay/token` | GET | Get/refresh eBay access token |
| `/api/ebay/refresh-token` | POST | Refresh eBay OAuth token |
| `/api/ebay/search` | GET | Search active eBay listings (Browse API) |
| `/api/ebay/item` | GET | Fetch single eBay item detail |
| `/api/ebay/my-listings` | GET | Fetch user's own eBay listings |
| `/api/ebay/import-items` | POST | Import eBay listings to inventory |
| `/api/ebay/listing` | POST | Create/update eBay listing (Trading API) |
| `/api/ebay/taxonomy` | GET | eBay category taxonomy |
| `/api/ebay/traffic-report` | GET | eBay listing traffic data |
| `/api/ebay/item-orders` | GET | eBay orders for an item |
| `/api/ebay/sold-search` | GET | **SerpAPI** sold eBay listings; dual mode: keyword search (`q=`) or product detail (`product_id=`) |

**`/api/ebay/sold-search` details**:
- `?q=<keyword>&num=<1-50>`: Calls SerpAPI `engine: 'ebay'` with `show_only: 'Sold'`
- `?product_id=<id>`: Calls SerpAPI `engine: 'ebay_product'` for detailed product data
- Normalizes results to `{id, title, price, condition, image, seller, watchers, returns, quantitySold, promotion, topRated, shippingRaw}`
- Env var: `SERPAPI_KEY`

### Facebook
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/facebook/auth` | GET | Start Facebook OAuth |
| `/api/facebook/callback` | GET | Facebook OAuth callback |
| `/api/facebook/refresh-token` | POST | Refresh Facebook token |
| `/api/facebook/exchange-code` | POST | Exchange auth code for token |
| `/api/facebook/my-listings` | GET | Fetch user's Facebook listings |
| `/api/facebook/import-items` | POST | Import Facebook listings |
| `/api/facebook/scrape-details` | POST | Scrape listing details |
| `/api/facebook/scrape-status` | GET | Scrape job status |
| `/api/facebook/debug` | GET | Debug connection status |

### Mercari
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/mercari/create-listing` | POST | Create Mercari listing (puppeteer) |
| `/api/mercari/import-items` | GET | Fetch user's Mercari listings |
| `/api/mercari/save-session` | POST | Save Mercari session cookies |
| `/api/mercari/session-status` | GET | Check Mercari session validity |
| `/api/mercari-puppeteer` | POST | Puppeteer-based Mercari automation |

### AI
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/ai/generate-description` | POST | Generate eBay/Mercari/Facebook descriptions + tags + categories. Supports OpenAI GPT-4o-mini (primary) or Anthropic Claude (fallback). Injects fulfillment profile. |
| `/api/ai/suggest-brands` | POST | AI brand suggestions for a given item title + category |
| `/api/ai/suggest-tags` | POST | AI tag suggestions |
| `/api/ai/auto-fill-fields` | POST | Auto-fill item specifics/fields |

### Product Search
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/product-search/search` | GET | Universal product search (multi-source) |
| `/api/product-search/ebay-api` | GET | eBay-specific product search |
| `/api/product-search/walmart-scraper` | GET | Walmart product data |
| `/api/product-search/free-api-search` | GET | Free API product search |

### Shipping
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/shipping/index` | GET/POST | Shipments CRUD |
| `/api/shipping/track` | GET | Track package by carrier + tracking number |
| `/api/shipping/shippo-rates` | POST | Get Shippo shipping rates |
| `/api/shipping/shippo-buy` | POST | Purchase Shippo label |
| `/api/shipping/labels` | GET | List purchased labels |
| `/api/shipping/addresses` | GET/POST | Address book CRUD |
| `/api/shipping/parcels` | GET/POST | Parcel configs CRUD |

### Reports
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/reports/run` | POST | Run a report |
| `/api/reports/summary` | GET | Report summary |
| `/api/reports/analytics-pdf` | POST | Generate analytics PDF |
| `/api/reports/runs/[id]` | GET | Get report run status |
| `/api/reports/runs/[id]/pdf` | GET | Download report PDF |
| `/api/reports/runs/[id]/excel` | GET | Download report Excel |

### Other
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/receipt/scan` | POST | OpenAI Vision receipt OCR |
| `/api/upload` | POST | Upload file to Supabase Storage |
| `/api/image-templates` | GET/POST | Image editor template CRUD |
| `/api/profile` | GET/PUT | User profile CRUD |
| `/api/profile/upload-avatar` | POST | Upload avatar image |
| `/api/platform/status` | GET | Check platform connection status |
| `/api/platform/connect` | POST | Connect platform |
| `/api/platform/disconnect/[platform]` | DELETE | Disconnect platform |
| `/api/preferences` | GET/PUT | User preferences |
| `/api/crosslistings` | GET/POST | Crosslisting drafts |
| `/api/crosslistings/[id]` | GET/PUT/DELETE | Single crosslisting |
| `/api/notifications` | GET | Notifications list |
| `/api/notifications/read` | POST | Mark notification read |
| `/api/offers/eligible-items` | GET | Items eligible for eBay offers |
| `/api/rewards/state` | GET | Rewards state |
| `/api/rewards/earn` | POST | Earn reward points |
| `/api/rewards/redeem` | POST | Redeem reward |
| `/api/rewards/catalog` | GET | Rewards catalog |
| `/api/news/feed` | GET | News feed |
| `/api/news/badge` | GET | Unread news count |
| `/api/proxy/image` | GET | Proxy images (used for Mercari CDN CORS bypass) |
| `/api/pulse/*` | various | Deals scanning system |
| `/api/training/*` | various | Training center progress/feedback |
| `/api/admin/*` | various | Admin utilities |
| `/api/webhooks/shippo` | POST | Shippo webhook receiver |
| `/api/fulfillment/profile` | GET/PUT | Fulfillment profile CRUD |

---

## 9. External Integrations

### eBay
- **OAuth 2.0**: Tokens stored in `ebay_tokens` Supabase table. Refresh flow via `/api/ebay/refresh-token`.
- **Browse API**: Used for product search and looking up active listings.
- **Trading API**: Used for creating/updating listings in CrosslistComposer.
- **Taxonomy API**: Used in CrosslistComposer for eBay category hierarchy and item specifics.
- **Order API**: Used in Import page for sold items.
- Env vars: `EBAY_CLIENT_ID`, `EBAY_CLIENT_SECRET`, `EBAY_REDIRECT_URI`

### Facebook
- **Developer OAuth**: Requires Pages/Business permissions. Tokens stored in Supabase.
- **Graph API**: For listing and importing Facebook Marketplace items.
- Also requires ProfitOrbit Chrome extension for direct listing automation.
- Env vars: `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `FACEBOOK_REDIRECT_URI`

### Mercari
- **Session-based** (no official API): Uses puppeteer to scrape/post on behalf of user's Mercari session.
- Session cookies stored in `mercari_sessions` Supabase table.
- Images from `mercdn.net` are proxied through `/api/proxy/image` to bypass CORS.
- Env vars: Mercari credentials if any

### OpenAI
- Used in: `generate-description`, `suggest-brands`, `suggest-tags`, `auto-fill-fields`, `receipt/scan`
- Model: `gpt-4o-mini` (configurable via `OPENAI_MODEL` env var)
- Falls back to Anthropic Claude (`claude-3-haiku-20240307`) if `OPENAI_API_KEY` not set
- Env vars: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

### SerpAPI
- Used for eBay sold listings search (`/api/ebay/sold-search`)
- Uses `engine: 'ebay'` with `show_only: 'Sold'` for keyword search
- Uses `engine: 'ebay_product'` for detailed product view
- Env var: `SERPAPI_KEY`

### Shippo
- Shipping rates, label purchasing, tracking
- Env var: `SHIPPO_API_KEY`

### Supabase
- Database (PostgreSQL with RLS)
- Auth (JWT)
- Storage (image uploads)
- Env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`

### Orben API (Deals backend)
- Separate service at `orben-api.fly.dev`
- JWT-authenticated
- Provides deals feed, deal scoring, deal sources
- Env var: `VITE_ORBEN_API_URL`

---

## 10. Browser Extension Integration

ProfitOrbit has a companion Chrome extension. The app checks for it via:

```js
window?.ProfitOrbitExtension
// or
window.__PROFIT_ORBIT_EXTENSION_VERSION
```

The extension enables:
- **Facebook Marketplace listing**: The CrosslistComposer sends listing data to the extension which then posts it to Facebook on the user's behalf (Vendoo-like approach)
- **Facebook Import**: Extension scrapes the user's Facebook Marketplace listings
- **Mercari session**: Extension can capture and save Mercari session cookies

**Detection**: `MarketplaceConnect` and `Settings` pages check every 1500ms via `setInterval`. Extension must respond to `ext.isAvailable()` returning truthy.

---

## 11. Utility Modules & Hooks

### Hooks (`src/hooks/`)
| Hook | Purpose |
|------|---------|
| `useCustomSources(storageKey)` | Reads/writes custom sources or platforms from localStorage |
| `useInventoryTags` | Tags system for inventory items |
| `useIsMobile` | Returns true if viewport is mobile |
| `useEbayCategoryTreeId` | Fetches eBay marketplace category tree ID |
| `useEbayCategories` | Fetches eBay categories for a given tree |
| `useEbayCategoryAspects` | Fetches eBay item specifics for a category |
| `useEbayCategorySuggestions` | AI-powered eBay category suggestions |
| `useSmartListing` | Smart listing preflight validation |

### Utilities (`src/utils/`)
| File | Purpose |
|------|---------|
| `customFees.js` | `extractCustomFees(notes)`, `injectCustomFees(notes, fees)`, `getCustomFeesTotal(fees)`, `stripCustomFeeNotes(notes)` — handles custom fee JSON embedded in notes |
| `base44Notes.js` | `splitBase44Tags(notes)` / `mergeBase44Tags(notes, tags)` — handles internal tag data embedded in the `notes` field via a special prefix |
| `sales.js` | `sortSalesByRecency(sales)` |
| `exportWithAuth.js` | `openAuthExport(url)` — opens export URL with auth token |
| `ebayHelpers.js` | `getEbayItemUrl(itemId)` |
| `listingValidation.js` | Pre-flight listing field validation |
| `preflightEngine.js` | `getTagsForMarketplace(item, marketplace)` |

### `src/lib/utils.js`
- `cn(...classes)` — Tailwind class merger (clsx + tailwind-merge)
- `cleanHtmlText(str)` — Strips HTML tags from pasted content (used in description/notes paste handlers)

### Notes Field Encoding (important for AI agents)
The `notes` field on both `inventory_items` and `sales` is a plain text field that serves double duty as a data store for machine-readable metadata, embedded using special prefixes:

1. **Internal tags** (base44 format): `splitBase44Tags(notes)` extracts and `mergeBase44Tags(cleanNotes, tags)` re-embeds tags. This is used by the Crosslist Composer to store per-marketplace tagging data.

2. **Custom fees** (sales only): `[FEES:{...}]` prefix stores eBay custom fees JSON. `extractCustomFees(notes)` strips it out, `injectCustomFees(notes, fees)` adds it back.

When saving, always use these utilities rather than writing to `notes` directly if you need to preserve the other embedded data.

---

## Quick Reference: Where Things Are Stored

| Data | Storage |
|------|---------|
| Inventory items | `inventory_items` Supabase table |
| Sales records | `sales` Supabase table |
| Item photos | Supabase Storage bucket → `images` TEXT[] column + `photos` JSONB column |
| Photo editor history | `localStorage('imageEditHistory')` — Map of `${itemId}_${photoId}` → FIE design state |
| Image editor templates | `localStorage('orben_editor_templates')` + `image_editor_templates` Supabase table (synced) |
| Custom sources | `localStorage('orben_custom_sources')` |
| Custom platforms | `localStorage('orben_custom_platforms')` |
| eBay shipping defaults | `localStorage('ebay-shipping-defaults')` |
| Facebook defaults | `localStorage('facebook-defaults')` |
| Mercari defaults | `localStorage('mercari-defaults')` |
| Fulfillment profile | `user_fulfillment_profiles` Supabase table |
| eBay OAuth tokens | `ebay_tokens` Supabase table |
| Mercari sessions | `mercari_sessions` Supabase table |
| User preferences | `user_preferences` Supabase table |
| AI description cache | `localStorage('desc_gen_${itemId}')` |
| Inventory view mode | `localStorage('inventory_view_mode')` |
| Last import source | `localStorage('import_last_source')` |
