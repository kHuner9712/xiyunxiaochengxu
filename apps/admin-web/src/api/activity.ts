import request from '@/utils/request'

export interface ActivityProductPayload {
  productId: string
  skuId?: string
  activityPrice?: number
  activityStock?: number
  limitPerUser?: number
}

export interface ActivityPayload {
  name?: string
  type?: '1' | '2' | '3' | '4' | '5'
  description?: string
  rules?: Record<string, unknown>
  bannerImage?: string
  startTime?: string
  endTime?: string
  products?: ActivityProductPayload[]
}

export const activityApi = {
  getList(params: { page: number; pageSize: number; name?: string; status?: number; type?: string }) {
    return request.get('/admin/activity/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/activity/${encodeURIComponent(id)}`)
  },
  create(data: ActivityPayload) {
    return request.post('/admin/activity', data)
  },
  update(id: string, data: ActivityPayload) {
    return request.put(`/admin/activity/${encodeURIComponent(id)}`, data)
  },
  delete(id: string) {
    return request.delete(`/admin/activity/${encodeURIComponent(id)}`)
  },
  updateStatus(id: string, status: 0 | 1 | 2) {
    return request.put(`/admin/activity/${encodeURIComponent(id)}/status`, { status })
  },
}
