import request from '@/utils/request'

export const reconcileApi = {
  reconcilePayments() {
    return request.post('/admin/payment/reconcile')
  },
  reconcileRefunds() {
    return request.post('/admin/refund/reconcile')
  },
  syncRefund(outRefundNo: string) {
    return request.post(`/admin/refund/sync/${outRefundNo}`)
  },
  listCompensationTasks(params: { page: number; pageSize: number; status?: string; orderNo?: string }) {
    return request.get('/admin/payment/compensation-tasks', { params })
  },
  resolveCompensationTask(id: string, data: { status: 'resolved' | 'ignored'; resolution: string }) {
    return request.post(`/admin/payment/compensation-tasks/${id}/resolve`, data)
  },
}
