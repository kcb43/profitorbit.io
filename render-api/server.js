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
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((o) => o.trim())
  : ['https://profitorbit.io'];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
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

