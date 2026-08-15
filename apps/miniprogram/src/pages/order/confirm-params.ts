import { CART_MAX_ITEMS, CART_MAX_QUANTITY } from '@baby-mall/shared'

export interface OrderConfirmParamItem {
  productId: string
  skuId: string
  quantity: number
  productName: string
  productImage: string
  skuName: string
  price: number
}

function firstOptionValue(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value
}

function normalizePositiveId(value: unknown): string | null {
  const id = String(value ?? '').trim()
  return /^[1-9]\d*$/.test(id) ? id : null
}

function normalizeQuantity(value: unknown): number | null {
  const quantity = Number(value)
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > CART_MAX_QUANTITY) return null
  return quantity
}

function normalizePrice(value: unknown): number {
  const price = Number(value)
  return Number.isFinite(price) && price >= 0 ? price : 0
}

function normalizeItem(value: unknown): OrderConfirmParamItem | null {
  if (!value || typeof value !== 'object') return null
  const row = value as Record<string, unknown>
  const productId = normalizePositiveId(row.productId)
  const skuId = normalizePositiveId(row.skuId)
  const quantity = normalizeQuantity(row.quantity)
  if (!productId || !skuId || quantity === null) return null

  return {
    productId,
    skuId,
    quantity,
    productName: String(row.productName ?? ''),
    productImage: String(row.productImage ?? ''),
    skuName: String(row.skuName ?? ''),
    price: normalizePrice(row.price),
  }
}

export function parseOrderConfirmItemsParam(value: unknown): OrderConfirmParamItem[] | null {
  const rawValue = firstOptionValue(value)
  if (typeof rawValue !== 'string' || !rawValue.trim()) return null

  const candidates = [rawValue]
  try {
    const decoded = decodeURIComponent(rawValue)
    if (decoded !== rawValue) candidates.push(decoded)
  } catch {
    // Keep the raw candidate. A malformed percent-encoding must not escape into page onLoad.
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > CART_MAX_ITEMS) continue
      const items = parsed.map(normalizeItem)
      if (items.some((item) => item === null)) continue
      const normalized = items as OrderConfirmParamItem[]
      const skuIds = normalized.map((item) => item.skuId)
      if (new Set(skuIds).size !== skuIds.length) continue
      return normalized
    } catch {
      // Try the next representation (raw or URL-decoded).
    }
  }

  return null
}

export function parseSingleOrderConfirmItem(options: Record<string, unknown> | undefined): OrderConfirmParamItem[] | null {
  if (!options) return null
  const productId = normalizePositiveId(firstOptionValue(options.productId))
  const skuId = normalizePositiveId(firstOptionValue(options.skuId))
  const quantity = normalizeQuantity(firstOptionValue(options.quantity) ?? 1)
  if (!productId || !skuId || quantity === null) return null

  return [{
    productId,
    skuId,
    quantity,
    productName: '',
    productImage: '',
    skuName: '',
    price: 0,
  }]
}
