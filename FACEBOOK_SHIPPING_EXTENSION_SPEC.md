# Facebook Listing — Shipping Fields Extension Spec

## Overview: How the current pipeline works

```
CrosslistComposer.jsx
  └─ ext.createFacebookListing({ inventory_item_id, payload: { title, price, … } })
       │
       ▼
profit-orbit-page-api.js  [MAIN world, injected into profitorbit.io]
  └─ postAndWait('PO_CREATE_FACEBOOK_LISTING', 'PO_CREATE_FACEBOOK_LISTING_RESULT', normalized, 180000ms)
       │  window.postMessage → content.js catches it
       ▼
content.js  [isolated world, facebook.com + profitorbit.io tabs]
  └─ chrome.runtime.sendMessage({ type: 'PO_CREATE_FACEBOOK_LISTING', ...payload })
       │
       ▼
background.js  [service worker]
  └─ handler: type === 'CREATE_FACEBOOK_LISTING'  ← strips PO_ prefix
       1. Rate-limit check (FB_CREATE_MIN_GAP_MS)
       2. Load last API recording (graphql template + upload template)
       3. Fetch fresh fb_dtsg / lsd tokens
       4. Upload first image → get photoId
       5. Build variables.input for useCometMarketplaceListingCreateMutation
       6. Execute GraphQL mutation via facebook.com tab fetch
       7. sendResponse({ success, listingId, url })
```

## Current payload fields (CrosslistComposer → background.js)

### What CrosslistComposer sends today (`payload` object):
```js
payload: {
  title,          // string — sanitized to 120 chars
  description,    // string — sanitized to 5000 chars
  price,          // number (float) — converted to { amount: cents_string, currency: 'USD' } in background
  images,         // string[] — HTTP/HTTPS URLs; first image uploaded, photoId returned
  categoryId,     // string | null — must be 6+ digit numeric FB category ID
  category,       // string — human label (not used in GraphQL, just logging)
  condition,      // string — one of: 'new' | 'used_like_new' | 'used_good' | 'used_fair'
}
```

### How background.js reads those fields:
```js
// background.js ~line 4590
const listingData = message?.listingData || {};
const payload     = listingData?.payload || listingData || {};

const title       = sanitizeFacebookText(payload.title, { singleLine: true, maxLen: 120 });
const description = sanitizeFacebookText(payload.description, { singleLine: false, maxLen: 5000 });
const price       = payload.price ?? payload.listing_price ?? payload.amount ?? null;
const categoryId  = payload.categoryId || payload.category_id || payload.facebookCategoryId || null;
const category    = payload.category || null;
const condition   = payload.condition || null;

// Then injected into the recorded GraphQL mutation as:
variables.input.title        = title;
variables.input.description  = description;
variables.input.price        = { amount: String(Math.round(price * 100)), currency: 'USD' };
variables.input.photo_ids    = [photoId];   // from upload step
variables.input.category_id  = categoryId; // if truthy
variables.input.condition    = condition;   // if truthy
```

---

## What needs to change — full spec

### Facebook's `useCometMarketplaceListingCreateMutation` — relevant `variables.input` fields

Based on Facebook Marketplace GraphQL schema (from recordings):

| Our form field          | Facebook `variables.input` key        | Type / values                                                               |
|-------------------------|---------------------------------------|-----------------------------------------------------------------------------|
| `deliveryMethod`        | `delivery_type`                       | `"LOCAL_PICKUP"` \| `"SHIPPING"` \| `"SHIPPING_AND_PICKUP"`                |
| `shippingOption`        | `shipping_option_type`                | `"BUYER_PAYS"` (own label) \| `"SELLER_SHIPS"` (prepaid USPS label)        |
| `shippingPrice`         | `shipping_price`                      | `{ amount: "599", currency: "USD" }` (cents, as string)                    |
| `displayFreeShipping`   | `is_free_shipping_offered`            | `true` \| `false`                                                           |
| `allowOffers`           | `allow_negotiation`                   | `true` \| `false`                                                           |
| `minimumOfferPrice`     | `min_negotiated_price`                | `{ amount: "2000", currency: "USD" }` (cents, as string)                   |
| `meetUpLocation`        | `location_text` (also `location_id`)  | string — FB needs to resolve it; handled by `fillFacebookForm` (UI automation) |
| `shippingCarrier`       | `shipping_carrier`                    | `"USPS"` \| `"UPS"` \| `"FEDEX"`                                           |
| `packageWeightClass`    | `package_weight_class`                | `"LESS_THAN_HALF_POUND"` \| `"HALF_TO_ONE_POUND"` \| `"ONE_TO_TWO_POUNDS"` \| `"TWO_TO_FIVE_POUNDS"` \| `"FIVE_TO_TEN_POUNDS"` \| `"TEN_TO_SEVENTY_POUNDS"` |
| `packageWeightLbs`      | `package_weight_value`                | number (lbs)                                                                |
| `packageWeightOz`       | `package_weight_ounces`               | number (oz)                                                                 |

### Delivery type value mapping (our value → FB value):
```js
const FB_DELIVERY_TYPE = {
  'shipping_and_pickup': 'SHIPPING_AND_PICKUP',
  'shipping_only':       'SHIPPING',
  'local_pickup':        'LOCAL_PICKUP',
};
```

### Shipping option type mapping:
```js
const FB_SHIPPING_OPTION = {
  'own_label':     'BUYER_PAYS',    // buyer pays, you use your own label
  'prepaid_label': 'SELLER_SHIPS',  // Facebook sends you a prepaid USPS label
};
```

### Package weight class mapping:
```js
const FB_WEIGHT_CLASS = {
  'under_0.5': 'LESS_THAN_HALF_POUND',
  '0.5-1':     'HALF_TO_ONE_POUND',
  '1-2':       'ONE_TO_TWO_POUNDS',
  '2-5':       'TWO_TO_FIVE_POUNDS',
  '5-10':      'FIVE_TO_TEN_POUNDS',
  '10-70':     'TEN_TO_SEVENTY_POUNDS',
};
```

---

## Change 1 — CrosslistComposer.jsx

**File:** `src/pages/CrosslistComposer.jsx`
**Location:** Inside the `if (marketplace === "facebook")` block, the `ext.createFacebookListing(...)` call (~line 37217).

Replace:
```js
const result = await ext.createFacebookListing({
  inventory_item_id: currentEditingItemId || null,
  payload: {
    title,
    description,
    price: priceNum,
    images: photosToUse,
    categoryId: facebookCategoryId,
    category: facebookForm.category || generalForm.category,
    condition: facebookCondition,
  },
});
```

With:
```js
const result = await ext.createFacebookListing({
  inventory_item_id: currentEditingItemId || null,
  payload: {
    // ── existing fields ──
    title,
    description,
    price: priceNum,
    images: photosToUse,
    categoryId: facebookCategoryId,
    category: facebookForm.category || generalForm.category,
    condition: facebookCondition,

    // ── NEW: delivery & shipping ──
    deliveryMethod:      facebookForm.deliveryMethod || 'shipping_and_pickup',
    shippingOption:      facebookForm.shippingOption || 'own_label',
    shippingPrice:       facebookForm.shippingPrice  ? parseFloat(facebookForm.shippingPrice)  : null,
    displayFreeShipping: !!facebookForm.displayFreeShipping,

    // ── NEW: prepaid label fields (only relevant when shippingOption === 'prepaid_label') ──
    shippingCarrier:     facebookForm.shippingCarrier    || null,
    packageWeightClass:  facebookForm.packageWeightClass || null,
    packageWeightLbs:    facebookForm.packageWeightLbs   ? parseFloat(facebookForm.packageWeightLbs) : null,
    packageWeightOz:     facebookForm.packageWeightOz    ? parseFloat(facebookForm.packageWeightOz)  : null,

    // ── NEW: offers ──
    allowOffers:         !!facebookForm.allowOffers,
    minimumOfferPrice:   facebookForm.minimumOfferPrice ? parseFloat(facebookForm.minimumOfferPrice) : null,

    // ── NEW: location ──
    location:            facebookForm.meetUpLocation || generalForm.zip || null,
  },
});
```

---

## Change 2 — background.js

**File:** `extension/background.js`
**Location:** Inside the `type === 'CREATE_FACEBOOK_LISTING'` handler, right after the existing field extraction (~line 4608), and before `variables.input` is built.

### Step A — Extract new fields from payload:
```js
// After the existing extractions (title, description, price, categoryId, category, condition)
// ADD these lines:

// Delivery
const deliveryMethod     = payload.deliveryMethod || 'shipping_and_pickup';
const shippingOption     = payload.shippingOption || 'own_label';
const shippingPriceRaw   = payload.shippingPrice != null ? Number(payload.shippingPrice) : null;
const displayFreeShipping = !!payload.displayFreeShipping;

// Prepaid label
const shippingCarrier    = payload.shippingCarrier    || null;  // 'usps' | 'ups' | 'fedex'
const packageWeightClass = payload.packageWeightClass || null;
const packageWeightLbs   = payload.packageWeightLbs   != null ? Number(payload.packageWeightLbs)  : null;
const packageWeightOz    = payload.packageWeightOz    != null ? Number(payload.packageWeightOz)   : null;

// Offers
const allowOffers        = !!payload.allowOffers;
const minOfferPriceRaw   = payload.minimumOfferPrice  != null ? Number(payload.minimumOfferPrice) : null;

// Location (passed to UI automation AND to GraphQL)
const locationText       = payload.location || null;

// Value maps
const FB_DELIVERY_TYPE = {
  'shipping_and_pickup': 'SHIPPING_AND_PICKUP',
  'shipping_only':       'SHIPPING',
  'local_pickup':        'LOCAL_PICKUP',
};
const FB_SHIPPING_OPTION = {
  'own_label':     'BUYER_PAYS',
  'prepaid_label': 'SELLER_SHIPS',
};
const FB_WEIGHT_CLASS = {
  'under_0.5': 'LESS_THAN_HALF_POUND',
  '0.5-1':     'HALF_TO_ONE_POUND',
  '1-2':       'ONE_TO_TWO_POUNDS',
  '2-5':       'TWO_TO_FIVE_POUNDS',
  '5-10':      'FIVE_TO_TEN_POUNDS',
  '10-70':     'TEN_TO_SEVENTY_POUNDS',
};
const FB_CARRIER = {
  'usps':  'USPS',
  'ups':   'UPS',
  'fedex': 'FEDEX',
};
```

### Step B — Inject into `variables.input` (right after the existing injections):
```js
// After: variables.input.condition = condition;
// ADD these lines:

// Delivery type (always include — defaults to SHIPPING_AND_PICKUP)
variables.input.delivery_type = FB_DELIVERY_TYPE[deliveryMethod] || 'SHIPPING_AND_PICKUP';

const isShipping   = deliveryMethod === 'shipping_only' || deliveryMethod === 'shipping_and_pickup';
const isPrepaid    = shippingOption === 'prepaid_label';
const isLocalPickup = deliveryMethod === 'local_pickup';

if (isShipping) {
  // Shipping option type
  variables.input.shipping_option_type = FB_SHIPPING_OPTION[shippingOption] || 'BUYER_PAYS';

  if (!isPrepaid && shippingPriceRaw !== null) {
    // Own-label flat shipping price
    variables.input.shipping_price = {
      amount:   String(Math.round(shippingPriceRaw * 100)),
      currency: 'USD',
    };
  }

  if (!isPrepaid) {
    // Free shipping display toggle (only relevant for own-label)
    variables.input.is_free_shipping_offered = displayFreeShipping;
  }

  if (isPrepaid) {
    // Prepaid label fields
    if (shippingCarrier)    variables.input.shipping_carrier    = FB_CARRIER[shippingCarrier] || shippingCarrier.toUpperCase();
    if (packageWeightClass) variables.input.package_weight_class = FB_WEIGHT_CLASS[packageWeightClass] || packageWeightClass;
    if (packageWeightLbs !== null) variables.input.package_weight_value   = packageWeightLbs;
    if (packageWeightOz  !== null) variables.input.package_weight_ounces  = packageWeightOz;
  }
}

// Allow Offers / negotiation
variables.input.allow_negotiation = allowOffers;
if (allowOffers && !isLocalPickup && minOfferPriceRaw !== null) {
  variables.input.min_negotiated_price = {
    amount:   String(Math.round(minOfferPriceRaw * 100)),
    currency: 'USD',
  };
}

// Location — also pass to content.js for UI automation fallback
if (locationText) variables.input.location_text = locationText;
```

---

## Change 3 — content.js `fillFacebookForm` (UI automation fallback)

The `fillFacebookForm` function already handles `listingData.location` and `listingData.zip` (lines 1533-1552). The GraphQL path is preferred, but if it fails and the UI automation path is used, these new fields should also be filled.

Add to `fillFacebookForm` after the existing location block (~line 1552):

```js
// 7. DELIVERY METHOD (select from dropdown)
if (listingData.deliveryMethod) {
  const deliveryLabel = {
    'shipping_and_pickup': 'Shipping and local pickup',
    'shipping_only':       'Shipping only',
    'local_pickup':        'Local pickup',
  }[listingData.deliveryMethod];

  if (deliveryLabel) {
    const deliveryBtn = document.querySelector('[aria-label*="Delivery"], [aria-label*="delivery method"]');
    if (deliveryBtn) {
      deliveryBtn.click();
      await sleep(400);
      const option = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'))
        .find(el => el.textContent?.toLowerCase().includes(deliveryLabel.toLowerCase()));
      if (option) { option.click(); await sleep(300); }
    }
  }
}

// 8. SHIPPING OPTION (own label vs prepaid)
if (listingData.shippingOption && listingData.deliveryMethod !== 'local_pickup') {
  const optionLabel = listingData.shippingOption === 'prepaid_label'
    ? 'prepaid shipping label'
    : 'your own shipping label';
  const shippingBtn = document.querySelector('[aria-label*="Shipping option"], [aria-label*="shipping method"]');
  if (shippingBtn) {
    shippingBtn.click();
    await sleep(400);
    const option = Array.from(document.querySelectorAll('[role="menuitem"], [role="option"]'))
      .find(el => el.textContent?.toLowerCase().includes(optionLabel));
    if (option) { option.click(); await sleep(300); }
  }
}

// 9. SHIPPING PRICE (flat rate, own-label only)
if (listingData.shippingPrice && listingData.shippingOption !== 'prepaid_label') {
  const shippingPriceInput = document.querySelector('input[placeholder*="Shipping price"], input[aria-label*="Shipping price"]');
  if (shippingPriceInput) {
    shippingPriceInput.focus();
    shippingPriceInput.value = String(listingData.shippingPrice);
    shippingPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
    await sleep(200);
  }
}

// 10. FREE SHIPPING TOGGLE
if (listingData.displayFreeShipping) {
  const freeShipToggle = document.querySelector('[aria-label*="free shipping"], input[type="checkbox"][aria-label*="free"]');
  if (freeShipToggle && !freeShipToggle.checked) {
    freeShipToggle.click();
    await sleep(200);
  }
}

// 11. ALLOW OFFERS TOGGLE
if (typeof listingData.allowOffers === 'boolean') {
  const offersToggle = document.querySelector('[aria-label*="Allow offers"], [aria-label*="negotiation"]');
  if (offersToggle) {
    const isCurrentlyChecked = offersToggle.getAttribute('aria-checked') === 'true' || offersToggle.checked;
    if (listingData.allowOffers !== isCurrentlyChecked) {
      offersToggle.click();
      await sleep(300);
    }
    // Minimum offer price
    if (listingData.allowOffers && listingData.minimumOfferPrice) {
      const minPriceInput = document.querySelector('input[placeholder*="minimum"], input[aria-label*="minimum price"]');
      if (minPriceInput) {
        minPriceInput.focus();
        minPriceInput.value = String(listingData.minimumOfferPrice);
        minPriceInput.dispatchEvent(new Event('input', { bubbles: true }));
        await sleep(200);
      }
    }
  }
}
```

---

## Change 4 — content.js message handler: pass full payload to `createFacebookListing`

Currently (line 1114-1132), `content.js` forwards the raw message to background via `chrome.runtime.sendMessage`. This is fine — background.js receives it.

However, `createFacebookListing` at line 1369 receives `listingData` from background when it runs in **UI automation mode**. The listingData it receives is what background passes when it calls `chrome.scripting.executeScript`. Check that background passes the full payload (including new fields) when it calls `createFacebookListing` through `executeScript`.

In background.js, when it falls back to UI automation (if GraphQL fails), it should pass:
```js
{
  title,
  description,
  price,
  photos: images,           // note: fillFacebookForm uses listingData.photos
  category: category,
  condition: condition,
  location: locationText,
  deliveryMethod,
  shippingOption,
  shippingPrice: shippingPriceRaw,
  displayFreeShipping,
  allowOffers,
  minimumOfferPrice: minOfferPriceRaw,
}
```

---

## Message flow diagram (updated)

```
CrosslistComposer.jsx
  payload: {
    title, description, price, images, categoryId, category, condition,
    // NEW:
    deliveryMethod, shippingOption, shippingPrice, displayFreeShipping,
    shippingCarrier, packageWeightClass, packageWeightLbs, packageWeightOz,
    allowOffers, minimumOfferPrice, location
  }
  └─ ext.createFacebookListing({ inventory_item_id, payload })

profit-orbit-page-api.js
  createFacebookListing() — normalizes images → passes payload as-is
  └─ postAndWait('PO_CREATE_FACEBOOK_LISTING', ..., { inventory_item_id, payload })

content.js
  window.postMessage listener → chrome.runtime.sendMessage({ type, inventory_item_id, payload })

background.js  CREATE_FACEBOOK_LISTING handler
  Extract: title, description, price, images, categoryId, condition (existing)
  Extract NEW: deliveryMethod, shippingOption, shippingPrice, displayFreeShipping,
               shippingCarrier, packageWeightClass, allowOffers, minimumOfferPrice, location
  Map values: FB_DELIVERY_TYPE, FB_SHIPPING_OPTION, FB_WEIGHT_CLASS, FB_CARRIER
  Build variables.input: (existing) + delivery_type, shipping_option_type, shipping_price,
                          is_free_shipping_offered, package_weight_class, allow_negotiation,
                          min_negotiated_price, location_text
  GraphQL mutation: useCometMarketplaceListingCreateMutation
  └─ sendResponse({ success, listingId, url })
```

---

## Implementation order

1. **`extension/background.js`** — Step A (extract) + Step B (inject into variables.input)  
   This is the highest-leverage change: if the recorded mutation already supports these fields, everything works immediately.

2. **`src/pages/CrosslistComposer.jsx`** — Add new fields to `ext.createFacebookListing(...)` payload.

3. **`extension/content.js`** — Add delivery/shipping/offers UI automation steps to `fillFacebookForm` (fallback path).

4. **Test** — Record a new Facebook Marketplace listing that uses "Shipping Only" + prepaid label, then replay with our payload. Inspect `facebookLastCreateDebug` in `chrome.storage.local` to verify the mutation variables look correct.

---

## Notes on prepaid label (SELLER_SHIPS)

Facebook's prepaid label flow involves:
- Setting `shipping_option_type: "SELLER_SHIPS"` in the GraphQL mutation
- FB will then email the seller a discounted USPS shipping label after the item sells
- The `package_weight_class` must be set; it determines the label price tier
- No separate API call is needed from our side — Facebook's backend handles the label generation

This is the same mechanism Vendoo uses; the key is including `shipping_option_type: "SELLER_SHIPS"` with a valid `package_weight_class` in `variables.input`.
