import type { InventoryItem } from '../types.js';

interface CacheEntry {
  expiresAt: number;
  items: InventoryItem[];
}

export class StockCache {
  private readonly map = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number) {}

  get(key: string): InventoryItem[] | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return null;
    }
    return entry.items;
  }

  set(key: string, items: InventoryItem[]): void {
    this.map.set(key, {
      items,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  updateAvailability(productId: string, availability: InventoryItem['availability'], lastCheckedAt: string): void {
    for (const [, entry] of this.map) {
      entry.items = entry.items.map((item) =>
        item.id === productId
          ? {
              ...item,
              availability,
              lastCheckedAt,
            }
          : item,
      );
    }
  }

  allItems(): InventoryItem[] {
    const output: InventoryItem[] = [];
    for (const [, entry] of this.map) {
      output.push(...entry.items);
    }
    return output;
  }
}
