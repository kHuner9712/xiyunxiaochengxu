<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="退款单号">
          <el-input v-model="searchForm.refundNo" placeholder="请输入退款单号" clearable />
        </el-form-item>
        <el-form-item label="订单ID">
          <el-input v-model="searchForm.orderId" placeholder="请输入订单ID" clearable />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option v-for="(label, key) in REFUND_STATUS_MAP" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="refundNo" label="退款单号" width="220" show-overflow-tooltip />
        <el-table-column prop="refundId" label="微信退款单号" width="180" show-overflow-tooltip>
          <template #default="{ row }">{{ row.refundId || '-' }}</template>
        </el-table-column>
        <el-table-column label="订单号" width="200">
          <template #default="{ row }">{{ row.order?.orderNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="退款金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.refundAmount) }}</template>
        </el-table-column>
        <el-table-column label="订单实付" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.order?.payAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="REFUND_STATUS_TAG_TYPE[row.status] || 'info'" size="small">
              {{ REFUND_STATUS_MAP[row.status] || row.status }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" show-overflow-tooltip min-width="150">
          <template #default="{ row }">{{ row.reason || '-' }}</template>
        </el-table-column>
        <el-table-column label="创建时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="回调时间" width="180">
          <template #default="{ row }">{{ formatDate(row.notifiedAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="router.push(`/order/refund-detail/${row.id}`)">查看</el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-wrapper">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.pageSize"
          :total="pagination.total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchList"
          @current-change="fetchList"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { refundApi } from '@/api/refund'
import { formatPrice, formatDate } from '@/utils/format'

const REFUND_STATUS_MAP: Record<string, string> = {
  pending: '待处理',
  processing: '处理中',
  success: '退款成功',
  failed: '退款失败',
  closed: '已关闭',
  abnormal: '异常',
}

const REFUND_STATUS_TAG_TYPE: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
  pending: 'warning',
  processing: 'primary',
  success: 'success',
  failed: 'danger',
  closed: 'info',
  abnormal: 'danger',
}

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])

const searchForm = reactive({
  refundNo: '',
  orderId: '',
  status: undefined as string | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const params: any = { page: pagination.page, pageSize: pagination.pageSize }
    if (searchForm.refundNo) params.refundNo = searchForm.refundNo
    if (searchForm.orderId) params.orderId = searchForm.orderId
    if (searchForm.status) params.status = searchForm.status
    const res = await refundApi.getList(params)
    tableData.value = res.data.list || []
    pagination.total = res.data.pagination?.total || 0
  } catch {} finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.refundNo = ''
  searchForm.orderId = ''
  searchForm.status = undefined
  handleSearch()
}

fetchList()
</script>
