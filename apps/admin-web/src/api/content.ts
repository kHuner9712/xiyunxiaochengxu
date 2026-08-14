import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

type ContentUpdateInput = string | ({ id: string } & Record<string, any>)

export const contentApi = {
  getList(params: { page: number; pageSize: number; title?: string; contentType?: string; placement?: string; status?: number }) {
    return request.get('/admin/content/list', { params })
  },
  getCategories() {
    return request.get('/weapp/content/categories')
  },
  getDetail(id: string) {
    return request.get(`/admin/content/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return runSingleFlight('admin:content:create', () => request.post('/admin/content', data))
  },
  update(idOrData: ContentUpdateInput, data?: any) {
    const isDirectId = typeof idOrData === 'string'
    const id = isDirectId ? idOrData : idOrData.id
    const payload = isDirectId ? (data || {}) : { ...idOrData }
    delete payload.id
    return runSingleFlight(`admin:content:update:${id}`, () =>
      request.put(`/admin/content/${encodeURIComponent(id)}`, payload),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:content:delete:${id}`, () =>
      request.delete(`/admin/content/${encodeURIComponent(id)}`),
    )
  },
}
