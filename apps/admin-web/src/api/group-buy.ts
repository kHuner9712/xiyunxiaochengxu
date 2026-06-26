import request from '@/utils/request'

export const groupBuyApi = {
  // 活动管理
  getActivities(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
    productId?: number
  }) {
    return request.get('/admin/group-buy/activity/list', { params })
  },
  getActivityDetail(id: string | number) {
    return request.get(`/admin/group-buy/activity/detail/${id}`)
  },
  createActivity(data: any) {
    return request.post('/admin/group-buy/activity/create', data)
  },
  updateActivity(id: string | number, data: any) {
    return request.put(`/admin/group-buy/activity/update/${id}`, data)
  },
  updateActivityStatus(id: string | number, status: number) {
    return request.put(`/admin/group-buy/activity/status/${id}`, { status })
  },
  deleteActivity(id: string | number) {
    return request.delete(`/admin/group-buy/activity/delete/${id}`)
  },
  // 团单
  getGroups(params: any) {
    return request.get('/admin/group-buy/groups', { params })
  },
  getGroupDetail(id: string | number) {
    return request.get(`/admin/group-buy/groups/${id}`)
  },
  getMembers(params: any) {
    return request.get('/admin/group-buy/members', { params })
  },
  getStats() {
    return request.get('/admin/group-buy/stats')
  },
  markExpired() {
    return request.post('/admin/group-buy/groups/mark-expired')
  },
}
