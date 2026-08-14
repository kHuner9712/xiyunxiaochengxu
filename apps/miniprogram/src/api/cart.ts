import { get, post, put, del } from '@/utils/request'
import { runPersistentIdempotentAction } from '@/utils/checkout-idempotency'

export interface CartItem {
  id: string
  productId: string
  skuId: string
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  stock: number
  isValid?: boolean
  isSelected: boolean
}

export function getCartList() {
  return get<CartItem[]>('/weapp/cart/list')
}

export function addToCart(data: { productId?: string; skuId: string; quantity: number }) {
  return runPersistentIdempotentAction(
    `cart:add:${data.skuId}`,
    data,
    (clientRequestId) => post<CartItem>('/weapp/cart/add', { ...data, clientRequestId }),
  )
}

export function updateCartItem(data: { id: string; quantity?: number; isSelected?: number }) {
  return put<CartItem>('/weapp/cart/update', data)
}

export function deleteCartItem(id: string) {
  return del(`/weapp/cart/delete/${encodeURIComponent(id)}`)
}

export function selectAllCart(isSelected: number) {
  return put('/weapp/cart/select-all', { isSelected })
}

export function deleteSelectedItems() {
  return del('/weapp/cart/remove-selected')
}
