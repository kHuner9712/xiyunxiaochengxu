import request from '@/utils/request'

export interface ActivityContentItem {
  id: string
  title: string
  subtitle?: string | null
  type: string
  coverImage?: string | null
  summary?: string | null
  content?: string | null
  videoUrl?: string | null
  linkedProductId?: string | null
  status: number
  sortOrder: number
  viewCount: number
  startsAt?: string | null
  endsAt?: string | null
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export interface ActivityContentListParams {
  page: number
  pageSize: number
  keyword?: string
  type?: string
  status?: number
}

export const activityContentApi = {
  getList(params: ActivityContentListParams) {
    return request.get('/admin/activity-content/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/activity-content/detail/${encodeURIComponent(id)}`)
  },
  create(data: any) {
    return request.post('/admin/activity-content/create', data)
  },
  update(id: string, data: any) {
    return request.put(`/admin/activity-content/update/${encodeURIComponent(id)}`, data)
  },
  updateStatus(id: string, status: number) {
    return request.put(`/admin/activity-content/status/${encodeURIComponent(id)}`, { status })
  },
  delete(id: string) {
    return request.delete(`/admin/activity-content/delete/${encodeURIComponent(id)}`)
  },
}
