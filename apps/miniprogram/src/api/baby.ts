import { get, post, put, del } from '@/utils/request'

export function getBabyList() {
  return get<BabyItem[]>('/weapp/baby-profile')
}

export function getBabyDetail(id: number) {
  return get<BabyItem>(`/weapp/baby-profile/${id}`)
}

export function createBaby(data: BabyForm) {
  return post('/weapp/baby-profile', data)
}

export function updateBaby(data: BabyForm & { id: number }) {
  return put(`/weapp/baby-profile/${data.id}`, data)
}

export function deleteBaby(id: number) {
  return del(`/weapp/baby-profile/${id}`)
}

export interface BabyItem {
  id: number
  nickname: string
  gender: number
  birthday: string
  avatar: string
}

export interface BabyForm {
  nickname: string
  gender: number
  birthday: string
  avatar: string
}
