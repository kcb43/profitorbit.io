# 🎯 POINT-AWARDING INTEGRATION GUIDE

## Where to Add Point-Awarding Calls

Use the helper utility (`src/utils/rewardsHelper.js`) to easily award points anywhere in your app.

---

## 📁 FILES TO MODIFY

### **1. AddSale.jsx** - Award points for sales

**Location:** `src/pages/AddSale.jsx`

**Add at top of file:**
```javascript
import { awardPoints } from '@/utils/rewardsHelper';
```

**Add after successful sale insert** (look for `supabase.from('sales').insert(...)`):
```javascript
// After sale is created successfully
const profitCents = Math.floor((sale.sale_price - sale.purchase_price) * 100);
await awardPoints.itemSold(sale.id, profitCents);
```

**Example location:** After the success toast, before closing dialog/redirecting.

---

### **2. AddInventoryItem.jsx** - Award points for adding inventory

**Location:** `src/pages/AddInventoryItem.jsx`

**Add at top:**
```javascript
import { awardPoints } from '@/utils/rewardsHelper';
```

**Add after successful inventory insert:**
```javascript
// After inventory item is created
await awardPoints.inventoryAdded(inventoryItem.id);
```

---

### **3. Crosslist.jsx / UnifiedListingForm.jsx** - Award points for listings

**Location:** `src/pages/Crosslist.jsx` or wherever listings are created

**Add at top:**
```javascript
import { awardPoints } from '@/utils/rewardsHelper';
```

**Add after successful listing creation:**
```javascript
// After listing is created
await awardPoints.listingCreated(listing.id);
```

**For crosslistings to multiple platforms:**
```javascript
// After crosslist to another platform
await awardPoints.crosslistCreated(crosslistId);
```

---

### **4. SubmitDeal.jsx** - Award points for submitting deals

**Location:** `src/pages/SubmitDeal.jsx`

**Add at top:**
```javascript
import { awardPoints } from '@/utils/rewardsHelper';
```

**Add after successful deal submission:**
```javascript
// After deal is submitted
await awardPoints.dealSubmitted(deal.id);
```

---

### **5. Deal Approval (Admin)** - Award points when deal is approved

**Location:** Wherever you approve deals (admin panel, moderation queue, etc.)

**Add at top:**
```javascript
import { awardPoints } from '@/utils/rewardsHelper';
```

**Add after deal approval:**
```javascript
// After deal is approved
const { data: deal } = await supabase
  .from('deals')
  .update({ status: 'approved' })
  .eq('id', dealId)
  .select()
  .single();

// Award points to the submitter
await awardPoints.dealApproved(dealId);
```

---

## 🔍 FINDING THE RIGHT LOCATIONS

### **Search for these patterns in your codebase:**

1. **Sales:**
   ```javascript
   // Look for:
   .from('sales').insert(
   // Or:
   .from('sales').upsert(
   ```

2. **Inventory:**
   ```javascript
   // Look for:
   .from('inventory_items').insert(
   // Or:
   .from('inventory').insert(
   ```

3. **Listings:**
   ```javascript
   // Look for:
   .from('listings').insert(
   .from('marketplace_listings').insert(
   ```

4. **Deals:**
   ```javascript
   // Look for:
   .from('deals').insert(
   ```

---

## ✅ INTEGRATION CHECKLIST

Use this checklist to track your progress:

### **Core Actions**
- [ ] **AddSale.jsx** - Award points after sale insert
- [ ] **AddInventoryItem.jsx** - Award points after inventory insert
- [ ] **Crosslist.jsx** - Award points after listing creation
- [ ] **SubmitDeal.jsx** - Award points after deal submission

### **Optional Actions**
- [ ] **Crosslist composer** - Award points for crosslistings
- [ ] **Deal approval** - Award points when admin approves deal
- [ ] **Bulk import** - Award points for bulk inventory imports
- [ ] **Receipt scanner** - Award points for scanning receipts

---

## 📝 EXAMPLE: AddSale.jsx Integration

Here's a complete example showing exactly where to add the code:

```javascript
// At the top of AddSale.jsx
import { awardPoints } from '@/utils/rewardsHelper';

// ... existing code ...

const handleSubmit = async (formData) => {
  try {
    // 1. Create the sale (your existing code)
    const { data: sale, error } = await supabase
      .from('sales')
      .insert({
        user_id: userId,
        item_name: formData.item_name,
        sale_price: formData.sale_price,
        purchase_price: formData.purchase_price,
        marketplace: formData.marketplace,
        // ... other fields
      })
      .select()
      .single();

    if (error) {
      toast.error('Failed to log sale');
      return;
    }

    // 2. Award points (NEW CODE)
    const profitCents = Math.floor((sale.sale_price - sale.purchase_price) * 100);
    await awardPoints.itemSold(sale.id, profitCents);
    // This will show: "+25 OP earned for sale! +X OP for profit"

    // 3. Show success message (your existing code)
    toast.success('Sale logged successfully!');
    
    // 4. Close dialog / redirect (your existing code)
    onClose();
    
  } catch (error) {
    console.error('Error logging sale:', error);
    toast.error('An error occurred');
  }
};
```

---

## 🎉 TESTING YOUR INTEGRATION

After adding the point-awarding calls:

1. **Create a test sale:**
   - Go to Add Sale page
   - Fill out form
   - Submit
   - ✅ You should see: "+25 OP earned for sale!" toast
   - ✅ Check `/rewards` - balance should increase

2. **Add test inventory:**
   - Go to Add Inventory page
   - Add a test item
   - ✅ You should see: "+5 OP earned for adding inventory!"
   - ✅ Check `/rewards` - balance should increase

3. **Create test listing:**
   - Create a new listing
   - ✅ You should see: "+10 OP earned for creating a listing!"
   - ✅ Check `/rewards` - balance should increase

4. **Submit test deal:**
   - Go to Submit Deal page
   - Submit a deal
   - ✅ You should see: "+15 OP earned for submitting a deal!"
   - ✅ Check `/rewards` - balance should increase

---

## 🐛 TROUBLESHOOTING

### **Points not being awarded:**

1. **Check browser console** for errors
2. **Verify API endpoint** is accessible (`/api/rewards/earn`)
3. **Check idempotency key** - must be unique per action
4. **Verify session** - user must be logged in
5. **Check Supabase** `rewards_events` table for entries

### **Duplicate points:**

- This shouldn't happen due to idempotency keys
- If it does, check that you're using unique keys:
  - ✅ Good: `listing_created:listing:${listing.id}`
  - ❌ Bad: `listing_created` (will only award once ever)

### **API 401 errors:**

- Verify Vercel environment variables are set
- Check that `SUPABASE_SERVICE_ROLE_KEY` is correct

---

## 💡 BEST PRACTICES

1. **Award points after success:**
   - Always award points AFTER the database insert succeeds
   - Don't award if insert fails

2. **Use unique idempotency keys:**
   - Format: `{action}:{sourceType}:{sourceId}`
   - Example: `listing_created:listing:abc123`

3. **Handle errors gracefully:**
   - Wrap in try/catch
   - Don't block the main flow if point-awarding fails
   - Log errors for debugging

4. **Show user feedback:**
   - The helper already shows toast notifications
   - Users love seeing "+10 OP earned!"

---

## 📊 POINTS REFERENCE

| Action | Helper Function | Points | Toast Message |
|--------|----------------|--------|---------------|
| Create listing | `awardPoints.listingCreated(id)` | +10 OP | "+10 OP earned for creating a listing!" |
| Crosslist | `awardPoints.crosslistCreated(id)` | +5 OP | "+5 OP earned for crosslisting!" |
| Add inventory | `awardPoints.inventoryAdded(id)` | +5 OP | "+5 OP earned for adding inventory!" |
| Sell item | `awardPoints.itemSold(id, profitCents)` | +25 OP + profit | "+X OP earned for sale!" |
| Submit deal | `awardPoints.dealSubmitted(id)` | +15 OP | "+15 OP earned for submitting a deal!" |
| Deal approved | `awardPoints.dealApproved(id)` | +50 OP | "+50 OP earned! Your deal was approved!" |

---

## 🎯 PRIORITY ORDER

Do these in order:

1. **AddSale.jsx** (highest impact - users log sales frequently)
2. **AddInventoryItem.jsx** (high impact - users add inventory often)
3. **Crosslist.jsx** (high impact - core feature)
4. **SubmitDeal.jsx** (medium impact - community-driven)
5. **Deal approval** (low frequency but high reward)

---

## ✨ YOU'RE DONE!

Once you've added point-awarding calls to these files:

- Users will automatically earn points
- Toast notifications will show
- Points will appear in `/rewards`
- Streaks will start tracking
- Tiers will progress

**Time to complete:** ~10 minutes for all files!

---

**Questions?** Check `COMPLETE_SUMMARY.md` or the implementation guide.
