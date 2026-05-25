export interface ProductCardVO {
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice: number;
  sales: number;
  tag?: string;
}

export function serializeProductCard(product: {
  id: bigint | string;
  name: string;
  mainImage: string | null;
  minPrice: number | null;
  totalSales: number;
  originalPrice?: number | null;
  tag?: string;
  isRecommend?: number;
  [key: string]: any;
}): ProductCardVO {
  return {
    id: product.id.toString(),
    name: product.name,
    image: product.mainImage || '',
    price: product.minPrice ?? 0,
    originalPrice: product.originalPrice ?? product.minPrice ?? 0,
    sales: product.totalSales,
    tag: product.tag || (product.isRecommend === 1 ? '推荐' : undefined),
  };
}
