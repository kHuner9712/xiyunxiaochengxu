import request from '@/utils/request'

export const dashboardApi = {
  getOverview() {
    return request.get('/admin/dashboard/stats')
  },
  getSalesTrend(params: { startDate: string; endDate: string }) {
    return request.get('/admin/dashboard/sales-chart', { params })
  },
  getTopProducts(params: { limit?: number }) {
    return request.get('/admin/dashboard/top-products', { params })
  },
  getRecentOrders(params: { limit?: number }) {
    return request.get('/admin/dashboard/recent-orders', { params })
  },
}
