# Fly.io Secrets Command for profitpulse-listing-worker

## Complete Command (Copy & Paste Ready)

```bash
fly secrets set -a profitpulse-listing-worker \
SUPABASE_URL="https://hlcwhpajorzbleavcr.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsY3docGFqb3J6YmxlYWJhdmNyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjI5ODM3OCwiZXhwIjoyMDgxODc0Mzc4fQ.CeT8Py4qR5upyy-mmdgdtzhitnCwlLpU2mguxoKWpv4" \
ENCRYPTION_KEY="88394e34ce9acf08fa7fd55d38438994bf5f882bba93d06b9cffed9cdce37e9c" \
NODE_ENV="production"
```

## Values Explained

- **SUPABASE_URL**: Your Supabase project URL
- **SUPABASE_SERVICE_ROLE_KEY**: Service role key (for admin operations, job claiming, etc.)
- **ENCRYPTION_KEY**: Encryption key for sensitive data (session payloads, etc.)
- **NODE_ENV**: Production environment

## Note

The worker does **NOT** need `CORS_ORIGIN` or `ALLOWED_ORIGINS` since it doesn't serve HTTP requests - it only processes jobs from the database.

## Optional: Playwright proxy (recommended if Mercari challenges Fly datacenter IPs)

You can route the worker's Playwright traffic through a proxy (for example, an ISP/static residential proxy) to improve reliability.

- **PLAYWRIGHT_PROXY_SERVER**: e.g. `http://host:port` (or `socks5://host:port`)
- **PLAYWRIGHT_PROXY_USERNAME**: proxy username (optional)
- **PLAYWRIGHT_PROXY_PASSWORD**: proxy password (optional)
- **PLAYWRIGHT_PROXY_BYPASS**: comma-separated domains to bypass proxy (optional)

Alternative single var:

- **PLAYWRIGHT_PROXY**: full proxy URL, e.g. `http://user:pass@host:port`

Example:

```bash
fly secrets set -a profitpulse-listing-worker \
  PLAYWRIGHT_PROXY_SERVER="http://host:port" \
  PLAYWRIGHT_PROXY_USERNAME="user" \
  PLAYWRIGHT_PROXY_PASSWORD="pass"
```

## Worker App Name

- **Fly App Name**: `profitpulse-listing-worker`
- **Worker URL**: Internal (not publicly accessible)

