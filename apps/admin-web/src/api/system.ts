import request from '@/utils/request'

export const systemApi = {
  getConfig() {
    return request.get('/admin/system/config')
  },
  updateConfig(data: any) {
    return request.put('/admin/system/config', data)
  },
}
