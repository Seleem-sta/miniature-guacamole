import dotenv from 'dotenv';

dotenv.config();

function required(key: string, fallback = ''): string {
  const value = process.env[key] ?? fallback;
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? 8080),
  allowedOrigin: required('ALLOWED_ORIGIN', 'http://localhost:5175'),
  apiBearerToken: required('API_BEARER_TOKEN', ''),
  cacheTtlMs: Number(process.env.CACHE_TTL_MS ?? 120_000),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  webhookSharedSecret: required('WEBHOOK_SHARED_SECRET', ''),
  shopify: {
    domain: required('SHOPIFY_STORE_DOMAIN'),
    token: required('SHOPIFY_STOREFRONT_TOKEN'),
  },
  commercetools: {
    projectKey: required('COMMERCETOOLS_PROJECT_KEY'),
    clientId: required('COMMERCETOOLS_CLIENT_ID'),
    clientSecret: required('COMMERCETOOLS_CLIENT_SECRET'),
    authUrl: required('COMMERCETOOLS_AUTH_URL'),
    apiUrl: required('COMMERCETOOLS_API_URL'),
  },
  affiliateFeedUrl: required('AFFILIATE_FEED_URL'),
};
