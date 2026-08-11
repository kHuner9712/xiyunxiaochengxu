export type ProductListSort = 'default' | 'sales' | 'new' | 'price_asc'

const PRODUCT_LIST_SORTS = new Set<ProductListSort>(['default', 'sales', 'new', 'price_asc'])

export function normalizeProductListSort(value: unknown): ProductListSort {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (normalized === 'hot') return 'sales'
  return PRODUCT_LIST_SORTS.has(normalized as ProductListSort)
    ? normalized as ProductListSort
    : 'default'
}

export function normalizeProductCategoryId(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : ''
  return /^[1-9]\d*$/.test(normalized) ? normalized : ''
}
