import { del, post, put, removeToken } from '@/utils/request'

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
  // A successful cancellation has already revoked all server sessions. Remove the persisted token
  // immediately so a subsequent local-state cleanup cannot accidentally issue an authenticated
  // request with a tombstoned account.
  removeToken()
  return result
}
