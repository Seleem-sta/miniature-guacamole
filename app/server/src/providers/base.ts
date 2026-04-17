import type { InventoryItem, SearchRequest } from '../types.js';

export function normalizeText(value: string): string {
  return value.toLowerCase().trim();
}

export function includesBrandOrSite(item: Pick<InventoryItem, 'brand' | 'merchant' | 'sourceUrl'>, request: SearchRequest): boolean {
  const brand = normalizeText(request.brand ?? '');
  const site = normalizeText(request.site ?? '');
  if (!brand && !site) return true;

  const haystack = `${item.brand} ${item.merchant} ${item.sourceUrl}`.toLowerCase();
  if (brand && !haystack.includes(brand)) return false;
  if (site && !haystack.includes(site)) return false;
  return true;
}

export function semanticMatch(item: InventoryItem, request: SearchRequest): number {
  const prompt = normalizeText(request.prompt);
  const text = `${item.name} ${item.description} ${item.tags.join(' ')} ${item.brand} ${item.merchant}`.toLowerCase();
  let score = 0;
  for (const token of prompt.split(/\s+/).filter((t) => t.length > 2)) {
    if (text.includes(token)) score += 4;
  }

  if (request.budget) {
    score += item.price <= request.budget ? 8 : -12;
  }

  if (item.availability === 'Out of stock') score -= 120;
  if (item.availability === 'Limited stock') score += 1;
  if (item.availability === 'In stock') score += 8;

  return score;
}

export function makeId(prefix: string, value: string): string {
  return `${prefix}-${value}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 90);
}

export function nowIso(): string {
  return new Date().toISOString();
}
