<template>
  <div class="page-container">
    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
            <div class="stat-footer">{{ card.footer }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div style="display: flex; justify-content: space-between; align-items: center">
              <span>销售趋势</span>
              <el-radio-group v-model="trendType" size="small" @change="fetchSalesTrend">
                <el-radio-button label="week">近7天</el-radio-button>
                <el-radio-button label="month">近30天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div style="height: 350px; display: flex; align-items: center; justify-content: center; color: #909399">
            <el-empty v-if="!trendData.length" description="暂无数据" />
            <div v-else style="width: 100%; height: 100%; overflow-x: auto">
              <table style="width: 100%; border-collapse: collapse; text-align: center">
                <thead>
                  <tr style="background: #f5f7fa">
                    <th style="padding: 10px; border-bottom: 1px solid #ebeef5">日期</th>
                    <th style="padding: 10px; border-bottom: 1px solid #ebeef5">销售额(元)</th>
                    <th style="padding: 10px; border-bottom: 1px solid #ebeef5">订单数</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in trendData" :key="item.date">
                    <td style="padding: 10px; border-bottom: 1px solid #ebeef5">{{ item.date }}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ebeef5">{{ formatPrice(item.salesAmount) }}</td>
                    <td style="padding: 10px; border-bottom: 1px solid #ebeef5">{{ item.orderCount }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span>热销商品TOP10</span></template>
          <el-table :data="topProducts" stripe size="small" max-height="400">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="name" label="商品名称" show-overflow-tooltip />
            <el-table-column prop="salesCount" label="销量" width="80" />
            <el-table-column label="销售额" width="100">
              <template #default="{ row }">{{ formatPrice(row.salesAmount) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-card shadow="hover">
      <template #header><span>最近订单</span></template>
      <el-table :data="recentOrders" stripe size="small">
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="userName" label="用户" width="120" />
        <el-table-column label="订单金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getOrderStatusTagType(row.status)" size="small">
              {{ formatOrderStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下单时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { dashboardApi } from '@/api/dashboard'
import { formatPrice, formatDate, formatOrderStatus, getOrderStatusTagType } from '@/utils/format'

const trendType = ref('week')
const trendData = ref<any[]>([])
const topProducts = ref<any[]>([])
const recentOrders = ref<any[]>([])

const statCards = ref([
  { label: '今日销售额', value: '¥0.00', footer: '较昨日 0%' },
  { label: '今日订单数', value: '0', footer: '较昨日 0%' },
  { label: '今日新增用户', value: '0', footer: '较昨日 0%' },
  { label: '总商品数', value: '0', footer: '上架 0' },
])

async function fetchOverview() {
  try {
    const res = await dashboardApi.getOverview()
    const d = res.data
    statCards.value = [
      { label: '今日销售额', value: `¥${formatPrice(d.todaySales)}`, footer: `较昨日 ${d.salesGrowth || 0}%` },
      { label: '今日订单数', value: String(d.todayOrders || 0), footer: `较昨日 ${d.orderGrowth || 0}%` },
      { label: '今日新增用户', value: String(d.todayUsers || 0), footer: `较昨日 ${d.userGrowth || 0}%` },
      { label: '总商品数', value: String(d.totalProducts || 0), footer: `上架 ${d.onSaleProducts || 0}` },
    ]
  } catch {}
}

async function fetchSalesTrend() {
  try {
    const end = new Date()
    const start = new Date()
    start.setDate(start.getDate() - (trendType.value === 'week' ? 7 : 30))
    const res = await dashboardApi.getSalesTrend({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    })
    trendData.value = res.data || []
  } catch {}
}

async function fetchTopProducts() {
  try {
    const res = await dashboardApi.getTopProducts({ limit: 10 })
    topProducts.value = res.data || []
  } catch {}
}

async function fetchRecentOrders() {
  try {
    const res = await dashboardApi.getRecentOrders({ limit: 10 })
    recentOrders.value = res.data || []
  } catch {}
}

onMounted(() => {
  fetchOverview()
  fetchSalesTrend()
  fetchTopProducts()
  fetchRecentOrders()
})
</script>
