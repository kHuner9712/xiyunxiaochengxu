import request from '@/utils/request'

export const pickupStoreApi = {
  getList(params: { page: number; pageSize: number; keyword?: string; status?: number }) {
    return request.get('/admin/pickup-store/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/pickup-store/${id}`)
  },
  create(data: any) {
    return request.post('/admin/pickup-store', data)
  },
  update(id: number, data: any) {
    return request.put(`/admin/pickup-store/${id}`, data)
  },
  delete(id: number) {
    return request.delete(`/admin/pickup-store/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/pickup-store/${id}/status`, { status })
  },
  verifyPickupCode(pickupCode: string) {
    return request.post('/admin/pickup-store/verify', { pickupCode })
  },
  previewPickupCode(pickupCode: string) {
    return request.get('/admin/pickup-store/preview', { params: { pickupCode } })
  },
}

export interface PickupOrderPreview {
  orderId: string
  orderNo: string
  status: string
  fulfillmentType: string
  totalAmount: number
  payAmount: number
  userName: string
  userPhone: string
  items: Array<{
    id: string
    productName: string
    skuName: string
    productImage: string
    price: number
    quantity: number
    subtotal: number
  }>
  pickupStoreName: string | null
  pickupStoreAddress: string | null
  pickupContactPhone: string | null
  pickupCode: string | null
  pickedUpAt: string | null
  createTime: string
  alreadyCompleted: boolean
}
