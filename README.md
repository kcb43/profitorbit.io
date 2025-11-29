# ProfitPulse

A comprehensive inventory and sales management application with multi-platform listing capabilities.

## Features

- **Inventory Management**: Track items, prices, quantities, and sales
- **Vendoo-Style Crosslisting**: Create items once, list everywhere
  - **Unified Listing Form**: Single form for all item details
  - **Multi-Marketplace Support**: Facebook Marketplace, eBay, Mercari, Poshmark
  - **Bulk Operations**: List, delist, or relist multiple items at once
  - **Auto-Delist on Sale**: Automatically remove from other marketplaces when sold
  - **Listing Status Dashboard**: See listing status per marketplace at a glance
- **Sales Tracking**: Record sales and calculate profits
- **Reports & Analytics**: View sales history, profit charts, and performance metrics
- **Receipt Scanning**: AI-powered receipt scanning for quick inventory entry

## Running the app

```bash
npm install
npm run dev
```

## Building the app

```bash
npm run build
```

## Crosslisting System

ProfitPulse includes a complete **Vendoo-style crosslisting system** that allows you to:

1. **Create items once** using the unified listing form
2. **List everywhere** with a single click across multiple marketplaces
3. **Manage listings** from a central dashboard
4. **Auto-delist** from other marketplaces when an item sells
5. **Bulk operations** for efficient listing management

### Supported Marketplaces

- ✅ **Facebook Marketplace** - Full integration with OAuth
- ✅ **eBay** - Full integration with OAuth
- 🚧 **Mercari** - Stub ready (requires API access)
- 🚧 **Poshmark** - Stub ready (requires API access)

### Key Pages

- **Crosslist Dashboard** (`/CrosslistDashboard`) - Main dashboard showing all items and their listing status
- **Marketplace Connect** (`/MarketplaceConnect`) - Connect and manage marketplace accounts
- **Unified Listing Form** - Create items once, list everywhere

### Documentation

- [Crosslisting System Documentation](./CROSSLISTING_DOCUMENTATION.md) - Complete system architecture and API reference
- [Marketplace Setup Guides](./MARKETPLACE_SETUP_GUIDES.md) - Step-by-step setup for each marketplace
- [Database Schema](./CROSSLISTING_SCHEMA.md) - Database schema for crosslisting entities
- [Facebook Marketplace Setup](./FACEBOOK_MARKETPLACE_SETUP.md) - Detailed Facebook setup guide
- [eBay Setup](./EBAY_SETUP.md) - eBay integration setup guide

## Environment Variables

### Facebook Integration
```bash
VITE_FACEBOOK_APP_ID=your_app_id
VITE_FACEBOOK_APP_SECRET=your_app_secret
```

### eBay Integration
```bash
VITE_EBAY_CLIENT_ID=your_client_id
VITE_EBAY_CLIENT_SECRET=your_client_secret
```

## Documentation

- [Facebook Marketplace Setup Guide](./FACEBOOK_MARKETPLACE_SETUP.md)
- [eBay OAuth Setup Guide](./EBAY_OAUTH_SETUP.md)
- [eBay Setup Guide](./EBAY_SETUP.md)

For more information and support, please contact Base44 support at app@base44.com.