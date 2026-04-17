# OL'Navae Enterprise Stock Aggregator

This backend provides a multi-provider inventory search and stock status service.

## Features
- Unified search endpoint across Shopify, Commercetools, and affiliate feeds
- Cache with TTL for fast repeated queries
- Polling refresh loop to update stock status
- Webhook endpoint for real-time inventory updates
- Brand/site filtering support
- Out-of-stock demotion and explicit availability states

## API
- `GET /health`
- `POST /api/inventory/search`
- `POST /webhooks/inventory`

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
2. Install dependencies:
   - `cd server`
   - `npm install`
3. Start server:
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
