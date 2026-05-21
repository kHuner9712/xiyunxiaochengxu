import request from '@/utils/request'

export const dashboardApi = {
  getOverview() {
    return request.get('/admin/dashboard/overview')
  },
  getSalesTrend(params: { startDate: string; endDate: string }) {
    return request.get('/admin/dashboard/sales-trend', { params })
  },
  getTopProducts(params: { limit?: number }) {
    return request.get('/admin/dashboard/top-products', { params })
  },
  getRecentOrders(params: { limit?: number }) {
    return request.get('/admin/dashboard/recent-orders', { params })
  },
}
