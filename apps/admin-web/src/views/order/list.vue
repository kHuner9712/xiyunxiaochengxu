<template>
  <div class="page-container">
    <div class="search-bar">
      <el-form :model="searchForm" inline>
        <el-form-item label="订单号">
          <el-input v-model="searchForm.orderNo" placeholder="请输入订单号" clearable />
        </el-form-item>
        <el-form-item label="订单状态">
          <el-select v-model="searchForm.status" placeholder="请选择" clearable>
            <el-option v-for="(label, key) in ORDER_STATUS_MAP" :key="key" :label="label" :value="key" />
          </el-select>
        </el-form-item>
        <el-form-item label="配送方式">
          <el-select v-model="searchForm.fulfillmentType" placeholder="全部" clearable>
            <el-option label="快递配送" value="delivery" />
            <el-option label="到店自提" value="pickup" />
          </el-select>
        </el-form-item>
        <el-form-item label="下单时间">
          <el-date-picker v-model="dateRange" type="daterange" range-separator="至" start-placeholder="开始日期" end-placeholder="结束日期" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="resetSearch">重置</el-button>
          <el-button v-permission="'order:export'" @click="handleExport">导出</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="table-card">
      <el-table :data="tableData" stripe v-loading="loading">
        <el-table-column prop="orderNo" label="订单号" width="200" />
        <el-table-column prop="userName" label="用户" width="120" />
        <el-table-column label="商品数量" width="80">
          <template #default="{ row }">{{ row.items?.length || 0 }}</template>
        </el-table-column>
        <el-table-column label="订单金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="实付金额" width="120">
          <template #default="{ row }">¥{{ formatPrice(row.payAmount) }}</template>
        </el-table-column>
        <el-table-column label="推广来源" width="180">
          <template #default="{ row }">
            <el-space direction="vertical" alignment="flex-start" :size="2">
              <el-tag :type="getOrderSourceTagType(row.sourceType) as any" size="small">
                {{ formatOrderSourceType(row.sourceType) }}
              </el-tag>
              <span v-if="row.sourceCode">推广码：{{ row.sourceCode }}</span>
              <span v-if="row.referrerUserId">推荐人：{{ row.referrerUserId }}</span>
              <span v-if="row.shareRecordId">分享记录：{{ row.shareRecordId }}</span>
              <span v-if="row.shareCampaignId">分享活动：{{ row.shareCampaignId }}</span>
            </el-space>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="getOrderStatusTagType(row.status) as any" size="small">{{ formatOrderStatus(row.status) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下单时间" width="180">
          <template #default="{ row }">{{ formatDate(row.createTime) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link @click="handleDetail(row)">查看</el-button>
            <el-button v-permission="'order:detail'" v-if="row.status === 'pending_payment'" type="danger" link @click="handleCancel(row)">取消</el-button>
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
import { ElMessage, ElMessageBox } from 'element-plus'
import { orderApi } from '@/api/order'
import { formatPrice, formatDate, formatOrderStatus, getOrderStatusTagType, ORDER_STATUS_MAP, formatOrderSourceType, getOrderSourceTagType } from '@/utils/format'
import { asArray, paginationTotal } from '@/utils/response'

const router = useRouter()
const loading = ref(false)
const tableData = ref<any[]>([])
const dateRange = ref<string[]>([])

const searchForm = reactive({
  orderNo: '',
  status: undefined as string | undefined,
  fulfillmentType: undefined as string | undefined,
})

const pagination = reactive({ page: 1, pageSize: 10, total: 0 })

async function fetchList() {
  loading.value = true
  try {
    const params = buildQueryParams()
    params.page = pagination.page
    params.pageSize = pagination.pageSize
    const res = await orderApi.getList(params)
    tableData.value = asArray(res.data)
    pagination.total = paginationTotal(res.data)
  } catch (e: any) {
    ElMessage.error(e?.message || '获取订单列表失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  pagination.page = 1
  fetchList()
}

function resetSearch() {
  searchForm.orderNo = ''
  searchForm.status = undefined
  searchForm.fulfillmentType = undefined
  dateRange.value = []
  handleSearch()
}

function handleDetail(row: any) {
  router.push(`/order/detail/${row.id}`)
}

async function handleCancel(row: any) {
  let reason = ''
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消订单', { inputPattern: /.+/, inputErrorMessage: '请输入取消原因' })
    reason = value
  } catch {
    return
  }

  try {
    await orderApi.cancel(row.id, reason)
    ElMessage.success('取消成功')
    fetchList()
  } catch (e: any) {
    ElMessage.error(e?.message || '取消订单失败')
  }
}

async function handleExport() {
  try {
    const res = await orderApi.export(buildQueryParams())
    const contentType = String(res.headers?.['content-type'] || '').toLowerCase()
    const blob = res.data instanceof Blob ? res.data : new Blob([res.data], { type: contentType || 'text/csv;charset=utf-8;' })
    if (contentType.includes('application/json')) {
      const text = await blob.text()
      let message = '导出失败'
      try {
        const parsed = JSON.parse(text)
        message = parsed?.message || message
      } catch {}
      throw new Error(message)
    }

    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = getFileNameFromDisposition(res.headers['content-disposition']) || `orders-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  } catch (e: any) {
    ElMessage.error(e?.message || '导出失败')
  }
}

function buildQueryParams() {
  const params: any = {
    orderNo: searchForm.orderNo || undefined,
    status: searchForm.status,
    fulfillmentType: searchForm.fulfillmentType,
  }
  if (dateRange.value?.length === 2) {
    params.startDate = dateRange.value[0]
    params.endDate = dateRange.value[1]
  }
  return params
}

function getFileNameFromDisposition(disposition?: string) {
  if (!disposition) return ''
  const utf8Match = disposition.match(/filename\*\s*=\s*([^;]+)/i)
  if (utf8Match?.[1]) {
    const encodedValue = utf8Match[1].trim().replace(/^UTF-8''/i, '').replace(/^"(.*)"$/, '$1')
    try {
      return decodeURIComponent(encodedValue)
    } catch {
      return encodedValue
    }
  }
  const match = disposition.match(/filename="?([^\";]+)"?/i)
  return match?.[1] || ''
}

fetchList()
</script>
