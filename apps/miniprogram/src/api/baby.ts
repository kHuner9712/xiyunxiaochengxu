import { get, post, put, del } from '@/utils/request'

export function getBabyList() {
  return get<BabyItem[]>('/baby/list')
}

export function getBabyDetail(id: number) {
  return get<BabyItem>(`/baby/detail/${id}`)
}

export function createBaby(data: BabyForm) {
  return post('/baby/create', data)
}

export function updateBaby(data: BabyForm & { id: number }) {
  return put('/baby/update', data)
}

export function deleteBaby(id: number) {
  return del(`/baby/delete/${id}`)
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
