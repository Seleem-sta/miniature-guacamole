export type StockAvailability = 'In stock' | 'Limited stock' | 'Out of stock';

export interface InventoryItem {
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
  availability: StockAvailability;
  deliveryBusinessDays: number;
  tags: string[];
  source: 'shopify' | 'commercetools' | 'affiliate' | 'unknown';
  lastCheckedAt: string;
}

export interface SearchRequest {
  prompt: string;
  budget: number | null;
  brand?: string;
  site?: string;
}

export interface Provider {
  name: string;
  search(request: SearchRequest): Promise<InventoryItem[]>;
  refresh(ids: string[]): Promise<Array<Pick<InventoryItem, 'id' | 'availability' | 'lastCheckedAt'>>>;
}
