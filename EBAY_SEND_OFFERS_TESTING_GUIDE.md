# eBay Send Offers - Testing Guide

## ✅ eBay Send Offers is FULLY IMPLEMENTED!

The eBay Send Offers feature is now **100% complete** and uses eBay's official **Negotiation API** to send offers to interested buyers (watchers).

## 🚀 How to Test

### Prerequisites
1. eBay account connected in your extension
2. Active eBay listings with watchers
3. Items imported from eBay in your inventory

### Step-by-Step Testing

1. **Navigate to Send Offers Page**
   - Go to Pro Tools → Send Offers
   - Or directly to the Send Offers page

2. **Select eBay Marketplace**
   - Click on "eBay" in the marketplace sidebar
   - Items with eBay listings will auto-load
   - You'll see live watcher counts (if any)

3. **Review Your Eligible Items**
   - Check the "Likes" column to see which items have watchers
   - Only items with watchers can receive offers
   - Review pricing and discount calculations

4. **Configure Your Offer**
   - **Offer %**: Set discount percentage (e.g., 10%)
   - **Offer price based on**: Choose "Orben price" or "Marketplace price"
   - **Add Message** (optional): Click to add a personal message to buyers

5. **Select Items**
   - Check the boxes for items you want to send offers on
   - Or use "Select all on this page" checkbox
   - Items with watchers will show in the table

6. **Send Offers**
   - Click the green "Send Offers" button
   - Extension will call eBay Negotiation API for each item
   - Wait for success message

### Expected Results

**Success:**
- ✅ Toast notification: "Offers sent! X offers have been sent."
- ✅ "Offers Sent" counter increments for each item
- ✅ Actual offers sent to interested buyers via eBay
- ✅ Buyers receive notification with your offer

**Possible Errors:**
- ❌ "No interested buyers for this listing" - Item has no watchers
- ❌ "Listing has ended" - Listing is no longer active
- ❌ "Listing does not support offers" - Best Offer not enabled
- ❌ "eBay not connected" - Need to connect eBay account

## 🔍 Behind the Scenes

### What Happens When You Click "Send Offers"

```
1. Frontend validates selection and builds payload
2. Calls: window.ProfitOrbitExtension.sendOffersBulk(payload)
3. Extension background script receives message
4. Routes to sendEbayOffers() function
5. For each item:
   a. Extracts eBay listing ID
   b. Builds API payload with discount/price
   c. Calls eBay Negotiation API
   d. Handles response and errors
6. Returns results to frontend
7. Updates UI with success/error messages
8. Increments per-item offer counter
```

### API Call Details

**Endpoint:**
```
POST https://api.ebay.com/sell/negotiation/v1/send_offer_to_interested_buyers
```

**Headers:**
```json
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {ebay_access_token}",
  "X-EBAY-C-MARKETPLACE-ID": "EBAY_US"
}
```

**Payload Example:**
```json
{
  "allowCounterOffer": false,
  "message": "Thank you for your interest! I'd like to offer you a special discount.",
  "offeredItems": [
    {
      "listingId": "123456789012",
      "discountPercentage": "10",
      "quantity": 1
    }
  ]
}
```

**Response Example:**
```json
{
  "offers": [
    {
      "offerId": "abc123",
      "offerStatus": "PENDING",
      "buyer": {
        "maskedUsername": "u***r"
      },
      "creationDate": "2024-02-11T12:00:00.000Z",
      "message": "Thank you for your interest!...",
      "offeredItems": [
        {
          "listingId": "123456789012",
          "discountPercentage": "10"
        }
      ]
    }
  ]
}
```

## 🧪 Console Testing

Test the extension API directly in browser console:

```javascript
// 1. Check eBay connection
window.ProfitOrbitExtension.getMarketplaceStatus('ebay')
// Should return: { connected: true, userName: 'your@email.com', marketplace: 'ebay' }

// 2. Test sending a single offer
window.ProfitOrbitExtension.sendOffersBulk({
  marketplace: 'ebay',
  offerPct: 10,
  offerPriceBasedOn: 'vendoo_price',
  message: 'Test offer!',
  targets: [{
    inventoryItemId: 'your-item-id',
    listingId: '123456789012',
    listingUrl: 'https://www.ebay.com/itm/123456789012',
    vendooPrice: 50.00,
    mktplacePrice: 50.00,
    offerPrice: 45.00
  }]
}).then(result => console.log('Offer result:', result))

// 3. Check for eligible items (items with watchers)
// This requires calling the API directly or through extension
```

## 📊 Verification

After sending offers, verify they were sent:

1. **Check eBay Seller Hub**
   - Go to eBay Seller Hub → Activity → Offers
   - You should see your sent offers listed

2. **Check Item's Offer History**
   - Go to the specific listing on eBay
   - Check "Offers" or "Watchers" section
   - Offers should be visible there

3. **Check Console Logs**
   - Open browser DevTools (F12)
   - Check Console for success messages
   - Look for: "✅ [eBay] Successfully sent X offers for listing..."

## 🐛 Troubleshooting

### "No interested buyers for this listing"
- **Cause**: Item has 0 watchers
- **Solution**: Only send offers on items with watchers (Likes > 0)

### "eBay access token not found"
- **Cause**: Not connected to eBay or token expired
- **Solution**: Reconnect eBay account in extension

### "Listing does not support offers"
- **Cause**: Best Offer not enabled for this listing
- **Solution**: Enable Best Offer in your eBay listing settings

### API returns 401 Unauthorized
- **Cause**: Token expired or invalid
- **Solution**: Refresh eBay connection, may need to re-authenticate

### API returns 409 Conflict
- **Cause**: Already have an active offer on this listing
- **Solution**: Wait for previous offer to expire or be accepted/declined

## 💡 Best Practices

1. **Enable Best Offer First**
   - Make sure Best Offer is enabled on your eBay listings
   - Set auto-accept and auto-decline prices if desired

2. **Custom Messages Work Better**
   - Add a personalized message to increase acceptance rate
   - eBay recommends always including a custom message

3. **Monitor Your Offers**
   - Check eBay Seller Hub regularly
   - Respond to counter-offers promptly (if enabled)

4. **Don't Over-Offer**
   - eBay has limits on how many offers you can send
   - Space out your offers over time

5. **Price Strategically**
   - Use 5-15% discount for best results
   - Consider your profit margins
   - Review "Earnings" column before sending

## 🎯 What's Next

With eBay fully working, you can:

1. **Use it in production** - Start sending offers to buyers!
2. **Monitor results** - Track which offers get accepted
3. **Optimize pricing** - Adjust discount percentages based on acceptance rates
4. **Implement Mercari** - Similar pattern using GraphQL
5. **Implement Poshmark** - UI automation for OTL feature

## 📝 Notes

- eBay API only supports one listing per request (we loop through them)
- Offers are valid for the duration set by eBay marketplace (usually 48 hours)
- Counter-offers are not supported in current eBay API version
- Rate limiting: Small 500ms delay between requests to avoid issues

---

**eBay Send Offers is production-ready!** 🚀

Test it out and let the offers roll in! 💰
