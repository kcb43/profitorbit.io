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

// CORS configuration
// Supports comma-separated origins: "https://profitorbit.io,https://profit-pulse-2.vercel.app"
// Automatically allows all .vercel.app preview domains
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // allow non-browser tools like curl
  if (allowedOrigins.includes(origin)) return true;

  // allow all Vercel preview deploys
  try {
    const url = new URL(origin);
    if (url.hostname.endsWith('.vercel.app')) return true;
  } catch {
    // Invalid URL, deny
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS: ' + origin));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
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

