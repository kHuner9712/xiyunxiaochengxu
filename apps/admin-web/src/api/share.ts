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
  getRewards(params?: any) {
    return request.get('/admin/share/rewards', { params })
  },
}

export interface InviteRewardItem {
  id: string
  userId: string
  userName: string
  userPhone: string
  inviteeUserId: string | null
  inviteeName: string
  inviteePhone: string
  campaignId: string | null
  campaignName: string
  rewardType: string
  rewardName: string
  couponId: string | null
  couponName: string
  points: number | null
  productId: string | null
  status: string
  sourceType: string
  sourceId: string | null
  issuedAt: string | null
  claimedAt: string | null
  createdAt: string
}
