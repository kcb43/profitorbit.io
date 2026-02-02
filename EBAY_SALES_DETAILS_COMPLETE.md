# eBay Sales History Additional Fields - Implementation Complete

## Overview
Successfully added comprehensive eBay transaction details to Sales History, extracted from the eBay Trading API's `GetItemTransactions` endpoint. All fields are saved per order/transaction (same approach as sales tax and transaction fees).

---

## Fields Added to Sales History

### ✅ Fully Displayed Fields
These appear directly on the Sales History edit page:

1. **Tracking Number** - Shipment tracking number
2. **Shipping Carrier** - USPS, FedEx, UPS, DHL, or Other (dropdown)
3. **Shipped Date** - Date the item was shipped
4. **Delivery Date** - Date the item was delivered
5. **Item Condition** - Condition of the item (e.g., New, Used, Refurbished)

### 🔒 Hidden Behind "Additional eBay Details" Button
These fields are shown when the user clicks "Show Details":

1. **Buyer Address** - Complete shipping address (name, street, city, state, zip, country, phone)
2. **Payment Info**:
   - Payment Method (e.g., PayPal, Credit Card)
   - Payment Status (e.g., Paid, Pending)
   - Payment Date
3. **Item Location** - Where the item is located/shipped from
4. **eBay Identifiers**:
   - eBay Order ID
   - Buyer Username
5. **Buyer Notes/Messages** - Any messages or checkout notes from the buyer

---

## Technical Implementation

### 1. Backend API Updates

#### `api/ebay/my-listings.js`
- Enhanced XML parsing to extract all new fields from `GetItemTransactions` API
- Added parsing for:
  - `<ShippingDetails>` → tracking, carrier, delivery date
  - `<ShippedTime>` → shipped date
  - `<ConditionDisplayName>` → item condition
  - `<ShippingAddress>` → buyer address (as JSON object)
  - `<MonetaryDetails>` → payment status, method, date
  - `<Location>` → item location
  - `<BuyerCheckoutMessage>` → buyer notes
- All data merged into transaction objects using ItemID + TransactionID pairs

#### `api/ebay/import-items.js`
- Updated to accept `itemsData` parameter (full item details from Import page)
- Detects sold items (`status === 'Sold'`)
- Creates both:
  1. **Inventory item** (with status='sold')
  2. **Sales record** with all new eBay fields populated
- Maps all eBay transaction data to sales table columns

### 2. Database Schema

#### Migration: `20260202_add_ebay_sales_details.sql`
Added columns to `sales` table:
- `tracking_number` (TEXT)
- `shipping_carrier` (TEXT)
- `delivery_date` (TIMESTAMPTZ)
- `shipped_date` (TIMESTAMPTZ)
- `item_condition` (TEXT)
- `buyer_address` (JSONB) - stores full address object
- `payment_method` (TEXT)
- `payment_status` (TEXT)
- `payment_date` (TIMESTAMPTZ)
- `item_location` (TEXT)
- `buyer_notes` (TEXT)
- `ebay_order_id` (TEXT)
- `ebay_transaction_id` (TEXT)
- `ebay_buyer_username` (TEXT)

Indexes created for:
- `tracking_number`
- `ebay_order_id`
- `delivery_date`

### 3. Frontend Updates

#### `src/pages/Import.jsx`
- Modified eBay import to pass `itemsData` (full item objects) to backend
- Ensures sold items have complete transaction details for sales record creation

#### `src/pages/AddSale.jsx`
- Added all new fields to form state
- Created comprehensive UI with two sections:
  1. **Visible Section** (5 fields): Tracking, carrier, shipped/delivery dates, condition
  2. **Collapsible Section** (behind "Show Additional eBay Details" button):
     - Buyer address (7 input fields)
     - Payment info (3 fields)
     - Item location
     - eBay identifiers (Order ID, buyer username)
     - Buyer notes
- Only displays for eBay platform (`isEbay` conditional)
- All fields load properly when editing existing sales
- Clean, organized layout with proper labels and placeholders

---

## How It Works

1. **Import Flow**:
   - User selects sold items from eBay Import page
   - Clicks "Import"
   - Frontend passes full item data (including all transaction details) to `import-items` API
   - Backend creates inventory item + sales record with all eBay fields populated

2. **Edit Flow**:
   - User opens sale from Sales History page
   - AddSale page loads with all saved eBay details
   - Fully displayed fields appear immediately
   - Hidden fields accessible via "Show Additional eBay Details" button

3. **Data Source**:
   - All fields extracted via `GetItemTransactions` API (same as sales tax/fees)
   - Uses ItemID + TransactionID for accurate, per-transaction data
   - Works for all sold items, regardless of age

---

## Testing Checklist

- [ ] Import a sold eBay item → verify sales record created with all fields
- [ ] Edit an imported sale → verify all fields display correctly
- [ ] Click "Show Additional eBay Details" → verify hidden fields appear
- [ ] Save changes → verify all fields persist to database
- [ ] Test with items that have/don't have tracking info
- [ ] Test with different shipping carriers

---

## Notes

- All fields are optional (can be empty)
- Buyer address stored as JSONB for flexibility
- UI only shows eBay-specific fields when platform is eBay
- Database migration needs to be run on production: `20260202_add_ebay_sales_details.sql`
