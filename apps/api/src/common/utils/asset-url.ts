import { normalizeImageList, toPublicAssetUrl } from '@baby-mall/shared';

export function getAssetBaseUrl(): string {
  return (process.env.UPLOAD_PUBLIC_URL || process.env.PUBLIC_ASSET_BASE_URL || '').trim();
}

export function normalizeAssetUrl(urlOrPath: unknown, baseUrl = getAssetBaseUrl()): string {
  return toPublicAssetUrl(urlOrPath, baseUrl);
}

export function normalizeAssetUrlList(values: unknown, baseUrl = getAssetBaseUrl()): string[] {
  if (!Array.isArray(values)) return [];
  return values
    .map((item: unknown) => normalizeAssetUrl(item, baseUrl))
    .filter((item: string) => !!item);
}

export function normalizeProductImages(images: unknown, mainImage: unknown, baseUrl = getAssetBaseUrl()): string[] {
  const normalizedSource = normalizeImageList(images, mainImage);
  return normalizedSource
    .map((item: string) => normalizeAssetUrl(item, baseUrl))
    .filter((item: string) => !!item);
}
