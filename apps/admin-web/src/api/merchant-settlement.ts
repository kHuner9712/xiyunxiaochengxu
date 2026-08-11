import request from '@/utils/request'

export const merchantSettlementApi = {
  getRules(params: any) {
    return request.get('/admin/merchant-settlement/rule/list', { params })
  },
  getRuleDetail(id: string) {
    return request.get(`/admin/merchant-settlement/rule/detail/${encodeURIComponent(id)}`)
  },
  createRule(data: any) {
    return request.post('/admin/merchant-settlement/rule/create', data)
  },
  updateRule(id: string, data: any) {
    return request.put(`/admin/merchant-settlement/rule/update/${encodeURIComponent(id)}`, data)
  },
  updateRuleStatus(id: string, status: number) {
    return request.put(`/admin/merchant-settlement/rule/status/${encodeURIComponent(id)}`, { status })
  },
  deleteRule(id: string) {
    return request.delete(`/admin/merchant-settlement/delete/rule/${encodeURIComponent(id)}`)
  },
  getRecords(params: any) {
    return request.get('/admin/merchant-settlement/records', { params })
  },
  getRecordsStats() {
    return request.get('/admin/merchant-settlement/records/stats')
  },
  updateRecordStatus(id: string, data: { status: string; remark?: string }) {
    return request.put(`/admin/merchant-settlement/records/${encodeURIComponent(id)}/status`, data)
  },
  getBatches(params: any) {
    return request.get('/admin/merchant-settlement/batches', { params })
  },
  getBatchDetail(id: string) {
    return request.get(`/admin/merchant-settlement/batches/${encodeURIComponent(id)}`)
  },
  previewBatch(data: any) {
    return request.post('/admin/merchant-settlement/batches/preview', data)
  },
  createBatch(data: any) {
    return request.post('/admin/merchant-settlement/batches/create', data)
  },
  confirmBatch(id: string, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${encodeURIComponent(id)}/confirm`, data || {})
  },
  markBatchPaid(id: string, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${encodeURIComponent(id)}/paid`, data || {})
  },
  cancelBatch(id: string, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${encodeURIComponent(id)}/cancel`, data || {})
  },
  reportMerchant(params: any) {
    return request.get('/admin/merchant-settlement/report/merchant', { params })
  },
  reportMonthly(params: any) {
    return request.get('/admin/merchant-settlement/report/monthly', { params })
  },
}
