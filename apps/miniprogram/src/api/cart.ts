import { get, post, put, del } from '@/utils/request'

export function getCartList() {
  return get<CartItem[]>('/cart/list')
}

export function addToCart(data: { productId: number; skuId: number; quantity: number }) {
  return post('/cart/add', data)
}

export function updateCartItem(data: { id: number; quantity: number }) {
  return put('/cart/update', data)
}

export function removeCartItem(id: number) {
  return del(`/cart/remove/${id}`)
}

export function clearCart() {
  return del('/cart/clear')
}

export interface CartItem {
  id: number
  productId: number
  skuId: number
  productName: string
  productImage: string
  skuName: string
  price: number
  quantity: number
  stock: number
}
