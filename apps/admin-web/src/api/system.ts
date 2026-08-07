import request from '@/utils/request'

export interface SystemConfigEntry {
  groupName: string
  configKey: string
  configValue: string
  valueType?: 'string' | 'number' | 'boolean' | 'json'
}

export const systemApi = {
  getConfig() {
    return request.get('/admin/system-config/list')
  },
  updateConfig(configs: SystemConfigEntry[]) {
    return request.put('/admin/system-config/batch-update', { configs })
  },
  getCustomerServiceConfig() {
    return request.get('/admin/customer-service/config')
  },
  updateCustomerServiceConfig(data: any) {
    return request.put('/admin/customer-service/config', data)
  },
}
