export interface ProductCardVO {
  id: string;
  name: string;
  image: string;
  price: number;
  originalPrice: number;
  sales: number;
  tag?: string;
}

function safeTrim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function formatSkuSpecs(specs: unknown): string {
  if (specs === null || specs === undefined || specs === '') return '';
  if (typeof specs === 'string') return specs;
  if (typeof specs === 'number' || typeof specs === 'boolean') return String(specs);

  if (Array.isArray(specs)) {
    return specs
      .map((item) => formatSkuSpecs(item))
      .filter((item) => !!item)
      .join(' / ');
  }

  if (typeof specs === 'object') {
    const entries = Object.entries(specs as Record<string, unknown>)
      .map(([key, value]) => {
        const k = safeTrim(key);
        const v = safeTrim(formatSkuSpecs(value));
        if (!k && !v) return '';
        if (!k) return v;
        if (!v) return k;
        return `${k}：${v}`;
      })
      .filter((item) => !!item);

    if (entries.length > 0) return entries.join(' / ');
  }

  try {
    return JSON.stringify(specs);
  } catch {
    return String(specs);
  }
}

export function toPublicAssetUrl(urlOrPath: unknown, baseUrl?: string): string {
  const raw = safeTrim(urlOrPath);
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^data:/i.test(raw)) return raw;

  const base = safeTrim(baseUrl);
  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  if (!base) return normalizedPath;
  return `${base.replace(/\/+$/, '')}${normalizedPath}`;
}

export function normalizeImageList(images: unknown, mainImage?: unknown): string[] {
  const list = Array.isArray(images) ? images : [];
  const normalized = list
    .map((item) => safeTrim(item))
    .filter((item) => !!item);

  const fallback = safeTrim(mainImage);
  if (normalized.length === 0 && fallback) return [fallback];
  return normalized;
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
