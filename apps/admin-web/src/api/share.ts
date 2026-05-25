import request from '@/utils/request'

export const shareApi = {
  getCampaignList(params?: any) {
    return request.get('/admin/share/campaign/list', { params })
  },
  createCampaign(data: any) {
    return request.post('/admin/share/campaign', data)
  },
  updateCampaign(id: string, data: any) {
    return request.put(`/admin/share/campaign/${id}`, data)
  },
  updateCampaignStatus(id: string, status: number) {
    return request.put(`/admin/share/campaign/${id}/status`, { status })
  },
  getShareRecords(params?: any) {
    return request.get('/admin/share/records', { params })
  },
  getInviteRelations(params?: any) {
    return request.get('/admin/share/invite-relations', { params })
  },
  getShareStats() {
    return request.get('/admin/share/stats')
  },
}
