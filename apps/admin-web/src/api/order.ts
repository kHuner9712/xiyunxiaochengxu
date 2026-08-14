import request from '@/utils/request'

const DELIVERY_FIELD_MAX_LENGTH = 50

function normalizeDeliveryField(value: string, label: string) {
  const normalized = String(value || '').trim()
  if (!normalized) throw new Error(`${label}不能为空`)
  if (normalized.length > DELIVERY_FIELD_MAX_LENGTH) {
    throw new Error(`${label}最多${DELIVERY_FIELD_MAX_LENGTH}个字符`)
  }
  return normalized
}

function normalizeDeliveryRow<T extends { orderId: string; logisticsCompany: string; logisticsNo: string }>(row: T) {
  return {
    ...row,
    logisticsCompany: normalizeDeliveryField(row.logisticsCompany, '物流公司'),
    logisticsNo: normalizeDeliveryField(row.logisticsNo, '物流单号'),
  }
}

export const orderApi = {
  getList(params: { page: number; pageSize: number; orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/list', { params })
  },
  getDetail(id: string) {
    return request.get(`/admin/order/detail/${encodeURIComponent(id)}`)
  },
  remark(id: string, remark: string) {
    return request.put(`/admin/order/remark/${encodeURIComponent(id)}`, { remark })
  },
  cancel(id: string, reason: string) {
    return request.put(`/admin/order/cancel/${encodeURIComponent(id)}`, { reason })
  },
  getDeliveryList(params: { page: number; pageSize: number; orderNo?: string }) {
    return request.get('/admin/order/delivery-list', { params })
  },
  deliver(data: { orderId: string; logisticsCompany: string; logisticsNo: string }) {
    return request.post('/admin/order/deliver', normalizeDeliveryRow(data))
  },
  batchDeliver(data: { orders: { orderId: string; logisticsCompany: string; logisticsNo: string }[] }) {
    return request.post('/admin/order/batch-deliver', {
      orders: data.orders.map((row) => normalizeDeliveryRow(row)),
    })
  },
  export(params: { orderNo?: string; status?: string; startDate?: string; endDate?: string; fulfillmentType?: string }) {
    return request.get('/admin/order/export', { params, responseType: 'blob' })
  },
}
