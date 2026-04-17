import { config } from '../config.js';
import type { InventoryItem, Provider, SearchRequest } from '../types.js';
import { includesBrandOrSite, makeId, nowIso } from './base.js';

interface ShopifyNode {
  id: string;
  title: string;
  onlineStoreUrl?: string;
  featuredImage?: { url?: string };
  vendor?: string;
  tags?: string[];
  description?: string;
  priceRange?: { minVariantPrice?: { amount?: string } };
  totalInventory?: number;
}

export class ShopifyProvider implements Provider {
  name = 'shopify' as const;

  async search(request: SearchRequest): Promise<InventoryItem[]> {
    if (!config.shopify.domain || !config.shopify.token) return [];

    const endpoint = `https://${config.shopify.domain}/api/2024-10/graphql.json`;
    const query = `
      query Products($query: String!) {
        products(first: 20, query: $query) {
          nodes {
            id
            title
            onlineStoreUrl
            vendor
            tags
            description
            totalInventory
            featuredImage { url }
            priceRange { minVariantPrice { amount } }
          }
        }
      }
    `;

    const searchTerms = request.prompt
      .split(/\s+/)
      .filter((t) => t.length > 2)
      .slice(0, 8)
      .join(' OR ');

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Storefront-Access-Token': config.shopify.token,
      },
      body: JSON.stringify({ query, variables: { query: searchTerms } }),
    });

    if (!res.ok) return [];
    const json = (await res.json()) as { data?: { products?: { nodes?: ShopifyNode[] } } };
    const nodes = json.data?.products?.nodes ?? [];

    return nodes
      .map((node): InventoryItem => {
        const inventory = Number(node.totalInventory ?? 0);
        const availability: InventoryItem['availability'] =
          inventory <= 0 ? 'Out of stock' : inventory < 6 ? 'Limited stock' : 'In stock';

        return {
          id: makeId('shopify', node.id || node.title),
          name: node.title,
          brand: node.vendor || 'Shopify Brand',
          merchant: node.vendor || 'Shopify Store',
          price: Number(node.priceRange?.minVariantPrice?.amount ?? 0),
          image: node.featuredImage?.url ?? '',
          sourceUrl: node.onlineStoreUrl ?? `https://${config.shopify.domain}`,
          description: node.description ?? node.title,
          category: 'tops',
          material: 'See product page',
          availability,
          deliveryBusinessDays: 4,
          tags: node.tags ?? [],
          source: 'shopify',
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
