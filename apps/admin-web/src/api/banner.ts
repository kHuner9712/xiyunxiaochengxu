import request from '@/utils/request'

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
    return request.post('/admin/banner', data)
  },
  update(id: string, data: BannerPayload) {
    return request.put(`/admin/banner/${encodeURIComponent(id)}`, data)
  },
  delete(id: string) {
    return request.delete(`/admin/banner/${encodeURIComponent(id)}`)
  },
}
