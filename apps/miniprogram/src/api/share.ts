import { post } from '@/utils/request'

export function recordShare(data: { type: number; targetId: number }) {
  return post('/share/record', data)
}

export function getShareInfo(params: { type: number; targetId: number }) {
  return post<{
    title: string
    imageUrl: string
    path: string
  }>('/share/info', params)
}
