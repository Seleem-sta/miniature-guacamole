import { config } from '../config.js';
import type { InventoryItem, Provider, SearchRequest } from '../types.js';
import { includesBrandOrSite, makeId, nowIso } from './base.js';

interface FeedRow {
  id?: string;
  title?: string;
  brand?: string;
  merchant?: string;
  price?: number | string;
  image?: string;
  url?: string;
  description?: string;
  category?: InventoryItem['category'];
  material?: string;
  availability?: string;
  shippingDays?: number;
  tags?: string[];
}

function parseAvailability(value: string | undefined): InventoryItem['availability'] {
  const v = (value ?? '').toLowerCase();
  if (/out|sold/.test(v)) return 'Out of stock';
  if (/limited|low/.test(v)) return 'Limited stock';
  return 'In stock';
}

export class AffiliateFeedProvider implements Provider {
  name = 'affiliate' as const;

  async search(request: SearchRequest): Promise<InventoryItem[]> {
    if (!config.affiliateFeedUrl) return [];

    const res = await fetch(config.affiliateFeedUrl);
    if (!res.ok) return [];

    const rows = (await res.json()) as FeedRow[];
    const prompt = request.prompt.toLowerCase();

    return rows
      .map((row): InventoryItem => ({
        id: makeId('aff', row.id ?? row.title ?? 'item'),
        name: row.title ?? 'Affiliate Item',
        brand: row.brand ?? row.merchant ?? 'Partner Brand',
        merchant: row.merchant ?? row.brand ?? 'Partner Merchant',
        price: Number(row.price ?? 0),
        image: row.image ?? '',
        sourceUrl: row.url ?? config.affiliateFeedUrl,
        description: row.description ?? row.title ?? 'Affiliate feed item.',
        category: row.category ?? 'tops',
        material: row.material ?? 'See product page',
        availability: parseAvailability(row.availability),
        deliveryBusinessDays: Number(row.shippingDays ?? 5),
        tags: row.tags ?? [],
        source: 'affiliate',
        lastCheckedAt: nowIso(),
      }))
      .filter((item) => {
        const text = `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase();
        const semantic = prompt.split(/\s+/).some((token) => token.length > 2 && text.includes(token));
        return semantic && includesBrandOrSite(item, request);
      });
  }

  async refresh(ids: string[]): Promise<Array<Pick<InventoryItem, 'id' | 'availability' | 'lastCheckedAt'>>> {
    if (!ids.length) return [];
    return ids.map((id) => ({ id, availability: 'In stock', lastCheckedAt: nowIso() }));
  }
}
