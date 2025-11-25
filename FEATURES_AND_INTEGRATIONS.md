# ProfitPulse - Features, Plugins & APIs Roadmap

This document outlines all planned features, integrations, APIs, and plugins for ProfitPulse. It serves as a comprehensive reference for development priorities and implementation status.

## ✅ Implemented Features

### Core Features
- ✅ **Inventory Management** - Add, edit, delete inventory items
- ✅ **Sales Tracking** - Record sales with profit calculations
- ✅ **Crosslisting System** - Multi-marketplace listing management
- ✅ **eBay Integration** - Full OAuth, listing creation, category management, delisting
- ✅ **Image Editor** - Client-side editing (brightness, contrast, shadows, sharpness, crop, rotation)
- ✅ **Photo Management** - Multiple photos per listing, drag-and-drop reordering
- ✅ **General Form Template** - Master template for all marketplace forms
- ✅ **Form Sync** - Automatic syncing from General form to marketplace forms
- ✅ **Bulk Actions** - Delete, copy, mark as not listed

### eBay-Specific Features
- ✅ OAuth 2.0 authentication
- ✅ Category selection with search
- ✅ Category-specific aspects (Brand, Model/Type, Condition)
- ✅ Shipping settings with default save
- ✅ Return policy configuration
- ✅ Listing status tracking
- ✅ View listing / Delist functionality
- ✅ Token refresh management

## 🔄 In Progress / Partial

### Marketplace Integrations
- 🟡 **Etsy Integration** - Form template created, listing API pending
- 🟡 **Mercari Integration** - Form template created, listing API pending
- 🟡 **Facebook Marketplace** - Form template created, listing API pending

## 📋 Planned Features & Integrations

### 1. Receipt Scanner / OCR Integration

**Status:** Planned  
**Priority:** High  
**Estimated Cost:** $0.02-0.05 per scan

**APIs Under Consideration:**
1. **ReceiptSnap** ⭐ Recommended
   - Cost: $0.02 per scan
   - Works with screenshots
   - One-time payment, no monthly fees
   - Supports receipts, invoices, Amazon orders

2. **JsonReceipt**
   - Cost: $0.04-0.05 per receipt
   - Credits never expire
   - Good accuracy

3. **ReceiptOCR.app**
   - Cost: ~$0.05-0.08 per receipt
   - Pay-as-you-go model

**Features:**
- Upload receipt/invoice screenshots
- Extract line items, prices, dates
- Auto-populate inventory with purchase data
- Support for Amazon order screenshots
- Manual correction interface
- Batch processing

**Implementation Notes:**
- Market generically as "Receipt & Invoice Scanner"
- Avoid specifically mentioning Amazon to prevent ToS issues
- Add user disclaimer about permissions

---

### 2. AI Description Generation

**Status:** Planned  
**Priority:** High  
**Estimated Cost:** $0.00085 per generation (GPT-5 Nano)

**API:** OpenAI GPT-5 Nano (recommended for cost efficiency)

**Features:**
- Generate 5 description variations
- Use item title, brand, category as context
- Learn from similar listings
- Tone/style customization
- SEO optimization suggestions
- Bulk generation for multiple items

**Integration Points:**
- Description Generator button on all marketplace forms
- Generate button in Inventory page
- Batch generation for crosslisted items

---

### 3. Additional Marketplace Integrations

#### 3.1 Etsy Integration
**Status:** Form template ready, API integration pending

**Required APIs:**
- Etsy OAuth 2.0
- Create Listing API
- Update Listing API
- Get Shop Listings API
- Delete Listing API

**Features:**
- Shop selection
- Category mapping
- Tags/sections
- Shipping profiles
- Variations support

#### 3.2 Mercari Integration
**Status:** Form template ready, API integration pending

**Required APIs:**
- Mercari Seller API (if available)
- Alternative: Web scraping automation (with ToS compliance)

**Features:**
- Listing creation
- Price management
- Shipping options
- Condition mapping

#### 3.3 Facebook Marketplace Integration
**Status:** Form template ready, API integration pending

**Required APIs:**
- Facebook Graph API
- Marketplace API endpoints

**Features:**
- Post creation
- Location-based listing
- Category selection
- Group posting support

---

### 4. Advanced Image Features

**Status:** Basic editor implemented, enhancements planned

**Additional Features:**
- 📸 **Batch image processing** - Apply edits to multiple images
- 🎨 **Presets** - Save and apply filter presets
- 🔄 **Undo/Redo** - Edit history management
- 💾 **Image compression** - Optimize file sizes for faster uploads
- 🏷️ **Watermarking** - Add custom watermarks/brands
- 📐 **Auto-crop suggestions** - AI-powered crop recommendations
- 🖼️ **Background removal** - Remove/change backgrounds (API integration needed)

**APIs to Consider:**
- Remove.bg API - Background removal (~$0.02/image)
- Cloudinary - Advanced image processing
- Imgix - Image optimization and transformation

---

### 5. Analytics & Reporting

**Status:** Basic sales history exists, advanced analytics pending

**Features:**
- 📊 **Profit Analytics Dashboard**
  - Total profit, ROI calculations
  - Profit by marketplace
  - Profit by category
  - Monthly/yearly trends
  - Best/worst performing items

- 📈 **Sales Performance**
  - Sales velocity tracking
  - Average days to sell
  - Price optimization suggestions
  - Seasonality insights

- 📉 **Cost Analysis**
  - COGS tracking
  - Fees calculator
  - Net profit margins
  - Tax preparation reports

- 🎯 **Inventory Insights**
  - Aging inventory reports
  - Inventory value tracking
  - Turnover rates
  - Restock recommendations

**Tools/APIs:**
- Chart.js or Recharts for visualizations
- Custom analytics engine
- Export to CSV/PDF

---

### 6. Price Optimization & Suggestions

**Status:** Planned

**Features:**
- 💰 **Competitive Pricing**
  - Scan competitor prices
  - Suggest optimal listing price
  - Price tracking over time

- 🤖 **AI Price Recommendations**
  - ML-based price suggestions
  - Consider condition, market trends
  - Dynamic pricing suggestions

- 📊 **Price History**
  - Track price changes
  - A/B test different prices
  - Best time to list/price drop alerts

**APIs to Consider:**
- eBay Pricing API (if available)
- Terapeak / Sold items data
- Custom price tracking system

---

### 7. Inventory Features

**Status:** Basic inventory exists, enhancements planned

**Features:**
- 📦 **Bulk Import/Export**
  - CSV import/export
  - Template downloads
  - Batch operations

- 🏷️ **Advanced Tagging**
  - Custom labels
  - Tag-based filtering
  - Smart collections

- 📍 **Location Tracking**
  - Storage location (shelf, bin, box)
  - Multiple storage locations
  - Location-based search

- 🔔 **Low Stock Alerts**
  - Restock notifications
  - Inventory value alerts
  - Aging inventory warnings

- 📸 **Barcode/QR Scanning**
  - Scan to add items
  - Quick inventory lookup
  - Mobile app integration (future)

**APIs/Tools:**
- QuaggaJS or ZXing for barcode scanning (client-side)
- Camera API for mobile scanning

---

### 8. Shipping & Label Integration

**Status:** Planned

**Features:**
- 📦 **Label Printing**
  - ShipStation integration
  - Pirate Ship integration
  - USPS/FedEx/UPS APIs
  - Buy shipping labels directly

- 📏 **Package Details**
  - Weight/dimension calculator
  - Shipping cost estimator
  - Multi-package support

- 📋 **Shipping Templates**
  - Save common shipping settings
  - Apply to multiple listings

**APIs to Consider:**
- ShipStation API
- EasyShip API
- USPS API
- FedEx API
- UPS API

---

### 9. Search & Discovery

**Status:** Basic search exists, enhancements planned

**Features:**
- 🔍 **Advanced Search**
  - Filter by marketplace, status, tags
  - Saved searches
  - Search history

- 🔎 **eBay Sold Items Search**
  - Already implemented in AddInventoryItem
  - Extend to crosslisting page
  - Price history analysis

- 🎯 **Smart Suggestions**
  - Similar items recommendations
  - "You might also list" suggestions
  - Category suggestions based on title

---

### 10. Automation & Workflows

**Status:** Planned

**Features:**
- ⚙️ **Listing Templates**
  - Save and reuse listing templates
  - Apply templates to multiple items
  - Template marketplace-specific settings

- 🔄 **Auto-Relist**
  - Automatic relisting on marketplace
  - Price adjustment options
  - Time-based relisting

- 📧 **Notifications**
  - Email/SMS notifications
  - Listing status updates
  - Sales notifications
  - Low inventory alerts

- 🤖 **Auto-Pricing**
  - Rule-based price updates
  - Market-based adjustments
  - Scheduled price changes

**Tools:**
- Zapier / Make.com integration (future)
- Custom workflow engine
- Webhook support

---

### 11. Mobile App Features

**Status:** Future consideration

**Features:**
- 📱 **Native Mobile App**
  - iOS/Android apps
  - Quick item addition
  - Camera integration for photos
  - Barcode scanning
  - Push notifications

- 📸 **Mobile-First Features**
  - Quick photo capture
  - Voice-to-text descriptions
  - Location-based listings
  - Mobile checkout (if applicable)

**Technology:**
- React Native or Flutter
- PWA enhancements first (lower priority)

---

### 12. Integrations & Partnerships

**Status:** Planned

**Features:**
- 🔗 **Accounting Software Integration**
  - QuickBooks integration
  - Xero integration
  - Tax preparation exports

- 📊 **Analytics Platforms**
  - Google Analytics
  - Mixpanel / Amplitude
  - Custom event tracking

- 💳 **Payment Processing**
  - Stripe integration
  - PayPal integration
  - Subscription management

- 📧 **Email Services**
  - SendGrid / Mailgun
  - Transactional emails
  - Marketing emails

- 🔐 **Authentication**
  - Social login (Google, Facebook)
  - Two-factor authentication
  - SSO for teams

---

### 13. Team & Collaboration Features

**Status:** Future consideration

**Features:**
- 👥 **Multi-User Support**
  - Team accounts
  - Role-based permissions
  - Activity logs

- 💬 **Comments & Notes**
  - Item-level notes
  - Team collaboration
  - Task assignment

- 📈 **Team Analytics**
  - Per-user performance
  - Team profit reports
  - Individual contributions

---

### 14. Security & Compliance

**Status:** Ongoing

**Features:**
- 🔒 **Data Encryption**
  - End-to-end encryption for sensitive data
  - Secure token storage
  - PCI compliance (if handling payments)

- 📋 **GDPR Compliance**
  - Data export
  - Right to deletion
  - Privacy controls

- 🔐 **Security Features**
  - Rate limiting
  - IP whitelisting
  - Suspicious activity detection
  - Audit logs

---

### 15. Performance & Optimization

**Status:** Ongoing

**Optimizations:**
- ⚡ **Caching**
  - API response caching
  - Image CDN
  - Static asset optimization

- 🚀 **Performance**
  - Lazy loading
  - Code splitting
  - Image optimization
  - Database query optimization

- 📱 **Mobile Performance**
  - Progressive Web App (PWA)
  - Offline support
  - Reduced bundle size

---

## Priority Roadmap

### Phase 1 (Immediate - Next 1-2 Months)
1. ✅ Image Editor (DONE)
2. 🔄 Receipt Scanner/OCR Integration
3. 🔄 AI Description Generation
4. 🔄 Complete Etsy Integration

### Phase 2 (Short-term - 3-4 Months)
5. Complete Mercari Integration
6. Complete Facebook Marketplace Integration
7. Advanced Analytics Dashboard
8. Bulk Import/Export

### Phase 3 (Medium-term - 5-6 Months)
9. Price Optimization Tools
10. Shipping Label Integration
11. Automation & Workflows
12. Mobile App (PWA first)

### Phase 4 (Long-term - 6+ Months)
13. Native Mobile Apps
14. Team Collaboration Features
15. Advanced Integrations (QuickBooks, etc.)

---

## Cost Estimates Summary

| Feature | Monthly Cost (400 users) | Notes |
|---------|-------------------------|-------|
| Receipt Scanner | $10-15 | ReceiptSnap recommended |
| AI Descriptions | $2-5 | GPT-5 Nano |
| Image Processing APIs | $0-20 | Optional, for advanced features |
| Shipping APIs | $0-30 | Pay-per-use |
| Analytics Tools | $0-25 | Free tiers available |
| **Total Variable** | **$12-95/month** | Depends on usage |

---

## API Keys & Credentials Needed

### Current (Implemented)
- ✅ eBay Client ID / Secret / Dev ID
- ✅ eBay OAuth tokens (user-level)

### Needed for Planned Features
- 🔑 ReceiptSnap API Key (for receipt scanning)
- 🔑 OpenAI API Key (for AI descriptions)
- 🔑 Etsy API Keys (for Etsy integration)
- 🔑 Mercari API Keys (if available)
- 🔑 Facebook App ID / Secret (for Facebook Marketplace)
- 🔑 ShipStation API (optional, for shipping)
- 🔑 Remove.bg API (optional, for background removal)

---

## Notes & Considerations

1. **Legal Considerations:**
   - Receipt scanner marketed generically (not Amazon-specific)
   - Marketplace API compliance
   - User data privacy

2. **Cost Management:**
   - Monitor API usage per user
   - Set usage limits on free tier
   - Caching to reduce API calls

3. **Performance:**
   - Client-side processing where possible (image editing)
   - Server-side for sensitive operations
   - CDN for static assets

4. **User Experience:**
   - Mobile-first design
   - Fast load times
   - Intuitive workflows
   - Helpful error messages

---

## Last Updated
**Date:** 2025-01-27  
**Version:** 1.0  
**Status:** Active planning document

