import type { Provider } from '../types.js';
import { StockCache } from '../cache/stockCache.js';

export function startPolling(providers: Provider[], cache: StockCache, intervalMs: number): NodeJS.Timeout {
  return setInterval(async () => {
    const snapshot = cache.allItems();
    if (!snapshot.length) return;

    const grouped = snapshot.reduce<Record<string, string[]>>((acc, item) => {
      const key = item.source;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item.id);
      return acc;
    }, {});

    for (const provider of providers) {
      const ids = grouped[provider.name] ?? [];
      if (!ids.length) continue;

      try {
        const refreshed = await provider.refresh(ids);
        refreshed.forEach((row) => {
          cache.updateAvailability(row.id, row.availability, row.lastCheckedAt);
        });
      } catch {
        // Keep stale state on polling failure.
      }
    }
  }, intervalMs);
}
