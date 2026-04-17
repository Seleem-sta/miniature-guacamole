import { StockCache } from './cache/stockCache.js';
import type { InventoryItem, Provider, SearchRequest } from './types.js';
import { semanticMatch } from './providers/base.js';

function cacheKey(request: SearchRequest): string {
  return JSON.stringify({
    prompt: request.prompt.toLowerCase(),
    budget: request.budget,
    brand: request.brand?.toLowerCase() ?? '',
    site: request.site?.toLowerCase() ?? '',
  });
}

export class AggregatorService {
  constructor(
    private readonly providers: Provider[],
    private readonly cache: StockCache,
  ) {}

  async search(request: SearchRequest): Promise<InventoryItem[]> {
    const key = cacheKey(request);
    const cached = this.cache.get(key);
    if (cached) {
      return this.rank(cached, request).slice(0, 20);
    }

    const settled = await Promise.allSettled(this.providers.map((provider) => provider.search(request)));
    const items = settled.flatMap((entry) => (entry.status === 'fulfilled' ? entry.value : []));

    const deduped = this.dedupe(items);
    this.cache.set(key, deduped);

    return this.rank(deduped, request).slice(0, 20);
  }

  private dedupe(items: InventoryItem[]): InventoryItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = `${item.name.toLowerCase()}|${item.brand.toLowerCase()}|${item.sourceUrl.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private rank(items: InventoryItem[], request: SearchRequest): InventoryItem[] {
    return [...items].sort((a, b) => semanticMatch(b, request) - semanticMatch(a, request));
  }
}
