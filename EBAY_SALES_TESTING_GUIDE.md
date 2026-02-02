# eBay Sales Details - Testing & Potential Issues Review

## ✅ You're Good to Test!

The SQL migration has been run, and all code has been pushed to production. Here's what to test and potential issues to watch for:

---

## 🧪 Testing Checklist

### 1. Import Sold eBay Items
- [ ] Go to Import page
- [ ] Select eBay as source
- [ ] Select "Sold" status
- [ ] Select one or more sold items
- [ ] Click "Import"
- [ ] Verify "ALREADY IMPORTED" badge appears
- [ ] **KEY: Verify "View Sales History" button appears** (not "View Inventory")
- [ ] Verify "Crosslist" button is HIDDEN for sold items
- [ ] Click "View Sales History" button
- [ ] Verify it opens the AddSale page with all eBay details populated

### 2. Check Sales History Fields
On the AddSale page (after importing a sold item):

#### Fully Displayed Fields (should be visible immediately):
- [ ] Tracking Number field
- [ ] Shipping Carrier dropdown (USPS, FedEx, UPS, DHL, Other)
- [ ] Shipped Date
- [ ] Delivery Date
- [ ] Item Condition

#### Hidden Fields (behind "Show Additional eBay Details" button):
- [ ] Click "Show Additional eBay Details" button
- [ ] Verify all fields expand:
  - [ ] Buyer Address (7 fields: name, street, apt, city, state, zip, country, phone)
  - [ ] Payment Method
  - [ ] Payment Status
  - [ ] Payment Date
  - [ ] Item Location
  - [ ] eBay Order ID
  - [ ] Buyer Username
  - [ ] Buyer Notes/Messages

### 3. Save & Persistence
- [ ] Edit some fields (e.g., add tracking number, change condition)
- [ ] Click "Update Sale"
- [ ] Reload the page
- [ ] Verify all changes persisted

### 4. Import Active eBay Items (Control Test)
- [ ] Import an active (non-sold) eBay item
- [ ] Verify "View Inventory" button still shows (NOT "View Sales History")
- [ ] Verify "Crosslist" button is visible
- [ ] Open the inventory item
- [ ] Verify eBay-specific fields are NOT shown (only shows for sold items)

---

## ⚠️ Potential Issues & Edge Cases

### 1. **Missing Data from eBay API**
**Issue**: Not all eBay transactions have complete data (e.g., older items may not have tracking info).

**Expected Behavior**:
- Fields should be empty/null if eBay doesn't provide the data
- All fields are optional and can be left blank
- No errors should occur with missing data

**What to Check**:
- Import an older sold item (e.g., from 2+ months ago)
- Verify it still imports successfully even if some fields are empty

---

### 2. **Buyer Address JSON Parsing**
**Issue**: `buyer_address` is stored as JSONB in database but edited as individual fields in UI.

**Potential Problem**:
- If the JSONB structure is malformed or unexpected, the form could crash

**Fixed**: Added null checks (`...(formData.buyer_address || {})`) to prevent spread operator errors.

**What to Check**:
- Open a sale with no buyer address
- Click "Show Additional eBay Details"
- Try typing in the buyer address fields
- Verify no console errors

---

### 3. **Date Format Inconsistencies**
**Issue**: eBay API returns dates in various formats (ISO 8601, timestamps).

**Potential Problem**:
- Date fields might not parse correctly in the date picker

**What to Check**:
- Check that `delivery_date`, `shipped_date`, `payment_date` display correctly
- If dates show as "Invalid Date", check browser console for errors

**Fix (if needed)**: May need to add date parsing logic in the backend or frontend.

---

### 4. **Multiple Quantity Sales**
**Issue**: If an item sold with quantity > 1, each sale creates a separate transaction.

**Expected Behavior**:
- Each transaction creates its own inventory item and sales record
- Each gets its own `saleId`
- Clicking "View Sales History" should open the correct individual sale

**What to Check**:
- Import an item that sold 2 copies to different buyers
- Verify 2 separate entries appear in the import list
- Click "View Sales History" on each
- Verify you see different Order IDs and buyer info

---

### 5. **eBay API Rate Limiting**
**Issue**: If user imports many sold items at once, we're making 1 `GetItemTransactions` call per transaction.

**Current Mitigation**: 
- Batches of 20 transactions with 500ms delay between batches

**What to Check**:
- Try importing 10+ sold items at once
- Monitor browser console for any API errors
- If you see rate limit errors, the batch size may need to be reduced

---

### 6. **Sales vs Inventory Page Confusion**
**Issue**: Imported sold items create BOTH an inventory record (status='sold') AND a sales record.

**Expected Behavior**:
- "View Sales History" button takes you to the SALES record (where all eBay details are)
- The inventory record exists mainly for tracking but shouldn't be the primary view for sold items

**What to Check**:
- After importing a sold item, go to Inventory page
- Find the item (filter by status='sold')
- Verify it exists but is marked as sold
- Go back to Import page and click "View Sales History"
- Verify it opens the sales record (not inventory)

---

### 7. **Shipping Carrier Dropdown**
**Issue**: eBay API returns carrier names in various formats (e.g., "USPS", "USPSPriority", "UPS Ground").

**Expected Behavior**:
- Backend extracts `ShippingCarrierUsed` field
- If it matches USPS/FedEx/UPS/DHL, select that
- Otherwise, it might be empty or show as "Other"

**What to Check**:
- Open several imported sold items
- Check if Shipping Carrier is correctly set
- If it's always empty, we may need to add parsing logic

---

### 8. **Funds Status (from previous work) Not Saved**
**Notice**: The `fundsStatus` field from the previous transaction work is NOT being saved to the database.

**Reason**: No `funds_status` column was added to the sales table.

**Action Needed (if desired)**:
- Add `funds_status TEXT` column to sales table
- Update import-items.js to save `fullItemData.fundsStatus`
- Add field to AddSale.jsx form

**Current Status**: Funds status is visible on Import page but not persisted to Sales History.

---

### 9. **Item Condition Field vs Inventory Condition**
**Issue**: We now have TWO condition fields:
1. `inventory_items.condition` (from when item was listed)
2. `sales.item_condition` (actual condition when sold)

**Expected Behavior**:
- Both fields can exist independently
- `sales.item_condition` is the one shown in Sales History

**What to Check**:
- Import a sold item with condition "New with tags"
- Open Sales History
- Verify Item Condition shows "New with tags" (or whatever eBay had)

---

### 10. **Null vs Empty String Handling**
**Issue**: Some fields may be `null` in database vs `""` (empty string) in form state.

**Fixed**: Form initialization converts nulls to empty strings for all eBay fields.

**What to Check**:
- Create a NEW sale manually (not from import)
- Set platform to eBay
- Verify all eBay fields are editable and don't have "null" text

---

## 🔍 Browser Console Checks

While testing, keep browser console open and watch for:

1. **Errors on import**:
   - Look for "Failed to create sale record" warnings
   - Check if `saleId` is returned in the response

2. **Errors on form load**:
   - Look for "Cannot read property of null" errors
   - Check date parsing errors

3. **Errors on form save**:
   - Look for database constraint violations
   - Check if buyer_address JSONB is properly formatted

---

## 🛠️ Quick Fixes (if issues arise)

### If dates don't display correctly:
Check the backend date extraction and add parsing:
```javascript
const parseEbayDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toISOString();
  } catch {
    return null;
  }
};
```

### If buyer_address causes errors:
Initialize it as an object instead of null:
```javascript
buyer_address: formData.buyer_address || { name: '', street1: '', street2: '', city: '', state: '', zip: '', country: '', phone: '' }
```

### If shipping carrier is always empty:
Add parsing logic to normalize carrier names:
```javascript
const normalizeCarrier = (carrier) => {
  if (!carrier) return null;
  const upper = carrier.toUpperCase();
  if (upper.includes('USPS')) return 'USPS';
  if (upper.includes('FEDEX')) return 'FedEx';
  if (upper.includes('UPS')) return 'UPS';
  if (upper.includes('DHL')) return 'DHL';
  return 'Other';
};
```

---

## ✅ Summary

**You're ready to test!** The implementation is solid, but edge cases around:
- Missing/incomplete data from eBay
- Date formatting
- Multiple quantity sales

...should be monitored during testing. All critical null-safety issues have been addressed.

Let me know what you find! 🚀
