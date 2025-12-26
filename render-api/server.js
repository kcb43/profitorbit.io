/**
 * Render API Service
 * Express server for platform connections and listing job management
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import platformRoutes from './routes/platform.js';
import listingsRoutes from './routes/listings.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Request logger with request id
app.use((req, res, next) => {
  const rid = req.headers["fly-request-id"] || req.headers["x-request-id"] || "no-id";
  console.log(`➡️ ${req.method} ${req.path} rid=${rid}`);
  next();
});

// Global CORS headers (wildcard) and OPTIONS handling to keep browsers happy
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  next();
});

// CORS configuration
// Supports comma-separated origins: "https://profitorbit.io,https://profit-pulse-2.vercel.app"
// Automatically allows all .vercel.app preview domains
// Allows Chrome extension origin (restricted to specific extension ID)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// Allowed Chrome extension IDs (restrict to your extension only)
const allowedExtensionIds = new Set([
  'chrome-extension://kdnpgdiacfolpadndicmfobgdfmnkbke',
]);

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow non-browser tools like curl
  if (allowedOrigins.includes(origin)) return true;

  // allow Chrome extension origin (restricted to specific IDs)
  if (origin?.startsWith('chrome-extension://')) {
    if (allowedExtensionIds.has(origin)) return true;
    return false; // Reject unknown extension IDs
  }

  // allow all Vercel preview deploys
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    // Invalid URL, deny
  }

  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
};

// Handle preflight OPTIONS requests
app.options('*', cors(corsOptions));

// Apply CORS middleware
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  // Allow any origin to read the health endpoint (safe, no credentials)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'listing-automation-api',
  });
});

// API routes
app.use('/api/platform', platformRoutes);
app.use('/api/listings', listingsRoutes);

// 404 handler
app.use((req, res) => {
  const rid = req.headers["fly-request-id"] || req.headers["x-request-id"] || "no-id";
  console.log(`❌ 404 ${req.method} ${req.path} rid=${rid}`);
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Listing Automation API running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

