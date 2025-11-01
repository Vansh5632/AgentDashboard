# CORS Configuration Guide

## Overview

This guide explains how CORS (Cross-Origin Resource Sharing) is configured in this application and how to troubleshoot common issues.

## How CORS is Configured

### 1. Server Configuration (`apps/api/server.ts`)

The API server uses the `cors` package with the following configuration:

```typescript
const corsOptions = {
  origin: function(origin, callback) {
    // Dynamic origin validation
  },
  credentials: true,              // Allow cookies/auth headers
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400,                  // Cache preflight for 24 hours
  preflightContinue: false,       // Don't pass OPTIONS to next handler
  optionsSuccessStatus: 204       // Success status for OPTIONS
};
```

### 2. Environment-Based Origin Control

#### Development Mode (NODE_ENV != 'production')
- If `CORS_ORIGINS` is NOT set: **All origins are allowed** (for easier local development)
- If `CORS_ORIGINS` is set: Only specified origins are allowed

#### Production Mode (NODE_ENV = 'production')
- `CORS_ORIGINS` **must be set** with your frontend URL(s)
- Only specified origins are allowed
- Example: `CORS_ORIGINS=https://web-production-af51.up.railway.app`

### 3. Client Configuration (`apps/web/lib/api.ts`)

The frontend API client is configured with:

```typescript
const api = axios.create({
  baseURL: `${API_URL}/api`,
  withCredentials: true,  // Important for CORS with credentials
  timeout: 30000
});
```

## Environment Variables

### API Service (`apps/api`)

```bash
# Required in production
NODE_ENV=production
CORS_ORIGINS=https://your-frontend-domain.com,https://another-domain.com

# Optional in development (defaults to allow all origins)
# CORS_ORIGINS=http://localhost:3000
```

**Important Notes:**
- URLs must match **exactly** (no trailing slashes)
- Multiple origins separated by commas
- No spaces around commas
- Protocol (http/https) must match

### Web Service (`apps/web`)

```bash
# Must point to your API server (no /api, no trailing slash)
NEXT_PUBLIC_API_URL=https://api-production-8446.up.railway.app

# For local development
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Common CORS Issues and Solutions

### Issue 1: "No 'Access-Control-Allow-Origin' header"

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

**Solutions:**

1. **Check CORS_ORIGINS in API service**
   ```bash
   # In Railway API service settings, verify:
   CORS_ORIGINS=https://web-production-af51.up.railway.app
   ```

2. **Verify exact URL match**
   - No trailing slash: ✅ `https://example.com`
   - With trailing slash: ❌ `https://example.com/`
   - Wrong protocol: ❌ `http://example.com` (when using https)

3. **Check API server logs**
   ```
   ❌ CORS: Blocking origin: https://your-domain.com
      Allowed origins: https://other-domain.com
   ```

### Issue 2: Preflight (OPTIONS) Request Failing

**Symptoms:**
- OPTIONS request returns 4xx or 5xx status
- Actual request never sent

**Solutions:**

1. **Ensure CORS middleware is first**
   - The CORS middleware must be applied before routes
   - Already configured correctly in this app ✅

2. **Check for route conflicts**
   - Make sure no routes explicitly handle OPTIONS
   - This app automatically handles OPTIONS ✅

### Issue 3: "Credentials flag is true, but the 'Access-Control-Allow-Credentials' header is ''"

**Symptoms:**
- Requests fail when trying to send authentication tokens
- Browser blocks requests with credentials

**Solutions:**

1. **Verify `withCredentials: true` in client**
   - Already configured in `apps/web/lib/api.ts` ✅

2. **Verify `credentials: true` in server**
   - Already configured in `apps/api/server.ts` ✅

3. **Cannot use wildcard with credentials**
   - Must specify exact origins (not `*`)
   - This app uses exact origin matching ✅

### Issue 4: Local Development CORS Issues

**Symptoms:**
- Works in production but fails locally
- Or works locally but fails in production

**Solutions:**

1. **For Local Development:**
   ```bash
   # In your local .env file (or leave empty):
   # CORS_ORIGINS=   # Empty = allow all in dev mode
   
   # Or explicitly set:
   CORS_ORIGINS=http://localhost:3000
   
   # Make sure NODE_ENV is NOT set to 'production'
   ```

2. **Use the correct local URLs:**
   - Frontend: `http://localhost:3000`
   - API: `http://localhost:3001`
   - Not `127.0.0.1` (different origin)

### Issue 5: Railway Deployment Issues

**Symptoms:**
- Works locally but fails after deploying to Railway

**Solutions:**

1. **Set CORS_ORIGINS in Railway API Service:**
   ```bash
   CORS_ORIGINS=https://web-production-XXXX.up.railway.app
   ```

2. **Set NEXT_PUBLIC_API_URL in Railway Web Service:**
   ```bash
   NEXT_PUBLIC_API_URL=https://api-production-XXXX.up.railway.app
   ```

3. **Get exact URLs from Railway:**
   - Click on service → Settings → Domains
   - Copy the full URL (including https://)
   - **Do not include trailing slash or /api path**

4. **Trigger rebuild after changing env vars:**
   - Railway auto-redeploys when env vars change
   - Or manually trigger rebuild

## Testing CORS Configuration

### 1. Test with curl

```bash
# Test preflight request
curl -X OPTIONS \
  -H "Origin: https://your-frontend-domain.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type,Authorization" \
  -v https://your-api-domain.com/api/auth/login

# Look for these headers in response:
# < access-control-allow-origin: https://your-frontend-domain.com
# < access-control-allow-credentials: true
# < access-control-allow-methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
# < access-control-max-age: 86400
```

### 2. Test actual request

```bash
# Test actual API request
curl -X POST \
  -H "Origin: https://your-frontend-domain.com" \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}' \
  -v https://your-api-domain.com/api/auth/login

# Should see:
# < access-control-allow-origin: https://your-frontend-domain.com
# < access-control-allow-credentials: true
```

### 3. Test from Browser Console

```javascript
// Open your frontend in browser, then run in console:
fetch('https://your-api-domain.com/api/health', {
  method: 'GET',
  headers: { 'Content-Type': 'application/json' },
  credentials: 'include'
})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);

// Should return: { status: "ok" }
```

### 4. Check Server Logs

The server logs show CORS decisions:

```
✅ CORS: Allowing origin: https://web-production-af51.up.railway.app
[2025-10-31T...] OPTIONS /api/auth/signup - Origin: https://web-production-af51.up.railway.app
[2025-10-31T...] POST /api/auth/signup - Origin: https://web-production-af51.up.railway.app
```

Or if blocked:

```
❌ CORS: Blocking origin: https://unknown-domain.com
   Allowed origins: https://web-production-af51.up.railway.app
```

## Best Practices

### 1. ✅ DO

- Set explicit origins in production (`CORS_ORIGINS`)
- Use environment variables for configuration
- Test CORS after deployment
- Keep URLs consistent (always https in production)
- Monitor server logs for CORS issues
- Use exact URL matches (no wildcards in production)

### 2. ❌ DON'T

- Use `*` (wildcard) with credentials
- Include trailing slashes in CORS_ORIGINS
- Mix http and https protocols
- Hardcode URLs in application code
- Forget to set CORS_ORIGINS in production
- Use `127.0.0.1` and `localhost` interchangeably

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (https://web-production-af51.up.railway.app)        │
│                                                              │
│  1. User action triggers API call                           │
│  2. Browser sends OPTIONS preflight (if needed)             │
│     Origin: https://web-production-af51.up.railway.app      │
│                                                              │
│  3. Browser checks CORS headers in response                 │
│  4. If OK, sends actual request (GET, POST, etc.)           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   │ HTTP Request with Origin header
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ API Server (https://api-production-8446.up.railway.app)     │
│                                                              │
│  CORS Middleware (apps/api/server.ts)                       │
│  ├─ Checks Origin header                                    │
│  ├─ Validates against CORS_ORIGINS env var                  │
│  ├─ Sets Access-Control-Allow-* headers                     │
│  └─ Allows/blocks request                                   │
│                                                              │
│  Routes (auth, calls, meetings, etc.)                       │
│  └─ Process request if CORS check passed                    │
└─────────────────────────────────────────────────────────────┘
```

## Debugging Checklist

When CORS issues occur, check in this order:

- [ ] Is `CORS_ORIGINS` set in API service? (use `echo $CORS_ORIGINS`)
- [ ] Does `CORS_ORIGINS` **exactly** match the frontend URL?
- [ ] Is `NEXT_PUBLIC_API_URL` set correctly in web service?
- [ ] Are both services using the same protocol (both https)?
- [ ] Are there any typos in the URLs?
- [ ] Do the server logs show the CORS decision?
- [ ] Does the browser Network tab show OPTIONS and actual request?
- [ ] Are the CORS headers present in the response?
- [ ] Is the browser caching an old CORS failure? (try incognito)
- [ ] Did Railway rebuild after env var changes?

## Quick Fixes

### Force Development Mode (Allow All Origins)
```bash
# In API service
unset CORS_ORIGINS
NODE_ENV=development
```

### Force Production Mode (Strict Origins)
```bash
# In API service
NODE_ENV=production
CORS_ORIGINS=https://your-exact-frontend-url.com
```

### Clear Browser CORS Cache
```bash
# Chrome/Edge
1. Open DevTools → Network tab
2. Check "Disable cache"
3. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

# Or use Incognito/Private mode
```

## Support

If CORS issues persist after following this guide:

1. **Check server logs** in Railway for CORS messages
2. **Check browser console** for exact error message
3. **Use curl tests** to isolate frontend vs backend issues
4. **Verify environment variables** are set correctly in Railway dashboard

---

**Last Updated:** November 1, 2025  
**Version:** 2.0
