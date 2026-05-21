import request from '@/utils/request'

export const pointsApi = {
  getList() {
    return request.get('/admin/points/records')
  },
  adjustPoints(data: { userId: string; points: number; description: string }) {
    return request.post('/admin/points/adjust', data)
  },
}
