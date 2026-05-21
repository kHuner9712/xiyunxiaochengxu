import request from '@/utils/request'

export const operationLogApi = {
  getList(params: { page: number; pageSize: number; adminName?: string; module?: string; startTime?: string; endTime?: string }) {
    return request.get('/admin/operation-log/list', { params })
  },
  getDetail(id: number) {
    return request.get(`/admin/operation-log/detail/${id}`)
  },
}
