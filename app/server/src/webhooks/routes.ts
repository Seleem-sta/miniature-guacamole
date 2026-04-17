import type { Request, Response, Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { StockCache } from '../cache/stockCache.js';
import { config } from '../config.js';

const payloadSchema = z.object({
  id: z.string().min(1),
  availability: z.enum(['In stock', 'Limited stock', 'Out of stock']),
  checkedAt: z.string().optional(),
});

function safeEquals(left: string, right: string): boolean {
  const leftBuf = Buffer.from(left);
  const rightBuf = Buffer.from(right);
  if (leftBuf.length !== rightBuf.length) return false;
  return timingSafeEqual(leftBuf, rightBuf);
}

export function registerWebhookRoutes(router: Router, cache: StockCache): void {
  router.post('/webhooks/inventory', (req: Request, res: Response) => {
    const signature = String(req.headers['x-webhook-secret'] ?? '');
    if (config.webhookSharedSecret && !safeEquals(signature, config.webhookSharedSecret)) {
      res.status(401).json({ ok: false, message: 'Invalid webhook signature.' });
      return;
    }

    const parsed = payloadSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, message: 'Invalid payload.' });
      return;
    }

    const { id, availability, checkedAt } = parsed.data;
    cache.updateAvailability(id, availability, checkedAt ?? new Date().toISOString());
    res.json({ ok: true, id, availability });
  });
}
