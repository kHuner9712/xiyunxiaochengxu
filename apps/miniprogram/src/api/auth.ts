import { post } from '@/utils/request'

export function wxLogin(data: { code: string }) {
  return post<{ token: string; isNewUser: boolean }>('/weapp/auth/login', data)
}

export function bindPhone(data: { code: string }) {
  return post<{ token: string }>('/weapp/auth/phone', data)
}
