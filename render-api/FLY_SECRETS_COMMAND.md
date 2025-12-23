# Fly.io Secrets Command for profitorbit-api

## ✅ Updated: server.js now uses CORS_ORIGIN

The server.js has been updated to use `CORS_ORIGIN` instead of `ALLOWED_ORIGINS` for consistency.

## Complete Command (Copy & Paste Ready)

**Note:** The command uses `CORS_ORIGIN` (not `ALLOWED_ORIGINS`) to match the updated server.js.

```bash
fly secrets set -a profitorbit-api \
SUPABASE_URL="https://hlcwhpajorzbleavcr.supabase.co" \
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3docGFqb3J6YmxlYWJhdmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyOTgzNzgsImV4cCI6MjA4MTg3NDM3OH0.FZWsHA6dRmG77rSes08oThKN1HfpicB8If7EeKC3kqM" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3docGFqb3J6YmxlYWJhdmNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5ODM3OCwiZXhwIjoyMDgxODc0Mzc4fQ.CeT8Py4qR5upyy-mmdgdtzhitnCwlLpU2mguxoKWpv4" \
ENCRYPTION_KEY="88394e34ce9acf08fa7fd55d38438994bf5f882bba93d06b9cffed9cdce37e9c" \
CORS_ORIGIN="https://profitorbit.io,https://profit-pulse-2.vercel.app" \
NODE_ENV="production"
```

### If you only want production domain:

```bash
fly secrets set -a profitorbit-api \
SUPABASE_URL="https://hlcwhpajorzbleavcr.supabase.co" \
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3docGFqb3J6YmxlYWJhdmNyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYyOTgzNzgsImV4cCI6MjA4MTg3NDM3OH0.FZWsHA6dRmG77rSes08oThKN1HfpicB8If7EeKC3kqM" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3docGFqb3J6YmxlYWJhdmNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5ODM3OCwiZXhwIjoyMDgxODc0Mzc4fQ.CeT8Py4qR5upyy-mmdgdtzhitnCwlLpU2mguxoKWpv4" \
ENCRYPTION_KEY="88394e34ce9acf08fa7fd55d38438994bf5f882bba93d06b9cffed9cdce37e9c" \
CORS_ORIGIN="https://profitorbit.io" \
NODE_ENV="production"
```

## Values Explained

- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_ANON_KEY**: Public anon key (for JWT verification and supabase-js calls)
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key (for admin operations)
- **ENCRYPTION_KEY**: Encryption key for sensitive data
- **CORS_ORIGIN**: Comma-separated list of allowed origins (supports both prod and vercel)
- **NODE_ENV**: Production environment

## Domain Information

- **Primary Domain**: `https://profitorbit.io`
- **Vercel Preview Domain**: `https://profit-pulse-2.vercel.app`
- **API URL**: `https://profitorbit-api.fly.dev`

## Note

The server.js now reads from `CORS_ORIGIN` and supports comma-separated values, so both production and Vercel preview domains work.
