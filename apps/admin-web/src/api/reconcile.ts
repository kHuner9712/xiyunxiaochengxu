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
}
