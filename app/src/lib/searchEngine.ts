import type { Product } from '../data/products';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id: string;
  name: string;
  brand: string;
  merchant: string;
  price: number;
  originalPrice?: number;
  image: string;
  sourceUrl: string;
  description: string;
  category: 'tops' | 'bottoms' | 'dresses' | 'outerwear' | 'accessories';
  material: string;
  availability: 'In stock' | 'Limited stock' | 'Out of stock';
  deliveryBusinessDays: number;
  tags: string[];
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SERPER_API_KEY = import.meta.env.VITE_SERPER_API_KEY as string | undefined;
const STOCK_API_URL = import.meta.env.VITE_STOCK_API_URL as string | undefined;
const STOCK_API_TOKEN = import.meta.env.VITE_STOCK_API_TOKEN as string | undefined;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugId(brand: string, name: string) {
  return `${brand}-${name}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .slice(0, 60);
}

function guessCategory(name: string): SearchResult['category'] {
  const text = name.toLowerCase();
  if (/(dress|jumpsuit|romper|playsuit)/.test(text)) return 'dresses';
  if (/(jacket|coat|blazer|hoodie|sweatshirt|cardigan|vest)/.test(text)) return 'outerwear';
  if (/(pant|jean|short|trouser|legging|skirt|culotte|chino)/.test(text)) return 'bottoms';
  if (/(bag|shoe|boot|sneaker|heel|sandal|hat|belt|scarf|jewelry|accessory)/.test(text)) return 'accessories';
  return 'tops';
}

function extractPrice(raw: string | number | undefined): number | null {
  if (!raw) return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

function buildTags(query: string, title: string): string[] {
  const words = `${query} ${title}`
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2 && !/^(and|the|for|with|from|that|this|have|more)$/.test(w));
  return [...new Set(words)].slice(0, 12);
}

const STOCK_UNAVAILABLE_PATTERN =
  /(out of stock|sold out|unavailable|currently unavailable|not available|coming soon|notify me|waitlist)/i;

const STOCK_LIMITED_PATTERN =
  /(limited stock|only\s+\d+\s+left|few left|almost gone|low stock)/i;

function inferAvailability(...texts: Array<string | undefined>): SearchResult['availability'] {
  const combined = texts.filter(Boolean).join(' ').toLowerCase();
  if (STOCK_UNAVAILABLE_PATTERN.test(combined)) {
    return 'Out of stock';
  }
  if (STOCK_LIMITED_PATTERN.test(combined)) {
    return 'Limited stock';
  }
  return 'In stock';
}

function inferMerchantFromUrl(url: string | undefined, fallback = 'Online Store'): string {
  if (!url) return fallback;
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    const root = hostname.split('.')[0];
    if (!root) return fallback;
    return root
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  } catch {
    return fallback;
  }
}

function extractBrandAndSiteHints(prompt: string): { brandHints: string[]; siteHints: string[] } {
  const lower = prompt.toLowerCase();

  const siteHints = [
    ...new Set(
      (lower.match(/(?:site:)?([a-z0-9-]+\.(?:com|net|org|co))/g) ?? [])
        .map((match) => match.replace(/^site:/, '')),
    ),
  ];

  const fromBrandMatches =
    lower.match(/(?:from|brand|by)\s+([a-z0-9&\-\s]{2,30})/g)?.map((match) =>
      match.replace(/^(?:from|brand|by)\s+/, '').trim(),
    ) ?? [];

  const brandHints = [
    ...new Set(
      fromBrandMatches
        .map((brand) => brand.replace(/[^a-z0-9&\-\s]/g, '').trim())
        .filter((brand) => brand.length > 1),
    ),
  ];

  return { brandHints, siteHints };
}

function buildSearchQuery(prompt: string, budget: number | null): string {
  const { brandHints, siteHints } = extractBrandAndSiteHints(prompt);
  const budgetHint = budget ? ` under $${budget}` : '';
  const brandHint = brandHints.length ? ` ${brandHints.join(' ')}` : '';
  const siteOperators = siteHints.slice(0, 3).map((site) => `site:${site}`).join(' ');

  return `${prompt}${budgetHint}${brandHint} women fashion clothing ${siteOperators}`.trim();
}

async function searchViaStockAggregator(query: string, budget: number | null): Promise<SearchResult[]> {
  if (!STOCK_API_URL) return [];

  const { brandHints, siteHints } = extractBrandAndSiteHints(query);
  const payload = {
    prompt: query,
    budget,
    brand: brandHints[0],
    site: siteHints[0],
  };

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (STOCK_API_TOKEN) {
      headers.Authorization = `Bearer ${STOCK_API_TOKEN}`;
    }

    const res = await fetch(`${STOCK_API_URL.replace(/\/$/, '')}/api/inventory/search`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = (await res.json()) as { ok?: boolean; items?: SearchResult[] };
    if (!data.ok || !Array.isArray(data.items)) return [];
    return data.items;
  } catch {
    return [];
  }
}

function scoreResult(result: SearchResult, prompt: string, budget: number | null): number {
  let score = 10;
  const text = `${result.name} ${result.description} ${result.tags.join(' ')}`.toLowerCase();

  prompt.split(/\s+/).forEach((word) => {
    if (word.length > 3 && text.includes(word)) score += 6;
  });

  if (budget) score += result.price <= budget ? 14 : -10;
  if (result.availability === 'Out of stock') score -= 150;
  else if (result.availability === 'Limited stock') score += 2;
  else score += 8;
  if (result.image && !result.image.includes('placeholder')) score += 4;

  return score;
}

// ─── Serper.dev Google Shopping ───────────────────────────────────────────────

interface SerperShoppingItem {
  title?: string;
  price?: string;
  source?: string;
  link?: string;
  imageUrl?: string;
  rating?: number;
  ratingCount?: number;
  delivery?: string;
}

interface SerperResponse {
  shopping?: SerperShoppingItem[];
  organic?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
}

async function searchViaSerper(query: string, budget: number | null): Promise<SearchResult[]> {
  if (!SERPER_API_KEY) return [];

  const searchQuery = buildSearchQuery(query, budget);

  const res = await fetch('https://google.serper.dev/shopping', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      q: searchQuery,
      gl: 'us',
      hl: 'en',
      num: 20,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Serper error ${res.status}`);

  const data = (await res.json()) as SerperResponse;
  const items = data.shopping ?? [];

  return items
    .filter((item) => item.title && item.link)
    .map((item, i) => {
      const name = item.title ?? `Product ${i + 1}`;
      const price = extractPrice(item.price) ?? (budget ? budget * 0.8 : 59.99);
      const merchant = inferMerchantFromUrl(item.link, item.source ?? 'Online Store');
      const tags = buildTags(query, name);
      const category = guessCategory(name);
      const availability = inferAvailability(name, item.delivery, item.source);

      // Estimate delivery from Serper's delivery field or default
      let deliveryDays = 6;
      if (item.delivery) {
        const d = item.delivery.toLowerCase();
        if (/1.?2 day|overnight|next.?day/.test(d)) deliveryDays = 2;
        else if (/2.?3 day|express/.test(d)) deliveryDays = 3;
        else if (/3.?5 day/.test(d)) deliveryDays = 4;
        else if (/free/.test(d)) deliveryDays = 5;
      }

      return {
        id: slugId(merchant, name),
        name,
        brand: merchant,
        merchant,
        price,
        image: item.imageUrl ?? '',
        sourceUrl: item.link ?? '#',
        description: `${name} — available at ${merchant}.`,
        category,
        material: 'See product page',
        availability,
        deliveryBusinessDays: deliveryDays,
        tags,
      };
    });
}

// ─── Open Free Fallback (no key needed) ──────────────────────────────────────
// Uses the Open Graph / meta scraping approach via a reliable CORS proxy
// against Google's actual shopping search URL as a last resort.

async function searchViaGoogleShopping(query: string, budget: number | null): Promise<SearchResult[]> {
  const q = buildSearchQuery(query, budget);

  try {
    const url = `https://corsproxy.io/?${encodeURIComponent(
      `https://www.google.com/search?q=${encodeURIComponent(q)}&tbm=shop&hl=en`,
    )}`;

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const html = await res.text();

    // Parse the structured shopping result JSON Google embeds
    const matches = [...html.matchAll(/data-sh-gr="([^"]+)"/g)];
    const tags = buildTags(query, '');

    if (matches.length === 0) {
      // Fallback: parse visible product names from the HTML
      const titleMatches = [...html.matchAll(/aria-label="([^"]{10,80})"/g)];
      const priceMatches = [...html.matchAll(/\$(\d+(?:\.\d{2})?)/g)];

      return titleMatches.slice(0, 8).map((m, i) => {
        const name = m[1];
        const price = extractPrice(priceMatches[i]?.[1]) ?? (budget ? budget * 0.8 : 49.99);
        return {
          id: `google-${i}-${slugId('web', name)}`,
          name,
          brand: 'Web Result',
          merchant: 'Google Shopping',
          price,
          image: '',
          sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' buy')}`,
          description: `${name} — found via Google Shopping.`,
          category: guessCategory(name),
          material: 'See product page',
          availability: inferAvailability(name),
          deliveryBusinessDays: 6,
          tags: buildTags(query, name),
        };
      });
    }

    return matches.slice(0, 10).map((m, i) => {
      const raw = decodeURIComponent(m[1]);
      const name = raw.slice(0, 60) || `Product ${i + 1}`;
      const price = budget ? budget * 0.8 : 49.99;
      return {
        id: `google-${i}-${slugId('web', name)}`,
        name,
        brand: inferMerchantFromUrl(undefined, 'Web Result'),
        merchant: 'Google Shopping',
        price,
        image: '',
        sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(name + ' buy')}`,
        description: `${name} — found via Google Shopping for "${query}".`,
        category: guessCategory(name),
        material: 'See product page',
        availability: inferAvailability(name),
        deliveryBusinessDays: 6,
        tags,
      };
    });
  } catch {
    return [];
  }
}

// ─── Fallback: DuckDuckGo + Open Beauty/Fashion APIs ─────────────────────────

async function searchViaOpenAPIs(query: string, budget: number | null): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // 1. Open Fake Store API — real structured product data (electronics/clothing)
  try {
    const res = await fetch(
      `https://fakestoreapi.com/products/category/women's clothing`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const items = (await res.json()) as Array<{
        id: number;
        title?: string;
        price?: number;
        image?: string;
        description?: string;
        category?: string;
      }>;

      const q = query.toLowerCase();
      const filtered = items.filter((item) => {
        const text = `${item.title} ${item.description}`.toLowerCase();
        return q.split(' ').some((w) => w.length > 3 && text.includes(w));
      });

      filtered.slice(0, 4).forEach((item) => {
        const name = item.title ?? 'Fashion Item';
        const price = extractPrice(item.price) ?? 39.99;
        if (budget && price > budget) return;

        results.push({
          id: `fakestore-${item.id}`,
          name,
          brand: 'Fashion Store',
          merchant: 'Online Boutique',
          price,
          image: item.image ?? '',
          sourceUrl: `https://fakestoreapi.com/products/${item.id}`,
          description: item.description ?? name,
          category: guessCategory(name),
          material: 'See product page',
          availability: inferAvailability(name, item.description),
          deliveryBusinessDays: 5,
          tags: buildTags(query, name),
        });
      });
    }
  } catch { /* skip */ }

  // 2. Platzi Fake Store API — larger catalog with real product images
  try {
    const res = await fetch(
      `https://api.escuelajs.co/api/v1/products/?offset=0&limit=20`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const items = (await res.json()) as Array<{
        id: number;
        title?: string;
        price?: number;
        images?: string[];
        description?: string;
        category?: { name?: string };
      }>;

      const q = query.toLowerCase();
      const filtered = items.filter((item) => {
        const text = `${item.title} ${item.description} ${item.category?.name}`.toLowerCase();
        return q.split(' ').some((w) => w.length > 3 && text.includes(w));
      });

      filtered.slice(0, 4).forEach((item) => {
        const name = item.title ?? 'Fashion Item';
        const price = extractPrice(item.price) ?? 49.99;
        if (budget && price > budget) return;

        // Platzi images are sometimes invalid JSON strings — clean them
        let image = item.images?.[0] ?? '';
        try { image = JSON.parse(image); } catch { /* already a plain URL */ }

        results.push({
          id: `platzi-${item.id}`,
          name,
          brand: item.category?.name ?? 'Boutique',
          merchant: item.category?.name ?? 'Online Store',
          price,
          image: typeof image === 'string' ? image : '',
          sourceUrl: `https://api.escuelajs.co/api/v1/products/${item.id}`,
          description: item.description ?? name,
          category: guessCategory(name),
          material: 'See product page',
          availability: inferAvailability(name, item.description, item.category?.name),
          deliveryBusinessDays: 5,
          tags: buildTags(query, name),
        });
      });
    }
  } catch { /* skip */ }

  return results;
}

async function enrichAvailabilityStatus(results: SearchResult[]): Promise<SearchResult[]> {
  const checks = results.slice(0, 10).map(async (result) => {
    if (!result.sourceUrl || result.availability === 'Out of stock') {
      return result;
    }

    try {
      const proxied = `https://corsproxy.io/?${encodeURIComponent(result.sourceUrl)}`;
      const res = await fetch(proxied, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) return result;

      const html = (await res.text()).slice(0, 350000);
      const inferred = inferAvailability(html, result.name, result.description);
      return { ...result, availability: inferred };
    } catch {
      return result;
    }
  });

  const checked = await Promise.all(checks);
  const untouched = results.slice(10);
  return [...checked, ...untouched];
}

// ─── Main Search Engine ───────────────────────────────────────────────────────

export async function searchProductsOnline(
  prompt: string,
  budget: number | null,
): Promise<SearchResult[]> {
  const allResults: SearchResult[] = [];

  // Preferred source: enterprise stock aggregator backend
  const aggregatorResults = await searchViaStockAggregator(prompt, budget);
  allResults.push(...aggregatorResults);

  // Try Serper first (best results, needs API key)
  if (SERPER_API_KEY && allResults.length < 8) {
    try {
      const serperResults = await searchViaSerper(prompt, budget);
      allResults.push(...serperResults);
    } catch { /* fall through */ }
  }

  // If Serper returned nothing or no key, try Google Shopping via CORS proxy
  if (allResults.length < 8) {
    const googleResults = await searchViaGoogleShopping(prompt, budget);
    allResults.push(...googleResults);
  }

  // Always supplement with open API results
  if (allResults.length < 8) {
    const openResults = await searchViaOpenAPIs(prompt, budget);
    allResults.push(...openResults);
  }

  if (allResults.length === 0) return [];

  // Deduplicate by name
  const seen = new Set<string>();
  const deduped = allResults.filter((r) => {
    const key = r.name.toLowerCase().slice(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const preRanked = deduped
    .sort((a, b) => scoreResult(b, prompt, budget) - scoreResult(a, prompt, budget))
    .slice(0, 18);

  const withAvailability = await enrichAvailabilityStatus(preRanked);

  // Final ranked list favors in-stock and demotes out-of-stock immediately.
  return withAvailability
    .sort((a, b) => scoreResult(b, prompt, budget) - scoreResult(a, prompt, budget))
    .slice(0, 12);
}

// ─── Convert SearchResult → Product ──────────────────────────────────────────

export function searchResultToProduct(result: SearchResult): Product {
  return {
    id: result.id,
    name: result.name,
    brand: result.brand,
    merchant: result.merchant,
    category:
      result.category === 'dresses' || result.category === 'outerwear' || result.category === 'accessories'
        ? 'tops'
        : result.category,
    price: result.price,
    originalPrice: result.originalPrice,
    image: result.image || 'https://placehold.co/400x500/f5f0eb/234b6e?text=View+Product',
    images: [result.image || ''],
    sizes: ['XS', 'S', 'M', 'L', 'XL'],
    colors: [{ name: 'See site', hex: '#234b6e' }],
    description: result.description,
    material: result.material,
    fit: 'See product page',
    availability: result.availability,
    sourceUrl: result.sourceUrl,
    sourceLabel: `View on ${result.merchant}`,
    shippingNote: `${result.merchant} standard U.S. shipping.`,
    deliveryBusinessDays: result.deliveryBusinessDays,
    expeditedBusinessDays: Math.max(2, result.deliveryBusinessDays - 2),
    tags: result.tags,
    feature: 'Web result',
  };
}
