import { get, post } from '@/utils/request'

export function recordShare(data: { type: number; targetId: number }) {
  return post('/weapp/share/record', data)
}

export function getShareInfo(params: { type: number; targetId: number }) {
  return get<{
    title: string
    imageUrl: string
    path: string
  }>('/weapp/share/poster', params)
}
