# OL'Navae Enterprise Stock Aggregator

This backend provides a multi-provider inventory search and stock status service.

## Features
- Unified search endpoint across Shopify, Commercetools, and affiliate feeds
- Cache with TTL for fast repeated queries
- Polling refresh loop to update stock status
- Webhook endpoint for real-time inventory updates
- Brand/site filtering support
- Out-of-stock demotion and explicit availability states
- Private API bearer-token mode
- Rate limiting + security headers middleware

## API
- `GET /health`
- `POST /api/inventory/search`
- `POST /webhooks/inventory`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `POST /api/auth/microsoft`
- `GET /api/auth/me`
- `GET /api/admin/users` (admin only)

### Search payload
```json
{
  "prompt": "black linen top from zara site:zara.com",
  "budget": 120,
  "brand": "zara",
  "site": "zara.com"
}
```

### Search response
```json
{
  "ok": true,
  "items": [
    {
      "id": "shopify-...",
      "name": "...",
      "availability": "In stock",
      "source": "shopify"
    }
  ]
}
```

## Run
1. Copy `.env.example` to `.env` and set provider credentials.
2. Set `API_BEARER_TOKEN` to a long random secret.
3. Install dependencies:
   - `cd server`
   - `npm install`
4. Start server:
   - `npm run dev`

Server default URL: `http://localhost:8080`

## Webhook
Send inventory updates to:
- `POST /webhooks/inventory`
- Header: `x-webhook-secret: <WEBHOOK_SHARED_SECRET>` (if configured)

Payload:
```json
{
  "id": "provider-product-id",
  "availability": "Out of stock",
  "checkedAt": "2026-04-17T12:00:00.000Z"
}
```

## Security
- Add header on every search request:
  - `Authorization: Bearer <API_BEARER_TOKEN>`
- Keep `.env` secret values out of source control.
- Auth notes:
  - Passwords are hashed with bcrypt.
  - JWT sessions are signed via `AUTH_JWT_SECRET`.
  - Optional bootstrap admin account: `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.

## Microsoft Entra (optional)
Frontend can sign in with Microsoft using Entra ID with:
- `VITE_ENTRA_CLIENT_ID`
- `VITE_ENTRA_TENANT_ID`
- `VITE_ENTRA_ADMIN_EMAILS` (comma-separated emails that should map to admin role in UI)

Backend verification for Microsoft sign-in requires:
- `ENTRA_TENANT_ID`
- `ENTRA_CLIENT_ID`
- `ENTRA_ADMIN_EMAILS` (comma-separated admin emails, enforced server-side)

Flow:
1. Frontend gets Microsoft ID token via MSAL.
2. Frontend sends ID token to `POST /api/auth/microsoft`.
3. Backend verifies token signature/issuer/audience against Entra JWKS.
4. Backend issues its own JWT session + role-enforced user profile.
