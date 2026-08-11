import request from '@/utils/request'

export const groupBuyApi = {
  getActivities(params: {
    page: number
    pageSize: number
    keyword?: string
    status?: number
    productId?: string
  }) {
    return request.get('/admin/group-buy/activity/list', { params })
  },
  getActivityDetail(id: string) {
    return request.get(`/admin/group-buy/activity/detail/${encodeURIComponent(id)}`)
  },
  createActivity(data: any) {
    return request.post('/admin/group-buy/activity/create', data)
  },
  updateActivity(id: string, data: any) {
    return request.put(`/admin/group-buy/activity/update/${encodeURIComponent(id)}`, data)
  },
  updateActivityStatus(id: string, status: number) {
    return request.put(`/admin/group-buy/activity/status/${encodeURIComponent(id)}`, { status })
  },
  deleteActivity(id: string) {
    return request.delete(`/admin/group-buy/activity/delete/${encodeURIComponent(id)}`)
  },
  getGroups(params: any) {
    return request.get('/admin/group-buy/groups', { params })
  },
  getGroupDetail(id: string) {
    return request.get(`/admin/group-buy/groups/${encodeURIComponent(id)}`)
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
