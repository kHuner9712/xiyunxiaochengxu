import { get, post, put, del } from '@/utils/request'

export function getCartList() {
  return get<CartItem[]>('/weapp/cart/list')
}

export function addToCart(data: { productId: number; skuId: number; quantity: number }) {
  return post('/weapp/cart/add', data)
}

export function updateCartItem(data: { id: number; quantity: number }) {
  return put('/weapp/cart/update', data)
}

export function removeCartItem(id: number) {
  return del(`/weapp/cart/delete/${id}`)
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
