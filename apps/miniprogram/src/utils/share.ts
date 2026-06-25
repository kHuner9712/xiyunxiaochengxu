import { recordVisit, bindInvite } from '@/api/share'

interface ShareParams {
  inviter?: string
  shareRecordId?: string
  campaignId?: string
  sceneCode?: string
  sourceType?: string
  sourceCode?: string
  referrerUserId?: string
}

export interface PromotionSourcePayload {
  sourceType?: string
  sourceCode?: string
  shareRecordId?: string
  shareCampaignId?: string
  referrerUserId?: string
}

const PROMOTION_SOURCE_STORAGE_KEY = 'xy_promotion_source'

function normalizeString(value: any): string | undefined {
  if (value === undefined || value === null) return undefined
  const text = String(value).trim()
  return text ? text : undefined
}

function inferSourceType(params: ShareParams): string | undefined {
  if (params.sourceType) return params.sourceType
  // 商家码优先：sourceCode 存在时 sourceType 为 merchant_referral，
  // 但 referrerUserId / shareRecordId / shareCampaignId 仍会保留，不影响邀请关系记录
  if (params.sourceCode) return 'merchant_referral'
  if (params.inviter || params.shareRecordId) return 'user_referral'
  if (params.campaignId) return 'campaign'
  return undefined
}

function toShareApiParams(params: ShareParams): ShareParams {
  return {
    inviter: params.inviter,
    shareRecordId: params.shareRecordId,
    campaignId: params.campaignId,
    sceneCode: params.sceneCode,
  }
}

let isBindingInvite = false

export function parseShareParams(query: Record<string, any>): ShareParams {
  const sourceCode = normalizeString(
    query.sourceCode ||
    query.ref ||
    query.sceneCode ||
    query.promotionCode ||
    query.merchantCode
  )
  const inviter = normalizeString(query.inviter || query.referrerUserId)
  const campaignId = normalizeString(query.campaignId || query.shareCampaignId)
  const params: ShareParams = {
    inviter,
    shareRecordId: normalizeString(query.shareRecordId),
    campaignId,
    sceneCode: normalizeString(query.scene),
    sourceType: normalizeString(query.sourceType),
    sourceCode,
    referrerUserId: inviter,
  }
  params.sourceType = inferSourceType(params)
  return params
}

export function handleShareVisit(params: ShareParams) {
  if (params.inviter || params.shareRecordId || params.sceneCode) {
    recordVisit(toShareApiParams(params)).catch(() => {})
  }
  savePromotionSource(params)
}

export async function handleShareBindOnLogin() {
  if (isBindingInvite) return false
  const pending = uni.getStorageSync('pending_invite')
  if (!pending) return false
  let data: ShareParams
  try {
    data = JSON.parse(pending)
  } catch {
    uni.removeStorageSync('pending_invite')
    return false
  }

  try {
    isBindingInvite = true
    await bindInvite(toShareApiParams(data))
    uni.removeStorageSync('pending_invite')
    return true
  } catch (err: any) {
    const msg = String(err?.message || err?.errMsg || '').toLowerCase()
    if (msg.includes('already_invited') || msg.includes('已绑定') || msg.includes('不能邀请自己')) {
      uni.removeStorageSync('pending_invite')
    }
    return false
  } finally {
    isBindingInvite = false
  }
}

export function savePendingInvite(params: ShareParams) {
  if (params.inviter || params.shareRecordId || params.campaignId) {
    uni.setStorageSync('pending_invite', JSON.stringify(params))
  }
  savePromotionSource(params)
}

export function savePromotionSource(params: ShareParams) {
  const sourceType = inferSourceType(params)
  const sourceCode = params.sourceCode
  const shareRecordId = params.shareRecordId
  const shareCampaignId = params.campaignId
  const referrerUserId = params.referrerUserId || params.inviter

  if (!sourceType && !sourceCode && !shareRecordId && !shareCampaignId && !referrerUserId) return

  const payload: PromotionSourcePayload = {
    sourceType: sourceType || 'direct',
    sourceCode,
    shareRecordId,
    shareCampaignId,
    referrerUserId,
  }

  uni.setStorageSync(PROMOTION_SOURCE_STORAGE_KEY, JSON.stringify(payload))
}

export function getPromotionSourceForOrder(): PromotionSourcePayload {
  const raw = uni.getStorageSync(PROMOTION_SOURCE_STORAGE_KEY)
  if (!raw) return {}
  try {
    const data = JSON.parse(raw)
    return {
      sourceType: normalizeString(data.sourceType),
      sourceCode: normalizeString(data.sourceCode),
      shareRecordId: normalizeString(data.shareRecordId),
      shareCampaignId: normalizeString(data.shareCampaignId),
      referrerUserId: normalizeString(data.referrerUserId),
    }
  } catch {
    uni.removeStorageSync(PROMOTION_SOURCE_STORAGE_KEY)
    return {}
  }
}
