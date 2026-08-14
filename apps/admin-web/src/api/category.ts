import request from '@/utils/request'
import { runSingleFlight } from '@/utils/single-flight'

export interface CategoryComplianceConfig {
  isFood?: boolean
  isHealthSupplement?: boolean
  isInfantFormula?: boolean
  requiresCertImages?: boolean
  requiredComplianceFields?: string[]
}

export interface CategoryPayload {
  name: string
  parentId?: string
  sortOrder?: number
  icon?: string
  isShow?: 0 | 1
  complianceConfig?: CategoryComplianceConfig
  clientRequestId?: string
}

export interface CategoryRecord extends CategoryPayload {
  id: string
  parentId: string
  children?: CategoryRecord[]
}

export const categoryApi = {
  getTree() {
    return request.get('/admin/category/list')
  },
  getDetail(id: string) {
    return request.get(`/admin/category/detail/${encodeURIComponent(id)}`)
  },
  create(data: CategoryPayload) {
    return runSingleFlight('admin:category:create', () =>
      request.post('/admin/category/create', data),
    )
  },
  update(id: string, data: CategoryPayload) {
    return runSingleFlight(`admin:category:update:${id}`, () =>
      request.put(`/admin/category/update/${encodeURIComponent(id)}`, data),
    )
  },
  delete(id: string) {
    return runSingleFlight(`admin:category:delete:${id}`, () =>
      request.delete(`/admin/category/delete/${encodeURIComponent(id)}`),
    )
  },
}
