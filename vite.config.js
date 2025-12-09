import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // Only configure proxy during development (dev server)
  const isDev = command === 'serve';
  
  // HTTPS is disabled by default for easier local development
  // Set VITE_ENABLE_HTTPS=true to enable HTTPS (needed for Facebook OAuth testing)
  const useHttps = isDev && process.env.VITE_ENABLE_HTTPS === 'true';
  
  return {
    plugins: [
      react(),
      // HTTPS with auto-generated self-signed certificates (only if VITE_ENABLE_HTTPS=true)
      // Set VITE_ENABLE_HTTPS=true if you need to test Facebook OAuth locally
      ...(useHttps ? [basicSsl()] : [])
    ],
    server: isDev ? {
      host: '0.0.0.0', // Allow access from other devices on the network
      port: 5173, // Default Vite port
      allowedHosts: true,
      // HTTPS is handled by basicSsl plugin (if enabled)
      // Set VITE_DISABLE_HTTPS=true to use HTTP instead
      proxy: {
        // Proxy API routes to Vercel during local development
        '/api': {
          target: process.env.VITE_LOCAL_API 
            ? 'https://localhost:3000' 
            : 'https://profitorbit.io',
          changeOrigin: true,
          secure: process.env.VITE_LOCAL_API ? false : true, // Allow self-signed certs for local API
          // Log proxy errors for debugging (but only once per URL to avoid spam)
          onError: (err, req, res) => {
            // Only log if it's not a common/expected error
            if (!err.message?.includes('ECONNREFUSED') && !err.message?.includes('ENOTFOUND')) {
              console.warn('Proxy error (usually harmless):', err.message);
              console.warn('Requested URL:', req.url);
              console.warn('If this persists, the API routes may not be deployed to Vercel yet.');
            }
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
    } : undefined,
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
  };
}); 