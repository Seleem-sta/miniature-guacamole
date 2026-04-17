import { config } from '../config.js';
import type { InventoryItem, Provider, SearchRequest } from '../types.js';
import { includesBrandOrSite, makeId, nowIso } from './base.js';

interface CtProduct {
  id: string;
  masterData?: {
    current?: {
      name?: { [locale: string]: string };
      description?: { [locale: string]: string };
      masterVariant?: {
        prices?: Array<{ value?: { centAmount?: number } }>;
        images?: Array<{ url?: string }>;
        attributesRaw?: Array<{ name?: string; value?: unknown }>;
      };
    };
  };
}

export class CommercetoolsProvider implements Provider {
  name = 'commercetools' as const;

  async search(request: SearchRequest): Promise<InventoryItem[]> {
    if (!config.commercetools.projectKey || !config.commercetools.apiUrl) return [];

    const endpoint = `${config.commercetools.apiUrl}/${config.commercetools.projectKey}/product-projections/search`;
    const text = request.prompt
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .join(' ')
      .slice(0, 60);

    const res = await fetch(`${endpoint}?text.en-US=${encodeURIComponent(text)}&limit=20`, {
      headers: {
        // Use bearer token from gateway in production. Kept as placeholder scaffold.
        Authorization: `Bearer ${config.commercetools.clientSecret}`,
      },
    });

    if (!res.ok) return [];
    const json = (await res.json()) as { results?: CtProduct[] };
    const rows = json.results ?? [];

    return rows
      .map((row): InventoryItem => {
        const current = row.masterData?.current;
        const variant = current?.masterVariant;
        const centAmount = variant?.prices?.[0]?.value?.centAmount ?? 0;
        return {
          id: makeId('ct', row.id),
          name: current?.name?.['en-US'] ?? 'Commercetools Product',
          brand: 'Commercetools Brand',
          merchant: 'Commercetools',
          price: centAmount / 100,
          image: variant?.images?.[0]?.url ?? '',
          sourceUrl: endpoint,
          description: current?.description?.['en-US'] ?? 'Inventory item from Commercetools.',
          category: 'tops',
          material: 'See product page',
          availability: 'In stock',
          deliveryBusinessDays: 5,
          tags: [text],
          source: 'commercetools',
          lastCheckedAt: nowIso(),
        };
      })
      .filter((item) => includesBrandOrSite(item, request));
  }

  async refresh(ids: string[]): Promise<Array<Pick<InventoryItem, 'id' | 'availability' | 'lastCheckedAt'>>> {
    if (!ids.length) return [];
    return ids.map((id) => ({ id, availability: 'In stock', lastCheckedAt: nowIso() }));
  }
}
