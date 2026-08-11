import { get, post, put, del } from '@/utils/request'

export function getCartList() {
  return get<CartItem[]>('/weapp/cart/list')
}

export function addToCart(data: { productId: string; skuId: string; quantity: number }) {
  return post('/weapp/cart/add', data)
}

export function updateCartItem(data: { id: string; quantity: number }) {
  return put('/weapp/cart/update', data)
}

export function removeCartItem(id: string) {
  return del(`/weapp/cart/delete/${encodeURIComponent(id)}`)
}

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
}
