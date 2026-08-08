import request from '@/utils/request'

export const userApi = {
  getList(params: { page: number; pageSize: number; nickname?: string; phone?: string; memberLevel?: number }) {
    return request.get('/admin/user/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/user/detail/${encodeURIComponent(id)}`)
  },
  updateStatus(id: string, status: number) {
    return request.put(`/admin/user/status/${encodeURIComponent(id)}`, { status })
  },
  adjustLevel(id: string, memberLevelId: string, reason?: string) {
    return request.put(`/admin/user/level/${encodeURIComponent(id)}`, { memberLevelId, reason })
  },
  adjustPoints(id: string, points: number, reason: string) {
    return request.put(`/admin/user/points/${encodeURIComponent(id)}`, { points, reason })
  },
  getBabyList(params: { page: number; pageSize: number; name?: string; userId?: string }) {
    return request.get('/admin/baby-profile', { params })
  },
}
