import { post } from '@/utils/request'

export function wxLogin(data: { code: string }) {
  return post<{ token: string; isNewUser: boolean }>('/auth/wx-login', data)
}

export function bindPhone(data: { code: string }) {
  return post<{ token: string }>('/auth/bind-phone', data)
}

export function getPhone(data: { code: string }) {
  return post<{ phone: string }>('/auth/get-phone', data)
}
