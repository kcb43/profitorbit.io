/**
 * Marketplace & Source data.
 * Each entry: { id, name, domain, color, emoji? }
 *   domain  → used for Google Favicon logo: https://www.google.com/s2/favicons?domain={domain}&sz=128
 *   emoji   → shown in colored circle when domain is null (generic/physical sources)
 *   color   → brand color used as logo background or fallback
 */

// ─── SOURCES ────────────────────────────────────────────────────────────────
// Where you buy / source inventory items.

export const MARKETPLACE_SOURCES = [

  // ── Major Online Retailers ────────────────────────────────────────────────
  { id: 'amazon',        name: 'Amazon',             domain: 'amazon.com',               color: '#FF9900' },
  { id: 'walmart',       name: 'Walmart',            domain: 'walmart.com',              color: '#0071CE' },
  { id: 'target',        name: 'Target',             domain: 'target.com',               color: '#CC0000' },
  { id: 'bestbuy',       name: 'Best Buy',           domain: 'bestbuy.com',              color: '#003B8E' },
  { id: 'woot',          name: 'Woot',               domain: 'woot.com',                 color: '#FF6600' },
  { id: 'costco',        name: 'Costco',             domain: 'costco.com',               color: '#005DAA' },
  { id: 'samsclub',      name: "Sam's Club",         domain: 'samsclub.com',             color: '#0067A0' },
  { id: 'homedepot',     name: 'Home Depot',         domain: 'homedepot.com',            color: '#F96302' },
  { id: 'lowes',         name: "Lowe's",             domain: 'lowes.com',                color: '#004990' },
  { id: 'kohls',         name: "Kohl's",             domain: 'kohls.com',                color: '#222222' },
  { id: 'macys',         name: "Macy's",             domain: 'macys.com',                color: '#E21A2C' },
  { id: 'nordstrom',     name: 'Nordstrom',          domain: 'nordstrom.com',            color: '#1A1A1A' },
  { id: 'nordstromrack', name: 'Nordstrom Rack',     domain: 'nordstromrack.com',        color: '#333333' },
  { id: 'tjmaxx',        name: 'TJ Maxx',            domain: 'tjmaxx.com',               color: '#CC0033' },
  { id: 'marshalls',     name: 'Marshalls',          domain: 'marshalls.com',            color: '#004B87' },
  { id: 'ross',          name: 'Ross',               domain: 'rossstores.com',           color: '#CC0000' },
  { id: 'burlington',    name: 'Burlington',         domain: 'burlington.com',           color: '#003087' },
  { id: 'dollargeneral', name: 'Dollar General',     domain: 'dollargeneral.com',        color: '#007DC6' },
  { id: 'dollartree',    name: 'Dollar Tree',        domain: 'dollartree.com',           color: '#008000' },
  { id: 'fivebelow',     name: 'Five Below',         domain: 'fivebelow.com',            color: '#7B2D8B' },
  { id: 'gamestop',      name: 'GameStop',           domain: 'gamestop.com',             color: '#5B2D8E' },
  { id: 'petco',         name: 'Petco',              domain: 'petco.com',                color: '#0099CC' },
  { id: 'petsmart',      name: 'PetSmart',           domain: 'petsmart.com',             color: '#CC0033' },
  { id: 'chewy',         name: 'Chewy',              domain: 'chewy.com',                color: '#0099FF' },
  { id: 'ikea',          name: 'IKEA',               domain: 'ikea.com',                 color: '#0058A3' },
  { id: 'walgreens',     name: 'Walgreens',          domain: 'walgreens.com',            color: '#E31837' },
  { id: 'cvs',           name: 'CVS',                domain: 'cvs.com',                  color: '#CC0000' },
  { id: 'staples',       name: 'Staples',            domain: 'staples.com',              color: '#CC0000' },
  { id: 'dicks',         name: "Dick's Sporting",    domain: 'dickssportinggoods.com',   color: '#003087' },
  { id: 'academy',       name: 'Academy Sports',     domain: 'academy.com',              color: '#CC0000' },

  // ── Liquidation / Wholesale ────────────────────────────────────────────────
  { id: 'bstock',        name: 'B-Stock',            domain: 'bstock.com',               color: '#2C3E8C' },
  { id: 'liquidation',   name: 'Liquidation.com',    domain: 'liquidation.com',          color: '#003087' },
  { id: 'bulq',          name: 'BULQ',               domain: 'bulq.com',                 color: '#0066CC' },
  { id: 'shopgoodwill',  name: 'ShopGoodwill',       domain: 'shopgoodwill.com',         color: '#005F9E' },

  // ── Peer-to-Peer / Resale Marketplaces ────────────────────────────────────
  { id: 'ebay',          name: 'eBay',               domain: 'ebay.com',                 color: '#E43137' },
  { id: 'mercari',       name: 'Mercari',            domain: 'mercari.com',              color: '#E8300B' },
  { id: 'poshmark',      name: 'Poshmark',           domain: 'poshmark.com',             color: '#C62A87' },
  { id: 'depop',         name: 'Depop',              domain: 'depop.com',                color: '#FF2300' },
  { id: 'grailed',       name: 'Grailed',            domain: 'grailed.com',              color: '#1A1A1A' },
  { id: 'thredup',       name: 'ThredUp',            domain: 'thredup.com',              color: '#3CB371' },
  { id: 'therealreal',   name: 'The RealReal',       domain: 'therealreal.com',          color: '#1A1A1A' },
  { id: 'vestiaire',     name: 'Vestiaire Collective', domain: 'vestiairecollective.com', color: '#2D2D2D' },
  { id: 'vinted',        name: 'Vinted',             domain: 'vinted.com',               color: '#09B1BA' },
  { id: 'stockx',        name: 'StockX',             domain: 'stockx.com',               color: '#006400' },
  { id: 'goat',          name: 'GOAT',               domain: 'goat.com',                 color: '#1A1A1A' },
  { id: 'whatnot',       name: 'WhatNot',            domain: 'whatnot.com',              color: '#6C5CE7' },
  { id: 'etsy',          name: 'Etsy',               domain: 'etsy.com',                 color: '#F1641E' },
  { id: 'bonanza',       name: 'Bonanza',            domain: 'bonanza.com',              color: '#27AE60' },
  { id: 'offerup',       name: 'OfferUp',            domain: 'offerup.com',              color: '#1EB45F' },
  { id: 'facebook',      name: 'Facebook',           domain: 'facebook.com',             color: '#1877F2' },
  { id: 'craigslist',    name: 'Craigslist',         domain: 'craigslist.org',           color: '#591313' },
  { id: 'backmarket',    name: 'Back Market',        domain: 'backmarket.com',           color: '#00C5A3' },
  { id: 'decluttr',      name: 'Decluttr',           domain: 'decluttr.com',             color: '#FF6400' },
  { id: 'hibid',         name: 'HiBid',              domain: 'hibid.com',                color: '#B8000A' },
  { id: '1stdibs',       name: '1stDibs',            domain: '1stdibs.com',              color: '#8B6914' },
  { id: 'rubylane',      name: 'Ruby Lane',          domain: 'rubylane.com',             color: '#C41E3A' },
  { id: 'chairish',      name: 'Chairish',           domain: 'chairish.com',             color: '#4A90D9' },
  { id: 'kidizen',       name: 'Kidizen',            domain: 'kidizen.com',              color: '#FF6B35' },
  { id: 'swap',          name: 'Swap.com',           domain: 'swap.com',                 color: '#FF9F1C' },
  { id: 'goodwill',      name: 'Goodwill',           domain: 'goodwill.org',             color: '#0072BB' },

  // ── Physical / In-Person / Generic ────────────────────────────────────────
  { id: 'thriftstore',   name: 'Thrift Store',       domain: null, emoji: '🏪',          color: '#4CAF50' },
  { id: 'garagesale',    name: 'Garage Sale',        domain: null, emoji: '🏡',          color: '#FF9800' },
  { id: 'estatesale',    name: 'Estate Sale',        domain: null, emoji: '🏠',          color: '#9C27B0' },
  { id: 'fleamarket',    name: 'Flea Market',        domain: null, emoji: '🛍',          color: '#795548' },
  { id: 'auction',       name: 'Auction',            domain: null, emoji: '🔨',          color: '#F44336' },
  { id: 'localpickup',   name: 'Local Pickup',       domain: null, emoji: '📍',          color: '#607D8B' },
  { id: 'other',         name: 'Other',              domain: null, emoji: '•••',         color: '#555555' },
];

// ─── PLATFORMS ──────────────────────────────────────────────────────────────
// Where you sell inventory items.

export const MARKETPLACE_PLATFORMS = [

  // ── Primary Selling Platforms ─────────────────────────────────────────────
  { id: 'mercari',       name: 'Mercari',            domain: 'mercari.com',              color: '#E8300B' },
  { id: 'ebay',          name: 'eBay',               domain: 'ebay.com',                 color: '#E43137' },
  { id: 'facebook',      name: 'Facebook Marketplace', domain: 'facebook.com',           color: '#1877F2' },
  { id: 'poshmark',      name: 'Poshmark',           domain: 'poshmark.com',             color: '#C62A87' },
  { id: 'depop',         name: 'Depop',              domain: 'depop.com',                color: '#FF2300' },
  { id: 'grailed',       name: 'Grailed',            domain: 'grailed.com',              color: '#1A1A1A' },
  { id: 'whatnot',       name: 'WhatNot',            domain: 'whatnot.com',              color: '#6C5CE7' },
  { id: 'amazon',        name: 'Amazon',             domain: 'amazon.com',               color: '#FF9900' },
  { id: 'etsy',          name: 'Etsy',               domain: 'etsy.com',                 color: '#F1641E' },
  { id: 'stockx',        name: 'StockX',             domain: 'stockx.com',               color: '#006400' },
  { id: 'goat',          name: 'GOAT',               domain: 'goat.com',                 color: '#1A1A1A' },
  { id: 'therealreal',   name: 'The RealReal',       domain: 'therealreal.com',          color: '#1A1A1A' },
  { id: 'vestiaire',     name: 'Vestiaire Collective', domain: 'vestiairecollective.com', color: '#2D2D2D' },
  { id: 'thredup',       name: 'ThredUp',            domain: 'thredup.com',              color: '#3CB371' },
  { id: 'bonanza',       name: 'Bonanza',            domain: 'bonanza.com',              color: '#27AE60' },
  { id: 'offerup',       name: 'OfferUp',            domain: 'offerup.com',              color: '#1EB45F' },
  { id: 'craigslist',    name: 'Craigslist',         domain: 'craigslist.org',           color: '#591313' },
  { id: 'chairish',      name: 'Chairish',           domain: 'chairish.com',             color: '#4A90D9' },
  { id: '1stdibs',       name: '1stDibs',            domain: '1stdibs.com',              color: '#8B6914' },
  { id: 'rubylane',      name: 'Ruby Lane',          domain: 'rubylane.com',             color: '#C41E3A' },
  { id: 'swap',          name: 'Swap.com',           domain: 'swap.com',                 color: '#FF9F1C' },
  { id: 'vinted',        name: 'Vinted',             domain: 'vinted.com',               color: '#09B1BA' },
  { id: 'backmarket',    name: 'Back Market',        domain: 'backmarket.com',           color: '#00C5A3' },
  { id: 'decluttr',      name: 'Decluttr',           domain: 'decluttr.com',             color: '#FF6400' },
  { id: 'kidizen',       name: 'Kidizen',            domain: 'kidizen.com',              color: '#FF6B35' },
  { id: 'tiktokshop',    name: 'TikTok Shop',        domain: 'tiktok.com',               color: '#FE2C55' },
  { id: 'instagram',     name: 'Instagram',          domain: 'instagram.com',            color: '#E1306C' },
  { id: 'walmart',       name: 'Walmart Marketplace', domain: 'walmart.com',             color: '#0071CE' },
  { id: 'hibid',         name: 'HiBid',              domain: 'hibid.com',                color: '#B8000A' },
  { id: 'goodwill',      name: 'Goodwill',           domain: 'goodwill.org',             color: '#0072BB' },

  // ── In-Person / Generic ────────────────────────────────────────────────────
  { id: 'localsale',     name: 'Local Sale',         domain: null, emoji: '📍',          color: '#607D8B' },
  { id: 'other',         name: 'Other',              domain: null, emoji: '•••',         color: '#555555' },
];
