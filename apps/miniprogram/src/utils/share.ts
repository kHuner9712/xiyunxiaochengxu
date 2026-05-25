import { recordVisit, bindInvite } from '@/api/share'

interface ShareParams {
  inviter?: string
  shareRecordId?: string
  campaignId?: string
  sceneCode?: string
}

export function parseShareParams(query: Record<string, any>): ShareParams {
  return {
    inviter: query.inviter || undefined,
    shareRecordId: query.shareRecordId || undefined,
    campaignId: query.campaignId || undefined,
    sceneCode: query.scene || undefined,
  }
}

export function handleShareVisit(params: ShareParams) {
  if (params.inviter || params.shareRecordId || params.sceneCode) {
    recordVisit(params).catch(() => {})
  }
}

export function handleShareBindOnLogin() {
  const pending = uni.getStorageSync('pending_invite')
  if (!pending) return
  try {
    const data = JSON.parse(pending)
    bindInvite(data).catch(() => {})
    uni.removeStorageSync('pending_invite')
  } catch {}
}

export function savePendingInvite(params: ShareParams) {
  if (params.inviter) {
    uni.setStorageSync('pending_invite', JSON.stringify(params))
  }
}
