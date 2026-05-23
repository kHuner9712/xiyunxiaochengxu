import request from '@/utils/request'

export const businessEventApi = {
  getList(params: {
    level?: string
    bizType?: string
    eventType?: string
    createdAt?: string
    page?: number
    pageSize?: number
  }) {
    return request.get('/admin/business-events/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/business-events/detail/${id}`)
  },
}
