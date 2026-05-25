import request from '@/utils/request'

export const systemApi = {
  getConfig() {
    return request.get('/admin/system-config/list')
  },
  updateConfig(data: any) {
    return request.put('/admin/system-config/update', data)
  },
  getCustomerServiceConfig() {
    return request.get('/admin/customer-service/config')
  },
  updateCustomerServiceConfig(data: any) {
    return request.put('/admin/customer-service/config', data)
  },
}
