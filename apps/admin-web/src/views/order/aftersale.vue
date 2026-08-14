<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option v-for="(label, key) in AFTERSALE_STATUS_MAP" :key="key" :label="label" :value="key" />
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
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column label="订单号" width="200">
          <template #default="{ row }">{{ row.order?.orderNo || '-' }}</template>
        </el-table-column>
        <el-table-column label="售后类型" width="100">
          <template #default="{ row }">{{ AFTERSALE_TYPE_MAP[row.type] || '-' }}</template>
        </el-table-column>
        <el-table-column label="退款金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.refundAmount) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="售后原因" show-overflow-tooltip min-width="150" />
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag :type="getAftersaleStatusTagType(row.status)" size="small">
              {{ formatAftersaleStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="申请时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="router.push(`/order/aftersale-detail/${row.id}`)">查看</el-button>
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
import { ElMessage } from 'element-plus'
import { aftersaleApi } from '@/api/aftersale'
import {
  formatPrice,
  formatDate,
  formatAftersaleStatus,
  getAftersaleStatusTagType,
  AFTERSALE_STATUS_MAP,
} from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const AFTERSALE_TYPE_MAP: Record<number, string> = { 1: '仅退款', 2: '退货退款' }
const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
let listRequestVersion = 0

const searchForm = reactive({
  status: undefined as string | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  const requestVersion = ++listRequestVersion
  const querySnapshot = {
    page: pagination.page,
    pageSize: pagination.pageSize,
    status: searchForm.status,
  }

  loading.value = true
  try {
    const res = await aftersaleApi.getList(querySnapshot)
    if (requestVersion !== listRequestVersion) return
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    if (requestVersion !== listRequestVersion) return
    ElMessage.error(e?.message || '获取售后列表失败')
  } finally {
    if (requestVersion === listRequestVersion) loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.status = undefined
  handleSearch()
}

fetchList()
</script>
