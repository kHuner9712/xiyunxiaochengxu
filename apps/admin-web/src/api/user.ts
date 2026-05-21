import request from '@/utils/request'

export const userApi = {
  getList(params: { page: number; pageSize: number; nickname?: string; phone?: string; memberLevel?: number }) {
    return request.get('/admin/user/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/user/detail/${id}`)
  },
  updateStatus(id: number, status: number) {
    return request.put(`/admin/user/status/${id}`, { status })
  },
  adjustPoints(id: number, points: number, reason: string) {
    return request.put(`/admin/user/points/${id}`, { points, reason })
  },
  getBabyList(params: { page: number; pageSize: number; name?: string; userId?: number }) {
    return request.get('/admin/user/baby-list', { params })
  },
}
