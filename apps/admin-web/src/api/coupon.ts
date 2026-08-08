import request from '@/utils/request'

export type CouponId = string

export interface CouponPayload {
  name: string
  type: 1 | 2 | 3
  value: number
  minAmount?: number
  discountLimit?: number
  totalCount?: number
  perLimit?: number
  startTime: string
  endTime: string
  validDays?: number
  applicableType?: 0 | 1 | 2
  applicableIds?: string[]
  description?: string
  memberLevelId?: string | 0
  isNewUser?: 0 | 1
  status?: 0 | 1
}

export interface CouponRecord extends CouponPayload {
  id: string
  receivedCount: number
  usedCount: number
  status: 0 | 1
  createdAt: string
  updatedAt: string
  remainCount?: number
}

export const couponApi = {
  getList(params: { page: number; pageSize: number; name?: string; type?: number; status?: number }) {
    return request.get('/admin/coupon/list', { params })
  },
  getDetail(id: CouponId) {
    return request.get(`/admin/coupon/${encodeURIComponent(id)}`)
  },
  create(data: CouponPayload) {
    return request.post('/admin/coupon', data)
  },
  update(id: CouponId, data: Partial<CouponPayload>) {
    return request.put(`/admin/coupon/${encodeURIComponent(id)}`, data)
  },
  delete(id: CouponId) {
    return request.delete(`/admin/coupon/${encodeURIComponent(id)}`)
  },
}
