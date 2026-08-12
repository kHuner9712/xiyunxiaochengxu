import { del, post, put } from '@/utils/request'

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

export function cancelAccount() {
  return del<{ cancelled: boolean; cancelledAt: string }>('/weapp/user/account')
}
