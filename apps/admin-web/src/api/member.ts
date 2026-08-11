import request from '@/utils/request'

export interface MemberLevelPayload {
  name?: string
  minGrowthValue?: number
  maxGrowthValue?: number | null
  discountRate?: number | null
  pointsRate?: number
  benefits?: string
  icon?: string
  sortOrder?: number
  status?: 0 | 1
}

export const memberApi = {
  getList() {
    return request.get('/admin/member/levels')
  },
  create(data: MemberLevelPayload) {
    return request.post('/admin/member/levels', data)
  },
  update(id: string, data: MemberLevelPayload) {
    return request.put(`/admin/member/levels/${encodeURIComponent(id)}`, data)
  },
}
