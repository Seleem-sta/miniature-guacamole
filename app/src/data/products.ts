export interface Product {
  id: string;
  name: string;
  brand: string;
  merchant: string;
  category: 'tops' | 'bottoms';
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  sizes: string[];
  colors: { name: string; hex: string }[];
  description: string;
  material: string;
  fit: string;
  availability: 'In stock' | 'Limited stock' | 'Out of stock';
  sourceUrl: string;
  sourceLabel: string;
  shippingNote: string;
  deliveryBusinessDays: number;
  expeditedBusinessDays: number;
  tags: string[];
  feature?: string;
}

export const categories = [
  { id: 'all', name: 'All live products' },
  { id: 'tops', name: 'Tops' },
  { id: 'bottoms', name: 'Bottoms' },
] as const;

export const products: Product[] = [
  {
    id: 'madewell-easy-shirt-linen',
    name: 'The Easy Shirt in 100% Linen',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'tops',
    price: 118,
    image:
      'https://images.madewell.com/is/image/madewell/OA402_BL0472_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/OA402_BL0472_m?$pdp_fs418$'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Oversized Blue White Plaid', hex: '#8da7d6' },
      { name: 'Ivory Linen', hex: '#f2eee5' },
      { name: 'Bold Placement Stripe Black', hex: '#1f1f1f' },
    ],
    description:
      "Madewell's relaxed linen button-up with an easy drape for office layers, travel days, and warm-weather styling.",
    material: '100% linen',
    fit: 'Relaxed fit',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/tops-shirts/the-easy-shirt-in-100-linen/OA402/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['linen', 'shirt', 'button-up', 'summer', 'office', 'vacation', 'travel', 'layering', 'plaid'],
    feature: 'Official pick',
  },
  {
    id: 'madewell-blaire-top',
    name: 'The Blaire Top',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'tops',
    price: 98,
    image:
      'https://images.madewell.com/is/image/madewell/NZ459_RD5668_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/NZ459_RD5668_m?$pdp_fs418$'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Warm Crimson', hex: '#9c433c' },
      { name: 'Heather Bright Chartreuse', hex: '#bcc51b' },
      { name: 'Black', hex: '#1d1d1d' },
    ],
    description:
      'A softly structured sleeveless top that works for event dressing, dinner plans, or polished daywear.',
    material: 'Viscose blend',
    fit: 'Straight fit',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/tops-shirts/tops/the-blaire-top/NZ459/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['dressy', 'top', 'event', 'dinner', 'night out', 'sleeveless', 'red', 'black', 'statement'],
    feature: 'Dress-up favorite',
  },
  {
    id: 'madewell-cinched-boatneck-top',
    name: 'Cinched Boatneck Sleeveless Top in 100% Linen',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'tops',
    price: 98,
    image:
      'https://images.madewell.com/is/image/madewell/NS244_RD5820_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/NS244_RD5820_m?$pdp_fs418$'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: [
      { name: 'Deep Blackberry', hex: '#54314d' },
      { name: 'Stacked Stripe Lighthouse', hex: '#7aa7d9' },
    ],
    description:
      'A breezy linen top with a cinched waist and polished boat neckline for heat-friendly outfit building.',
    material: '100% linen',
    fit: 'Cinched waist, easy body',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/tops-shirts/tops/cinched-boatneck-sleeveless-top-in-100-linen/NS244/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['linen', 'boatneck', 'vacation', 'summer', 'elevated basics', 'set dressing', 'purple', 'striped'],
    feature: 'Warm-weather essential',
  },
  {
    id: 'madewell-denim-smocked-tank',
    name: 'Denim Smocked Boatneck Tank',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'tops',
    price: 94.5,
    originalPrice: 98,
    image:
      'https://images.madewell.com/is/image/madewell/NR445_DM9589_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/NR445_DM9589_m?$pdp_fs418$'],
    sizes: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL'],
    colors: [{ name: 'Burrough Wash', hex: '#5e7ea8' }],
    description:
      'A denim tank with smocking and a boat neckline that gives casual looks more shape and texture.',
    material: 'Cotton denim',
    fit: 'Fitted through the bodice',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/tops-shirts/tops/denim-smocked-boatneck-tank/NR445/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['denim', 'tank', 'weekend', 'casual', 'summer', 'boatneck', 'blue', 'daywear'],
    feature: 'Limited markdown',
  },
  {
    id: 'madewell-zoe-short-linen',
    name: 'The Zoe Short in 100% Linen',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'bottoms',
    price: 78,
    image:
      'https://images.madewell.com/is/image/madewell/NS015_RD5820_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/NS015_RD5820_m?$pdp_fs418$'],
    sizes: ['23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
    colors: [
      { name: 'Stacked Stripe Lighthouse', hex: '#7aa7d9' },
      { name: 'Spiced Olive', hex: '#7b7f48' },
    ],
    description:
      'A lightweight linen short designed for hot days, weekend city walks, and travel-ready matching looks.',
    material: '100% linen',
    fit: 'High rise, easy leg',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/shorts/the-zoe-short-in-100-linen/NS015/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['linen', 'shorts', 'vacation', 'travel', 'summer', 'matching set', 'resort', 'striped'],
    feature: 'AI outfit staple',
  },
  {
    id: 'madewell-emmy-denim-short',
    name: 'The Emmy Denim Short',
    brand: 'Madewell',
    merchant: 'Madewell Official',
    category: 'bottoms',
    price: 78,
    image:
      'https://images.madewell.com/is/image/madewell/NZ748_DM6703_m?$pdp_fs418$',
    images: ['https://images.madewell.com/is/image/madewell/NZ748_DM6703_m?$pdp_fs418$'],
    sizes: ['23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'],
    colors: [
      { name: 'Salley Wash', hex: '#7f8fa5' },
      { name: 'Cove Wash', hex: '#5d78a1' },
    ],
    description:
      'A versatile denim short for everyday styling, easy layering, and casual outfit requests from the concierge.',
    material: 'Cotton denim',
    fit: 'Mid rise, relaxed through the leg',
    availability: 'In stock',
    sourceUrl: 'https://www.madewell.com/p/womens/clothing/shorts/the-emmy-denim-short/NZ748/',
    sourceLabel: 'View on Madewell',
    shippingNote: 'Madewell U.S. standard shipping estimates delivery in 6 business days.',
    deliveryBusinessDays: 6,
    expeditedBusinessDays: 3,
    tags: ['denim', 'shorts', 'casual', 'weekend', 'festival', 'summer', 'blue', 'everyday'],
    feature: 'Easy everyday',
  },
];

export const getProductById = (id: string): Product | undefined => products.find((product) => product.id === id);

export const getProductsByCategory = (category: string): Product[] => {
  if (category === 'all') {
    return products;
  }

  return products.filter((product) => product.category === category);
};

export const getFeaturedProducts = (): Product[] => products.slice(0, 4);
