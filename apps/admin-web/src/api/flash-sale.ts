import request from '@/utils/request'

export const flashSaleApi = {
  // 活动管理
  getActivities(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
    productId?: number
  }) {
    return request.get('/admin/flash-sale/activity/list', { params })
  },
  getActivityDetail(id: string | number) {
    return request.get(`/admin/flash-sale/activity/detail/${id}`)
  },
  createActivity(data: any) {
    return request.post('/admin/flash-sale/activity/create', data)
  },
  updateActivity(id: string | number, data: any) {
    return request.put(`/admin/flash-sale/activity/update/${id}`, data)
  },
  updateActivityStatus(id: string | number, status: number) {
    return request.put(`/admin/flash-sale/activity/status/${id}`, { status })
  },
  deleteActivity(id: string | number) {
    return request.delete(`/admin/flash-sale/activity/delete/${id}`)
  },
  // 秒杀订单
  getOrders(params: any) {
    return request.get('/admin/flash-sale/orders', { params })
  },
  getOrderDetail(id: string | number) {
    return request.get(`/admin/flash-sale/orders/${id}`)
  },
  getStats() {
    return request.get('/admin/flash-sale/stats')
  },
  releaseExpiredLocks() {
    return request.put('/admin/flash-sale/release-expired-locks')
  },
}
