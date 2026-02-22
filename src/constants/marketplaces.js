/**
 * Marketplace & Source constants for the web app.
 *
 * Each source entry: { name, domain, color }
 *   domain → used for logo: https://www.google.com/s2/favicons?domain={domain}&sz=64
 *   color  → brand color for avatar fallback
 *   emoji  → shown when domain is null (in-person/generic categories)
 *
 * Each platform entry: { value, label, domain, color }
 *   value  → stored in the database (slug, snake_case)
 */

// ─── Helper ──────────────────────────────────────────────────────────────────

export const getLogoUrl = (domain) =>
  domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=64` : null;

// ─── SOURCES (where you buy / source items) ──────────────────────────────────

export const SOURCE_GROUPS = [
  {
    label: "Online Retailers",
    items: [
      { name: "Amazon",          domain: "amazon.com",             color: "#FF9900" },
      { name: "Walmart",         domain: "walmart.com",            color: "#0071CE" },
      { name: "Target",          domain: "target.com",             color: "#CC0000" },
      { name: "Best Buy",        domain: "bestbuy.com",            color: "#003B8E" },
      { name: "Woot",            domain: "woot.com",               color: "#FF6600" },
      { name: "Costco",          domain: "costco.com",             color: "#005DAA" },
      { name: "Sam's Club",      domain: "samsclub.com",           color: "#0067A0" },
      { name: "Home Depot",      domain: "homedepot.com",          color: "#F96302" },
      { name: "Lowe's",          domain: "lowes.com",              color: "#004990" },
      { name: "Kohl's",          domain: "kohls.com",              color: "#222222" },
      { name: "Macy's",          domain: "macys.com",              color: "#E21A2C" },
      { name: "Nordstrom",       domain: "nordstrom.com",          color: "#1A1A1A" },
      { name: "Nordstrom Rack",  domain: "nordstromrack.com",      color: "#333333" },
      { name: "TJ Maxx",         domain: "tjmaxx.com",             color: "#CC0033" },
      { name: "Marshalls",       domain: "marshalls.com",          color: "#004B87" },
      { name: "Ross",            domain: "rossstores.com",         color: "#CC0000" },
      { name: "Burlington",      domain: "burlington.com",         color: "#003087" },
      { name: "Dollar General",  domain: "dollargeneral.com",      color: "#007DC6" },
      { name: "Dollar Tree",     domain: "dollartree.com",         color: "#008000" },
      { name: "Five Below",      domain: "fivebelow.com",          color: "#7B2D8B" },
      { name: "GameStop",        domain: "gamestop.com",           color: "#5B2D8E" },
      { name: "Petco",           domain: "petco.com",              color: "#0099CC" },
      { name: "PetSmart",        domain: "petsmart.com",           color: "#CC0033" },
      { name: "Chewy",           domain: "chewy.com",              color: "#0099FF" },
      { name: "IKEA",            domain: "ikea.com",               color: "#0058A3" },
      { name: "Walgreens",       domain: "walgreens.com",          color: "#E31837" },
      { name: "CVS",             domain: "cvs.com",                color: "#CC0000" },
      { name: "Staples",         domain: "staples.com",            color: "#CC0000" },
      { name: "Dick's Sporting", domain: "dickssportinggoods.com", color: "#003087" },
      { name: "Academy Sports",  domain: "academy.com",            color: "#CC0000" },
    ],
  },
  {
    label: "Liquidation & Wholesale",
    items: [
      { name: "B-Stock",           domain: "bstock.com",       color: "#2C3E8C" },
      { name: "Liquidation.com",   domain: "liquidation.com",  color: "#003087" },
      { name: "BULQ",              domain: "bulq.com",         color: "#0066CC" },
      { name: "ShopGoodwill",      domain: "shopgoodwill.com", color: "#005F9E" },
    ],
  },
  {
    label: "Online Marketplaces",
    items: [
      { name: "eBay",                  domain: "ebay.com",                  color: "#E43137" },
      { name: "Mercari",               domain: "mercari.com",               color: "#E8300B" },
      { name: "Poshmark",              domain: "poshmark.com",              color: "#C62A87" },
      { name: "Depop",                 domain: "depop.com",                 color: "#FF2300" },
      { name: "Grailed",               domain: "grailed.com",               color: "#1A1A1A" },
      { name: "ThredUp",               domain: "thredup.com",               color: "#3CB371" },
      { name: "The RealReal",          domain: "therealreal.com",           color: "#1A1A1A" },
      { name: "Vestiaire Collective",  domain: "vestiairecollective.com",   color: "#2D2D2D" },
      { name: "Vinted",                domain: "vinted.com",                color: "#09B1BA" },
      { name: "StockX",                domain: "stockx.com",                color: "#006400" },
      { name: "GOAT",                  domain: "goat.com",                  color: "#1A1A1A" },
      { name: "WhatNot",               domain: "whatnot.com",               color: "#6C5CE7" },
      { name: "Etsy",                  domain: "etsy.com",                  color: "#F1641E" },
      { name: "Bonanza",               domain: "bonanza.com",               color: "#27AE60" },
      { name: "OfferUp",               domain: "offerup.com",               color: "#1EB45F" },
      { name: "Facebook Marketplace",  domain: "facebook.com",              color: "#1877F2" },
      { name: "Craigslist",            domain: "craigslist.org",            color: "#591313" },
      { name: "Back Market",           domain: "backmarket.com",            color: "#00C5A3" },
      { name: "Decluttr",              domain: "decluttr.com",              color: "#FF6400" },
      { name: "HiBid",                 domain: "hibid.com",                 color: "#B8000A" },
      { name: "1stDibs",               domain: "1stdibs.com",               color: "#8B6914" },
      { name: "Ruby Lane",             domain: "rubylane.com",              color: "#C41E3A" },
      { name: "Chairish",              domain: "chairish.com",              color: "#4A90D9" },
      { name: "Kidizen",               domain: "kidizen.com",               color: "#FF6B35" },
      { name: "Swap.com",              domain: "swap.com",                  color: "#FF9F1C" },
      { name: "Goodwill",              domain: "goodwill.org",              color: "#0072BB" },
    ],
  },
  {
    label: "In-Person & Physical",
    items: [
      { name: "Thrift Store",   domain: null, emoji: "🏪", color: "#4CAF50" },
      { name: "Garage Sale",    domain: null, emoji: "🏡", color: "#FF9800" },
      { name: "Estate Sale",    domain: null, emoji: "🏠", color: "#9C27B0" },
      { name: "Flea Market",    domain: null, emoji: "🛍️", color: "#795548" },
      { name: "Auction",        domain: null, emoji: "🔨", color: "#F44336" },
      { name: "Local Pickup",   domain: null, emoji: "📍", color: "#607D8B" },
    ],
  },
];

// Flat lookup list for all predefined sources
export const ALL_SOURCES = SOURCE_GROUPS.flatMap(g => g.items);

// ─── PLATFORMS (where you sell items) ────────────────────────────────────────

export const PLATFORM_GROUPS = [
  {
    label: "Popular Platforms",
    items: [
      { value: "mercari",           label: "Mercari",              domain: "mercari.com",               color: "#E8300B" },
      { value: "ebay",              label: "eBay",                 domain: "ebay.com",                  color: "#E43137" },
      { value: "facebook_marketplace", label: "Facebook Marketplace", domain: "facebook.com",           color: "#1877F2" },
      { value: "poshmark",          label: "Poshmark",             domain: "poshmark.com",              color: "#C62A87" },
      { value: "depop",             label: "Depop",                domain: "depop.com",                 color: "#FF2300" },
      { value: "grailed",           label: "Grailed",              domain: "grailed.com",               color: "#1A1A1A" },
      { value: "whatnot",           label: "WhatNot",              domain: "whatnot.com",               color: "#6C5CE7" },
      { value: "amazon",            label: "Amazon",               domain: "amazon.com",                color: "#FF9900" },
      { value: "etsy",              label: "Etsy",                 domain: "etsy.com",                  color: "#F1641E" },
      { value: "stockx",            label: "StockX",               domain: "stockx.com",                color: "#006400" },
      { value: "goat",              label: "GOAT",                 domain: "goat.com",                  color: "#1A1A1A" },
    ],
  },
  {
    label: "Fashion & Luxury",
    items: [
      { value: "therealreal",       label: "The RealReal",         domain: "therealreal.com",           color: "#1A1A1A" },
      { value: "vestiaire",         label: "Vestiaire Collective", domain: "vestiairecollective.com",   color: "#2D2D2D" },
      { value: "thredup",           label: "ThredUp",              domain: "thredup.com",               color: "#3CB371" },
      { value: "vinted",            label: "Vinted",               domain: "vinted.com",                color: "#09B1BA" },
      { value: "kidizen",           label: "Kidizen",              domain: "kidizen.com",               color: "#FF6B35" },
    ],
  },
  {
    label: "Specialty & Niche",
    items: [
      { value: "backmarket",        label: "Back Market",          domain: "backmarket.com",            color: "#00C5A3" },
      { value: "decluttr",          label: "Decluttr",             domain: "decluttr.com",              color: "#FF6400" },
      { value: "hibid",             label: "HiBid",                domain: "hibid.com",                 color: "#B8000A" },
      { value: "1stdibs",           label: "1stDibs",              domain: "1stdibs.com",               color: "#8B6914" },
      { value: "rubylane",          label: "Ruby Lane",            domain: "rubylane.com",              color: "#C41E3A" },
      { value: "chairish",          label: "Chairish",             domain: "chairish.com",              color: "#4A90D9" },
      { value: "bonanza",           label: "Bonanza",              domain: "bonanza.com",               color: "#27AE60" },
      { value: "swap",              label: "Swap.com",             domain: "swap.com",                  color: "#FF9F1C" },
    ],
  },
  {
    label: "Social Commerce",
    items: [
      { value: "tiktok_shop",       label: "TikTok Shop",          domain: "tiktok.com",                color: "#FE2C55" },
      { value: "instagram",         label: "Instagram",            domain: "instagram.com",             color: "#E1306C" },
    ],
  },
  {
    label: "Local & Other",
    items: [
      { value: "offer_up",          label: "OfferUp",              domain: "offerup.com",               color: "#1EB45F" },
      { value: "craigslist",        label: "Craigslist",           domain: "craigslist.org",            color: "#591313" },
      { value: "walmart_marketplace", label: "Walmart Marketplace", domain: "walmart.com",             color: "#0071CE" },
      { value: "goodwill",          label: "Goodwill",             domain: "goodwill.org",              color: "#0072BB" },
      { value: "local_sale",        label: "Local Sale",           domain: null,                        color: "#607D8B" },
    ],
  },
];

// Flat lookup list for all predefined platforms
export const ALL_PLATFORMS = PLATFORM_GROUPS.flatMap(g => g.items);
