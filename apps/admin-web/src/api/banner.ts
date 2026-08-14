import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

export interface BannerPayload {
  title?: string
  image?: string
  linkType?: 0 | 1 | 2 | 3
  linkValue?: string
  sortOrder?: number
  status?: 0 | 1
}

export const bannerApi = {
  getList() {
    return request.get('/admin/banner/list')
  },
  create(data: BannerPayload) {
    return runSingleFlight('admin:banner:create', () => request.post('/admin/banner', data))
  },
  update(id: string, data: BannerPayload) {
    return runSingleFlight(`admin:banner:update:${id}`, () =>
      request.put(`/admin/banner/${encodeURIComponent(id)}`, data),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:banner:delete:${id}`, () =>
      request.delete(`/admin/banner/${encodeURIComponent(id)}`),
    )
  },
}
