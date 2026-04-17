import cors from 'cors';
import express from 'express';
import { z } from 'zod';
import { StockCache } from './cache/stockCache.js';
import { config } from './config.js';
import { AggregatorService } from './aggregatorService.js';
import { CommercetoolsProvider } from './providers/commercetools.js';
import { ShopifyProvider } from './providers/shopify.js';
import { AffiliateFeedProvider } from './providers/affiliateFeed.js';
import { startPolling } from './polling/scheduler.js';
import { registerWebhookRoutes } from './webhooks/routes.js';

const app = express();
const cache = new StockCache(config.cacheTtlMs);

const providers = [
  new ShopifyProvider(),
  new CommercetoolsProvider(),
  new AffiliateFeedProvider(),
];

const service = new AggregatorService(providers, cache);

app.use(cors({ origin: config.allowedOrigin }));
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

app.post('/api/inventory/search', async (req, res) => {
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
app.use(router);

startPolling(providers, cache, config.pollIntervalMs);

app.listen(config.port, () => {
  console.log(`[stock-aggregator] listening on :${config.port}`);
});
