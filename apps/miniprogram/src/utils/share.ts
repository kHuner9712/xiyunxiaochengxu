import { recordVisit, bindInvite } from '@/api/share'

interface ShareParams {
  inviter?: string
  shareRecordId?: string
  campaignId?: string
  sceneCode?: string
}

let isBindingInvite = false

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
    await bindInvite(data)
    uni.removeStorageSync('pending_invite')
    return true
  } catch (err) {
    throw err
  } finally {
    isBindingInvite = false
  }
}

export function savePendingInvite(params: ShareParams) {
  if (params.inviter || params.shareRecordId || params.campaignId) {
    uni.setStorageSync('pending_invite', JSON.stringify(params))
  }
}
