import { describe, it, expect } from '@jest/globals';
import {
  serializeProductCard,
  formatSkuSpecs,
  toPublicAssetUrl,
  normalizeImageList,
} from './serializers';

describe('serializeProductCard', () => {
  const baseProduct = {
    id: 1n,
    name: '婴儿连体衣',
    mainImage: 'https://example.com/image.jpg',
    minPrice: 9900,
    totalSales: 128,
  };

  it('should map mainImage to image', () => {
    const result = serializeProductCard(baseProduct);
    expect(result.image).toBe('https://example.com/image.jpg');
  });

  it('should map minPrice to price', () => {
    const result = serializeProductCard(baseProduct);
    expect(result.price).toBe(9900);
  });

  it('should map totalSales to sales', () => {
    const result = serializeProductCard(baseProduct);
    expect(result.sales).toBe(128);
  });

  it('should fallback originalPrice to minPrice when not provided', () => {
    const result = serializeProductCard(baseProduct);
    expect(result.originalPrice).toBe(9900);
  });

  it('should use provided originalPrice', () => {
    const result = serializeProductCard({ ...baseProduct, originalPrice: 19900 });
    expect(result.originalPrice).toBe(19900);
  });

  it('should convert BigInt id to string', () => {
    const result = serializeProductCard(baseProduct);
    expect(result.id).toBe('1');
  });

  it('should convert string id as-is', () => {
    const result = serializeProductCard({ ...baseProduct, id: '123' });
    expect(result.id).toBe('123');
  });

  it('should set tag to "推荐" when isRecommend=1 and no explicit tag', () => {
    const result = serializeProductCard({ ...baseProduct, isRecommend: 1 });
    expect(result.tag).toBe('推荐');
  });

  it('should not set tag when isRecommend is not 1 and no explicit tag', () => {
    const result = serializeProductCard({ ...baseProduct, isRecommend: 0 });
    expect(result.tag).toBeUndefined();
  });

  it('should use explicit tag over isRecommend', () => {
    const result = serializeProductCard({ ...baseProduct, isRecommend: 1, tag: '新品' });
    expect(result.tag).toBe('新品');
  });

  it('should preserve explicit tag', () => {
    const result = serializeProductCard({ ...baseProduct, tag: '限时折扣' });
    expect(result.tag).toBe('限时折扣');
  });

  it('should return all ProductCardVO fields', () => {
    const result = serializeProductCard(baseProduct);
    expect(Object.keys(result).sort()).toEqual(
      ['id', 'name', 'image', 'price', 'originalPrice', 'sales', 'tag'].sort()
    );
  });
});

describe('formatSkuSpecs', () => {
  it('formats object specs to readable text', () => {
    expect(formatSkuSpecs({ 颜色: '红色', 尺码: 'L' })).toBe('颜色：红色 / 尺码：L');
  });

  it('keeps string specs as-is', () => {
    expect(formatSkuSpecs('默认规格')).toBe('默认规格');
  });
});

describe('toPublicAssetUrl', () => {
  it('keeps absolute https url unchanged', () => {
    const url = 'https://cdn.example.com/uploads/a.png';
    expect(toPublicAssetUrl(url, 'https://api.example.com')).toBe(url);
  });

  it('joins relative uploads path with base url', () => {
    expect(toPublicAssetUrl('/uploads/a.png', 'https://api.example.com/')).toBe(
      'https://api.example.com/uploads/a.png',
    );
  });

  it('does not duplicate base path when UPLOAD_PUBLIC_URL includes /uploads', () => {
    expect(toPublicAssetUrl('/uploads/public/a.png', 'https://api.example.com/uploads')).toBe(
      'https://api.example.com/uploads/public/a.png',
    );
  });

  it('does not duplicate base path when UPLOAD_PUBLIC_URL includes /uploads/public', () => {
    expect(toPublicAssetUrl('/uploads/public/a.png', 'https://api.example.com/uploads/public')).toBe(
      'https://api.example.com/uploads/public/a.png',
    );
  });
});

describe('normalizeImageList', () => {
  it('returns array values when provided', () => {
    expect(normalizeImageList(['a', 'b'], 'c')).toEqual(['a', 'b']);
  });

  it('falls back to main image when list is empty', () => {
    expect(normalizeImageList([], '/uploads/main.png')).toEqual(['/uploads/main.png']);
  });
});
