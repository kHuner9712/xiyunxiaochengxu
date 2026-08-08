import { get, post, put, del } from '@/utils/request'

export function getBabyList() {
  return get<BabyItem[]>('/weapp/baby-profile')
}

export function getBabyDetail(id: string) {
  return get<BabyItem>(`/weapp/baby-profile/${encodeURIComponent(id)}`)
}

export function createBaby(data: BabyForm) {
  return post('/weapp/baby-profile', normalizeBabyPayload(data))
}

export function updateBaby(data: BabyForm & { id: string }) {
  return put(`/weapp/baby-profile/${encodeURIComponent(data.id)}`, normalizeBabyPayload(data))
}

export function deleteBaby(id: string) {
  return del(`/weapp/baby-profile/${encodeURIComponent(id)}`)
}

function normalizeBabyPayload<T extends BabyForm>(data: T) {
  const payload = { ...(data as T & { id?: string }) }
  delete payload.id
  return {
    ...payload,
    avatarUrl: payload.avatarUrl ?? payload.avatar ?? '',
  }
}

export interface BabyItem {
  id: string
  nickname: string
  gender: number
  birthday: string
  avatar?: string
  avatarUrl?: string
}

export interface BabyForm {
  nickname: string
  gender: number
  birthday: string
  avatar?: string
  avatarUrl?: string
}
