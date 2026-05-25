import { get, post } from '@/utils/request'

export interface ShareRecordResult {
  success: boolean
  shareRecordId: string
  sceneCode: string
  pointsAwarded: number
  todayShareCount: number
}

export interface SharePosterData {
  type: string
  userId: string
  qrCodeUrl: string
  shareUrl: string
  product?: any
  activity?: any
  content?: any
  inviter?: any
}

export interface MyShareStats {
  inviteCount: number
  totalRewardPoints: number
  recentInvites: any[]
}

export function recordShare(data: {
  shareType: string
  shareTargetId?: string
  shareChannel?: string
  campaignId?: string
  shareScene?: string
  sharePath?: string
}) {
  return post<ShareRecordResult>('/weapp/share/record', data)
}

export function recordVisit(data: {
  shareRecordId?: string
  inviter?: string
  campaignId?: string
  sceneCode?: string
}) {
  return post('/weapp/share/visit', data)
}

export function bindInvite(data: {
  inviter?: string
  shareRecordId?: string
  campaignId?: string
}) {
  return post('/weapp/share/bind-invite', data)
}

export function getSharePoster(params: { type: string; targetId?: string }) {
  return get<SharePosterData>('/weapp/share/poster', params)
}

export function getMyShareStats() {
  return get<MyShareStats>('/weapp/share/my-stats')
}
