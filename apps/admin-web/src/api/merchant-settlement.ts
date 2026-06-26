import request from '@/utils/request'

export const merchantSettlementApi = {
  // 规则管理
  getRules(params: any) {
    return request.get('/admin/merchant-settlement/rule/list', { params })
  },
  getRuleDetail(id: string | number) {
    return request.get(`/admin/merchant-settlement/rule/detail/${id}`)
  },
  createRule(data: any) {
    return request.post('/admin/merchant-settlement/rule/create', data)
  },
  updateRule(id: string | number, data: any) {
    return request.put(`/admin/merchant-settlement/rule/update/${id}`, data)
  },
  updateRuleStatus(id: string | number, status: number) {
    return request.put(`/admin/merchant-settlement/rule/status/${id}`, { status })
  },
  deleteRule(id: string | number) {
    return request.delete(`/admin/merchant-settlement/delete/rule/${id}`)
  },
  // 分佣明细
  getRecords(params: any) {
    return request.get('/admin/merchant-settlement/records', { params })
  },
  getRecordsStats() {
    return request.get('/admin/merchant-settlement/records/stats')
  },
  updateRecordStatus(id: string | number, data: { status: string; remark?: string }) {
    return request.put(`/admin/merchant-settlement/records/${id}/status`, data)
  },
  // 结算批次
  getBatches(params: any) {
    return request.get('/admin/merchant-settlement/batches', { params })
  },
  getBatchDetail(id: string | number) {
    return request.get(`/admin/merchant-settlement/batches/${id}`)
  },
  previewBatch(data: any) {
    return request.post('/admin/merchant-settlement/batches/preview', data)
  },
  createBatch(data: any) {
    return request.post('/admin/merchant-settlement/batches/create', data)
  },
  confirmBatch(id: string | number, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${id}/confirm`, data || {})
  },
  markBatchPaid(id: string | number, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${id}/paid`, data || {})
  },
  cancelBatch(id: string | number, data?: { remark?: string }) {
    return request.put(`/admin/merchant-settlement/batches/${id}/cancel`, data || {})
  },
  // 报表
  reportMerchant(params: any) {
    return request.get('/admin/merchant-settlement/report/merchant', { params })
  },
  reportMonthly(params: any) {
    return request.get('/admin/merchant-settlement/report/monthly', { params })
  },
}
