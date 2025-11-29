import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow access from other devices on the network
    port: 5173, // Default Vite port
    allowedHosts: true,
    proxy: {
      // Proxy API routes to Vercel during local development
      '/api': {
        target: 'https://profit-pulse-2.vercel.app',
        changeOrigin: true,
        secure: true,
        // Log proxy errors for debugging
        onError: (err, req, res) => {
          console.error('Proxy error:', err.message);
          console.error('Requested URL:', req.url);
          console.error('If you see 404 errors, the API routes may not be deployed to Vercel yet.');
          console.error('Solution: Push your code to trigger a Vercel deployment.');
        },
        // Handle 404s more gracefully
        onProxyRes: (proxyRes, req, res) => {
          if (proxyRes.statusCode === 404) {
            console.error('API route not found:', req.url);
            console.error('This route may not be deployed to Vercel yet.');
            console.error('Please deploy your code to Vercel to make API routes available.');
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    extensions: ['.mjs', '.js', '.jsx', '.ts', '.tsx', '.json']
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
}) 