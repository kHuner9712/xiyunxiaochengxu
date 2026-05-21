<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="统计周期">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="fetchData">查询</el-button>
          <el-button @click="handleExport">导出</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover">
          <div class="stat-card">
            <div class="stat-value">{{ card.value }}</div>
            <div class="stat-label">{{ card.label }}</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" style="margin-bottom: 20px">
      <el-col :span="12">
        <el-card>
          <template #header><span>销售额统计</span></template>
          <el-table :data="salesData" stripe size="small">
            <el-table-column prop="date" label="日期" />
            <el-table-column label="销售额" width="120">
              <template #default="{ row }">¥{{ formatPrice(row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column label="订单数" width="80">
              <template #default="{ row }">{{ row.orderCount }}</template>
            </el-table-column>
            <el-table-column label="客单价" width="120">
              <template #default="{ row }">¥{{ formatPrice(row.avgAmount) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>分类销售占比</span></template>
          <el-table :data="categoryData" stripe size="small">
            <el-table-column prop="categoryName" label="分类" />
            <el-table-column label="销售额" width="120">
              <template #default="{ row }">¥{{ formatPrice(row.salesAmount) }}</template>
            </el-table-column>
            <el-table-column label="占比" width="100">
              <template #default="{ row }">{{ formatPercent(row.ratio) }}</template>
            </el-table-column>
            <el-table-column label="订单数" width="80">
              <template #default="{ row }">{{ row.orderCount }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card>
          <template #header><span>用户增长统计</span></template>
          <el-table :data="userGrowthData" stripe size="small">
            <el-table-column prop="date" label="日期" />
            <el-table-column prop="newUsers" label="新增用户" width="100" />
            <el-table-column prop="activeUsers" label="活跃用户" width="100" />
            <el-table-column prop="totalUsers" label="累计用户" width="100" />
          </el-table>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span>商品销量排行</span></template>
          <el-table :data="productRankData" stripe size="small">
            <el-table-column type="index" label="排名" width="60" />
            <el-table-column prop="productName" label="商品名称" show-overflow-tooltip />
            <el-table-column prop="salesCount" label="销量" width="80" />
            <el-table-column label="销售额" width="120">
              <template #default="{ row }">¥{{ formatPrice(row.salesAmount) }}</template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import request from '@/utils/request'
import { formatPrice, formatPercent } from '@/utils/format'

const dateRange = ref<string[]>([])
const salesData = ref<any[]>([])
const categoryData = ref<any[]>([])
const userGrowthData = ref<any[]>([])
const productRankData = ref<any[]>([])

const statCards = ref([
  { label: '总销售额', value: '¥0.00' },
  { label: '总订单数', value: '0' },
  { label: '总用户数', value: '0' },
  { label: '平均客单价', value: '¥0.00' },
])

async function fetchData() {
  try {
    const params: any = {}
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await request.get('/admin/statistics/overview', { params })
    const d = res.data || {}
    statCards.value = [
      { label: '总销售额', value: `¥${formatPrice(d.totalSales)}` },
      { label: '总订单数', value: String(d.totalOrders || 0) },
      { label: '总用户数', value: String(d.totalUsers || 0) },
      { label: '平均客单价', value: `¥${formatPrice(d.avgOrderAmount)}` },
    ]
    salesData.value = d.salesList || []
    categoryData.value = d.categoryList || []
    userGrowthData.value = d.userGrowthList || []
    productRankData.value = d.productRankList || []
  } catch {}
}

async function handleExport() {
  try {
    const params: any = {}
    if (dateRange.value?.length === 2) {
      params.startDate = dateRange.value[0]
      params.endDate = dateRange.value[1]
    }
    const res = await request.get('/admin/statistics/export', { params, responseType: 'blob' })
    const blob = new Blob([res as any], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = '数据统计.xlsx'
    a.click()
    window.URL.revokeObjectURL(url)
  } catch {}
}

onMounted(() => {
  fetchData()
})
</script>
