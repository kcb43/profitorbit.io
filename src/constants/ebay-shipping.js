/**
 * eBay US domestic shipping constants
 *
 * Shipping service lists were compiled from eBay's developer documentation:
 *   https://developer.ebay.com/api-docs/user-guides/static/trading-user-guide/shipping-services.html
 *   https://developer.ebay.com/devzone/merchant-data/callref/types/ShippingServiceCodeType.html
 *
 * To refresh this list, run:  node scripts/scrape-ebay-shipping.js
 */

// ---------------------------------------------------------------------------
// Handling Time options (used for both Flat and Calculated shipping)
// DispatchTimeMax 0 = same day, then 1-7 individually, then jumps to 10, 15, 20, 30, 40
// ---------------------------------------------------------------------------
export const HANDLING_TIME_OPTIONS = [
  { value: "Same business day", label: "Same business day" },
  { value: "1 business day", label: "1 business day" },
  { value: "2 business days", label: "2 business days" },
  { value: "3 business days", label: "3 business days" },
  { value: "4 business days", label: "4 business days" },
  { value: "5 business days", label: "5 business days" },
  { value: "6 business days", label: "6 business days" },
  { value: "7 business days", label: "7 business days" },
  { value: "10 business days", label: "10 business days" },
  { value: "15 business days", label: "15 business days" },
  { value: "20 business days", label: "20 business days" },
  { value: "30 business days", label: "30 business days" },
  { value: "40 business days", label: "40 business days" },
];

// ---------------------------------------------------------------------------
// Flat rate shipping services
// The seller specifies a fixed cost regardless of buyer location.
// Supports all USPS, UPS, and FedEx domestic services.
// ---------------------------------------------------------------------------
export const FLAT_SHIPPING_SERVICES = [
  // eBay economy / standard labels
  { value: "Economy Shipping (6 to 10 business days)", label: "Economy Shipping (6 to 10 business days)", carrier: "eBay" },
  { value: "Standard Shipping (3 to 5 business days)", label: "Standard Shipping (3 to 5 business days)", carrier: "eBay" },
  { value: "Expedited Shipping (1 to 3 business days)", label: "Expedited Shipping (1 to 3 business days)", carrier: "eBay" },

  // USPS
  { value: "USPS Ground Advantage", label: "USPS Ground Advantage", carrier: "USPS" },
  { value: "USPS First Class Mail", label: "USPS First Class Mail", carrier: "USPS" },
  { value: "USPS Media Mail", label: "USPS Media Mail", carrier: "USPS" },
  { value: "USPS Library Mail", label: "USPS Library Mail", carrier: "USPS" },
  { value: "USPS Retail Ground", label: "USPS Retail Ground", carrier: "USPS" },
  { value: "USPS Priority Mail", label: "USPS Priority Mail", carrier: "USPS" },
  { value: "USPS Priority Mail Express", label: "USPS Priority Mail Express", carrier: "USPS" },
  { value: "USPS Priority Mail Flat Rate Envelope", label: "USPS Priority Mail Flat Rate Envelope", carrier: "USPS" },
  { value: "USPS Priority Mail Flat Rate Padded Envelope", label: "USPS Priority Mail Flat Rate Padded Envelope", carrier: "USPS" },
  { value: "USPS Priority Mail Small Flat Rate Box", label: "USPS Priority Mail Small Flat Rate Box", carrier: "USPS" },
  { value: "USPS Priority Mail Medium Flat Rate Box", label: "USPS Priority Mail Medium Flat Rate Box", carrier: "USPS" },
  { value: "USPS Priority Mail Large Flat Rate Box", label: "USPS Priority Mail Large Flat Rate Box", carrier: "USPS" },
  { value: "USPS Priority Mail Regional Rate Box A", label: "USPS Priority Mail Regional Rate Box A", carrier: "USPS" },
  { value: "USPS Priority Mail Regional Rate Box B", label: "USPS Priority Mail Regional Rate Box B", carrier: "USPS" },

  // UPS
  { value: "UPS Ground", label: "UPS Ground", carrier: "UPS" },
  { value: "UPS 3 Day Select", label: "UPS 3 Day Select", carrier: "UPS" },
  { value: "UPS 2nd Day Air", label: "UPS 2nd Day Air", carrier: "UPS" },
  { value: "UPS 2nd Day Air A.M.", label: "UPS 2nd Day Air A.M.", carrier: "UPS" },
  { value: "UPS Next Day Air Saver", label: "UPS Next Day Air Saver", carrier: "UPS" },
  { value: "UPS Next Day Air", label: "UPS Next Day Air", carrier: "UPS" },
  { value: "UPS Next Day Air Early A.M.", label: "UPS Next Day Air Early A.M.", carrier: "UPS" },

  // FedEx
  { value: "FedEx Ground", label: "FedEx Ground", carrier: "FedEx" },
  { value: "FedEx Home Delivery", label: "FedEx Home Delivery", carrier: "FedEx" },
  { value: "FedEx Express Saver", label: "FedEx Express Saver", carrier: "FedEx" },
  { value: "FedEx 2Day", label: "FedEx 2Day", carrier: "FedEx" },
  { value: "FedEx 2Day A.M.", label: "FedEx 2Day A.M.", carrier: "FedEx" },
  { value: "FedEx Priority Overnight", label: "FedEx Priority Overnight", carrier: "FedEx" },
  { value: "FedEx Standard Overnight", label: "FedEx Standard Overnight", carrier: "FedEx" },
  { value: "FedEx First Overnight", label: "FedEx First Overnight", carrier: "FedEx" },

  // Other
  { value: "Other (see description)", label: "Other (see description)", carrier: "Other" },
];

// ---------------------------------------------------------------------------
// Calculated rate shipping services
// eBay/the carrier calculates cost from seller zip to buyer zip using weight/dims.
// FedEx calculated is generally not supported through eBay's system; USPS and UPS are.
// ---------------------------------------------------------------------------
export const CALCULATED_SHIPPING_SERVICES = [
  // USPS
  { value: "USPS Ground Advantage", label: "USPS Ground Advantage", carrier: "USPS" },
  { value: "USPS First Class Mail", label: "USPS First Class Mail", carrier: "USPS" },
  { value: "USPS Media Mail", label: "USPS Media Mail", carrier: "USPS" },
  { value: "USPS Retail Ground", label: "USPS Retail Ground", carrier: "USPS" },
  { value: "USPS Priority Mail", label: "USPS Priority Mail", carrier: "USPS" },
  { value: "USPS Priority Mail Express", label: "USPS Priority Mail Express", carrier: "USPS" },

  // UPS
  { value: "UPS Ground", label: "UPS Ground", carrier: "UPS" },
  { value: "UPS 3 Day Select", label: "UPS 3 Day Select", carrier: "UPS" },
  { value: "UPS 2nd Day Air", label: "UPS 2nd Day Air", carrier: "UPS" },
  { value: "UPS 2nd Day Air A.M.", label: "UPS 2nd Day Air A.M.", carrier: "UPS" },
  { value: "UPS Next Day Air Saver", label: "UPS Next Day Air Saver", carrier: "UPS" },
  { value: "UPS Next Day Air", label: "UPS Next Day Air", carrier: "UPS" },
];

// Carrier display order for grouping in the UI
export const CARRIER_ORDER = ["eBay", "USPS", "UPS", "FedEx", "Other"];
