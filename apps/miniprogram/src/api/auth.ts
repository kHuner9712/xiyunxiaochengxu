import { del, post, put, removeToken, REDIRECT_AFTER_LOGIN_KEY } from '@/utils/request'
import { clearShareAttributionState } from '@/utils/share'
import { clearPersistentIdempotencyState } from '@/utils/checkout-idempotency'

export function wxLogin(data: { code: string }) {
  return post<{ token: string; isNewUser: boolean }>('/weapp/auth/login', data)
}

export function logout() {
  return post<null>('/weapp/auth/logout')
}

export function bindPhone(data: { code: string; encryptedData?: string; iv?: string }) {
  return post<{ phone: string }>('/weapp/auth/phone', data)
}

export function updateProfile(data: { nickname?: string; avatar?: string; avatarUrl?: string }) {
  return put('/weapp/user/profile', data)
}

export async function cancelAccount() {
  const result = await del<{ cancelled: boolean; cancelledAt: string }>('/weapp/user/account')
  // The server has atomically revoked every session and anonymized the account at this point.
  // Clear all account-bound device context before a later account can inherit attribution or a
  // pending write identity created by the deleted account.
  removeToken()
  uni.removeStorageSync(REDIRECT_AFTER_LOGIN_KEY)
  clearShareAttributionState()
  clearPersistentIdempotencyState()
  return result
}
