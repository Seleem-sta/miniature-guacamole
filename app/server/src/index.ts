import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { StockCache } from './cache/stockCache.js';
import { config } from './config.js';
import { AggregatorService } from './aggregatorService.js';
import { CommercetoolsProvider } from './providers/commercetools.js';
import { ShopifyProvider } from './providers/shopify.js';
import { AffiliateFeedProvider } from './providers/affiliateFeed.js';
import { startPolling } from './polling/scheduler.js';
import { registerWebhookRoutes } from './webhooks/routes.js';
import { registerAuthRoutes } from './auth/routes.js';

const app = express();
const cache = new StockCache(config.cacheTtlMs);

const providers = [
  new ShopifyProvider(),
  new CommercetoolsProvider(),
  new AffiliateFeedProvider(),
];

const service = new AggregatorService(providers, cache);

function safeEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) return false;
  return timingSafeEqual(leftBuf, rightBuf);
}

function requirePrivateApiToken(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!config.apiBearerToken) {
    next();
    return;
  }

  const header = String(req.headers.authorization ?? '');
  const expected = `Bearer ${config.apiBearerToken}`;
  if (!header || !safeEquals(header, expected)) {
    res.status(401).json({ ok: false, message: 'Unauthorized.' });
    return;
  }

  next();
}

const searchRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many requests. Try again in a minute.' },
});

app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: config.allowedOrigin, methods: ['GET', 'POST'], optionsSuccessStatus: 204 }));
app.use(express.json({ limit: '2mb' }));

const searchSchema = z.object({
  prompt: z.string().min(1),
  budget: z.number().nullable(),
  brand: z.string().optional(),
  site: z.string().optional(),
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'olnavae-stock-aggregator' });
});

app.post('/api/inventory/search', searchRateLimiter, requirePrivateApiToken, async (req, res) => {
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: 'Invalid search payload.' });
    return;
  }

  try {
    const items = await service.search(parsed.data);
    res.json({ ok: true, items });
  } catch {
    res.status(500).json({ ok: false, message: 'Inventory search failed.' });
  }
});

const router = express.Router();
registerWebhookRoutes(router, cache);
registerAuthRoutes(router);
app.use(router);

startPolling(providers, cache, config.pollIntervalMs);

app.listen(config.port, () => {
  console.log(`[stock-aggregator] listening on :${config.port}`);
});
