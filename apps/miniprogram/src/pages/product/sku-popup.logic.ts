export interface PopupSku {
  id: string
  stock: number
  specText?: string
}

interface EnsureSellableSkuSelectionResult {
  sku: PopupSku | null
  shouldOpenPopup: boolean
}

export function ensureSellableSkuSelection(
  skus: PopupSku[],
  selectedSkuId: string,
): EnsureSellableSkuSelectionResult {
  const current = skus.find((sku) => sku.id === selectedSkuId && sku.stock > 0) || null
  if (current) {
    return { sku: current, shouldOpenPopup: true }
  }
  const fallback = skus.find((sku) => sku.stock > 0) || null
  if (!fallback) {
    return { sku: null, shouldOpenPopup: false }
  }
  return { sku: fallback, shouldOpenPopup: true }
}