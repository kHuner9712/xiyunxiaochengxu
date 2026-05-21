<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="操作人">
          <el-input v-model="searchForm.adminName" placeholder="请输入操作人" clearable />
        </el-form-item>
        <el-form-item label="操作模块">
          <el-select v-model="searchForm.module" placeholder="请选择" clearable>
            <el-option label="商品管理" value="product" />
            <el-option label="订单管理" value="order" />
            <el-option label="用户管理" value="user" />
            <el-option label="营销管理" value="marketing" />
            <el-option label="内容管理" value="content" />
            <el-option label="系统管理" value="system" />
          </el-select>
        </el-form-item>
        <el-form-item label="操作时间">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="id" label="ID" width="80" />
        <el-table-column prop="adminName" label="操作人" width="120" />
        <el-table-column label="操作模块" width="120">
          <template #default="{ row }">
            <el-tag size="small">{{ moduleMap[row.module] || row.module }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="action" label="操作类型" width="120" />
        <el-table-column prop="description" label="操作描述" show-overflow-tooltip min-width="200" />
        <el-table-column label="IP地址" width="130">
          <template #default="{ row }">{{ row.ip || '-' }}</template>
        </el-table-column>
        <el-table-column label="操作时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>

    <el-dialog v-model="detailVisible" title="操作日志详情" width="600px" destroy-on-close>
      <el-descriptions :column="1" border>
        <el-descriptions-item label="操作人">{{ detail.adminName }}</el-descriptions-item>
        <el-descriptions-item label="操作模块">{{ moduleMap[detail.module] || detail.module }}</el-descriptions-item>
        <el-descriptions-item label="操作类型">{{ detail.action }}</el-descriptions-item>
        <el-descriptions-item label="操作描述">{{ detail.description }}</el-descriptions-item>
        <el-descriptions-item label="IP地址">{{ detail.ip || '-' }}</el-descriptions-item>
        <el-descriptions-item label="操作时间">{{ formatDate(detail.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="请求参数">
          <pre style="max-height: 300px; overflow: auto; background: #f5f7fa; padding: 8px; border-radius: 4px; font-size: 12px">{{ formatRequestData(detail.requestData) }}</pre>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { operationLogApi } from '@/api/operation-log'
import { formatDate } from '@/utils/format'

const loading = ref(false)
const detailVisible = ref(false)
const tableData = ref<any[]>([])
const dateRange = ref<string[]>([])
const detail = ref<any>({})

const moduleMap: Record<string, string> = {
  product: '商品管理',
  order: '订单管理',
  user: '用户管理',
  marketing: '营销管理',
  content: '内容管理',
  system: '系统管理',
}

const searchForm = reactive({
  adminName: '',
  module: undefined as string | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const params: any = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      ...searchForm,
    }
    if (dateRange.value?.length === 2) {
      params.startTime = dateRange.value[0]
      params.endTime = dateRange.value[1]
    }
    const res = await operationLogApi.getList(params)
    tableData.value = res.data.list || []
    pagination.total = res.data.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.adminName = ''
  searchForm.module = undefined
  dateRange.value = []
  handleSearch()
}

async function handleDetail(row: any) {
  try {
    const res = await operationLogApi.getDetail(row.id)
    detail.value = res.data || row
    detailVisible.value = true
  } catch {
    detail.value = row
    detailVisible.value = true
  }
}

function formatRequestData(data: any): string {
  if (!data) return '-'
  try {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  } catch {
    return String(data)
  }
}

fetchList()
</script>
